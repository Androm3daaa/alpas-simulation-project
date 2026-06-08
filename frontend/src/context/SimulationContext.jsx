import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  buildAnalyzePayload,
  buildClientAnalysis,
  buildQuickRunLog,
  formatBackendRunLabel,
  formatClientRunLabel,
  metricsFromSimResults,
  analystContextKey,
  chatWelcomeMessage,
} from '../lib/chatContext';
import {
  clearClientRunHistory,
  enqueuePendingClientRun,
  migrateLocalRunsToServer,
} from '../lib/clientRunHistory';

const API = 'http://localhost:8000';

const SimulationContext = createContext(null);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};

export const SimulationProvider = ({ children }) => {
  const [activeSimId, setActiveSimId] = useState(null);
  const [backendAnalysis, setBackendAnalysis] = useState(null);
  const [runLog, setRunLog] = useState('');
  const [logMeta, setLogMeta] = useState(null);
  const [pastSims, setPastSims] = useState([]);
  const [isLoadingSim, setIsLoadingSim] = useState(false);
  const [isLoadingFullLog, setIsLoadingFullLog] = useState(false);
  const [runSource, setRunSource] = useState('none');
  const [clientRun, setClientRun] = useState(null);
  /** Per-run chat histories persisted in memory + localStorage so convos survive tab nav + run switches. */
  const CHAT_STORAGE_KEY = 'alpas_analyst_chats_v1';
  const [chatHistories, setChatHistories] = useState(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  });
  const persistChatHistories = useCallback((next) => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);
  /** Bumped when Run History (or elsewhere) asks Dashboard to load the active run. */
  const [pendingDashboardRunId, setPendingDashboardRunId] = useState(null);
  /** Ensures AI Analyst reloads the selected run when opened from Run History. */
  const [pendingAnalystRunId, setPendingAnalystRunId] = useState(null);
  const [analystOpenSeq, setAnalystOpenSeq] = useState(0);

  const resolveRunId = useCallback(
    (runId) => {
      if (runId != null && runId !== '') {
        return typeof runId === 'string' ? runId : runId?.id ?? null;
      }
      return activeSimId || clientRun?.runKey || null;
    },
    [activeSimId, clientRun]
  );

  const requestOpenOnDashboard = useCallback(
    (runId) => {
      const id = resolveRunId(runId);
      if (id) setPendingDashboardRunId(id);
    },
    [resolveRunId]
  );

  const clearPendingDashboardRun = useCallback(() => {
    setPendingDashboardRunId(null);
  }, []);

  const requestOpenOnAnalyst = useCallback(
    (runId) => {
      const id = resolveRunId(runId);
      if (!id) return;
      setPendingAnalystRunId(id);
      setAnalystOpenSeq((n) => n + 1);
    },
    [resolveRunId]
  );

  const clearPendingAnalystRun = useCallback(() => {
    setPendingAnalystRunId(null);
  }, []);

  const refreshPastSims = useCallback(async () => {
    try {
      await migrateLocalRunsToServer(API);
    } catch (e) {
      console.warn('[ALPAS] pending quick-run sync skipped', e);
    }
    try {
      const r = await fetch(`${API}/simulations?limit=40`);
      const j = await r.json();
      setPastSims(j.simulations || []);
    } catch (e) {
      console.warn('Failed to refresh runs (is the backend running?)', e);
      setPastSims([]);
    }
  }, []);

  const fetchRunLog = useCallback(
    async (simId, { full = false, fallbackAnalysis = null, fallbackParams = null } = {}) => {
      const isPending = String(simId).startsWith('pending-');
      if (isPending && fallbackAnalysis) {
        const log = buildQuickRunLog(fallbackAnalysis, fallbackParams);
        setRunLog(log);
        setLogMeta({ truncated: false, line_count: log.split('\n').length, total_lines: log.split('\n').length, source: 'quick-summary' });
        return { log, source: 'quick-summary' };
      }

      const q = full ? '?full=1' : '?tail=800';
      const res = await fetch(`${API}/simulation/logs/${simId}${q}`);
      const data = await res.json().catch(() => ({}));
      let log = (data.log || '').trim();
      const missing =
        !log ||
        log.includes('no per-run log') ||
        log.includes('workflow may still be running');

      if (missing && fallbackAnalysis) {
        log = buildQuickRunLog(fallbackAnalysis, fallbackParams);
        data.source = 'quick-summary';
        data.truncated = false;
        data.line_count = log.split('\n').length;
        data.total_lines = data.line_count;
      }

      setRunLog(log);
      setLogMeta({
        truncated: !!data.truncated,
        line_count: data.line_count,
        total_lines: data.total_lines,
        source: data.source,
      });
      return { ...data, log };
    },
    []
  );

  const loadFullLog = useCallback(async () => {
    if (!activeSimId) return;
    setIsLoadingFullLog(true);
    try {
      const fallback =
        runSource === 'client' && clientRun
          ? { analysis: clientRun.analysis, params: clientRun.params }
          : null;
      await fetchRunLog(activeSimId, {
        full: true,
        fallbackAnalysis: fallback?.analysis,
        fallbackParams: fallback?.params,
      });
    } finally {
      setIsLoadingFullLog(false);
    }
  }, [activeSimId, runSource, clientRun, fetchRunLog]);

  const applyClientRunState = useCallback((simId, payload) => {
    const analysis = payload.analysis || buildClientAnalysis(payload.params, payload.sim_results);
    const metrics =
      analysis.metrics && Object.keys(analysis.metrics).length > 0
        ? analysis.metrics
        : metricsFromSimResults(payload.sim_results || {});
    const label =
      payload.label ||
      payload.params?.label ||
      formatClientRunLabel(payload.params || {});

    setActiveSimId(simId);
    setRunSource('client');
    setBackendAnalysis(null);
    setClientRun({
      runKey: simId,
      label,
      params: payload.params || analysis.config || {},
      metrics,
      simResults: payload.sim_results || {},
      analysis: { ...analysis, metrics, sim_id: simId, run_source: 'client' },
    });
    return { ...analysis, metrics };
  }, []);

  const loadSim = useCallback(
    async (simId) => {
      if (!simId) return null;
      setIsLoadingSim(true);
      try {
        const resC = await fetch(`${API}/simulation/client-run/${simId}`);
        const clientPayload = await resC.json().catch(() => ({}));
        if (
          clientPayload.status !== 'not_found' &&
          (clientPayload.source === 'client' || clientPayload.analysis?.run_source === 'client')
        ) {
          const analysis = applyClientRunState(simId, clientPayload);
          await fetchRunLog(simId, {
            fallbackAnalysis: analysis,
            fallbackParams: clientPayload.params,
          });
          return analysis;
        }

        setRunLog('');
        setLogMeta(null);

        setClientRun(null);
        setRunSource('backend');

        const resA = await fetch(`${API}/simulation/analysis/${simId}`);
        const analysisRaw = await resA.json().catch(() => null);

        const resR = await fetch(`${API}/simulation/results/${simId}`);
        const results = await resR.json().catch(() => ({}));
        await fetchRunLog(simId);

        let resolved =
          analysisRaw && !analysisRaw.status ? analysisRaw : results?.analysis || null;

        if (!resolved && results?.metrics) {
          resolved = {
            sim_id: simId,
            metrics: results.metrics,
            narrative_summary: `Backend run ${simId.slice(0, 8)} — safety analysis file pending.`,
            limitations: ['analysis.json not found yet — using live metrics from results endpoint.'],
            data_quality: 'partial',
          };
        }

        setBackendAnalysis(resolved);
        setActiveSimId(simId);
        return resolved;
      } catch (e) {
        console.warn('Failed to load sim', simId, e);
        setBackendAnalysis(null);
        setRunLog('');
        setLogMeta(null);
        setActiveSimId(simId);
        return null;
      } finally {
        setIsLoadingSim(false);
      }
    },
    [applyClientRunState, fetchRunLog]
  );

  const loadRun = useCallback(
    async (run) => {
      const id = typeof run === 'string' ? run : run?.id;
      if (!id) return null;
      return loadSim(id);
    },
    [loadSim]
  );

  /** Load run into shared context; caller switches to AI Analyst tab after await. */
  const openRunForAnalyst = useCallback(
    async (runId) => {
      const id = resolveRunId(runId);
      if (!id) return false;
      await loadSim(id);
      setPendingAnalystRunId(id);
      setAnalystOpenSeq((n) => n + 1);
      return true;
    },
    [resolveRunId, loadSim]
  );

  const setClientRunFromResults = useCallback(
    async (params, simResults, customLabel = null) => {
      const analysis = buildClientAnalysis(params, simResults);
      const label = customLabel || formatClientRunLabel(params);

      try {
        const r = await fetch(`${API}/simulation/client-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            params,
            sim_results: simResults,
            analysis,
            label,
          }),
        });
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const j = await r.json();
        const savedAnalysis = { ...analysis, sim_id: j.simulation_id };
        applyClientRunState(j.simulation_id, {
          params,
          sim_results: simResults,
          analysis: savedAnalysis,
          label: j.label || label,
        });
        await fetchRunLog(j.simulation_id, {
          fallbackAnalysis: savedAnalysis,
          fallbackParams: params,
        });
        await refreshPastSims();
        return { synced: true, simId: j.simulation_id };
      } catch (e) {
        console.warn('[ALPAS] Could not sync quick run to server — queued for retry', e);
        enqueuePendingClientRun({ params, simResults, analysis, label });
        const runKey = `pending-${Date.now()}`;
        applyClientRunState(runKey, {
          params,
          sim_results: simResults,
          analysis: { ...analysis, sim_id: runKey },
          label,
        });
        return { synced: false, simId: runKey };
      }
    },
    [applyClientRunState, refreshPastSims]
  );

  const clearCurrentSim = useCallback(() => {
    setActiveSimId(null);
    setBackendAnalysis(null);
    setRunLog('');
    setLogMeta(null);
    setRunSource('none');
    setClientRun(null);
  }, []);

  /** Track an in-progress or selected FDS run without loading full artifacts yet. */
  const selectBackendRun = useCallback((simId) => {
    if (!simId) return;
    setActiveSimId(simId);
    setRunSource('backend');
    setClientRun(null);
  }, []);

  const clearAllRuns = useCallback(async () => {
    const r = await fetch(`${API}/simulations`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) {
      throw new Error(j.message || j.errors?.join?.('; ') || `HTTP ${r.status}`);
    }
    clearClientRunHistory();
    clearCurrentSim();
    setPastSims([]);
    // Wipe all saved analyst chats too
    setChatHistories({});
    persistChatHistories({});
    return j;
  }, [clearCurrentSim, persistChatHistories]);

  const deleteRun = useCallback(async (simId) => {
    if (!simId) return false;
    try {
      const r = await fetch(`${API}/simulation/${simId}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      // If the deleted run was active, clear it
      if (activeSimId === simId || clientRun?.runKey === simId) {
        clearCurrentSim();
      }
      await refreshPastSims();
      return true;
    } catch (e) {
      console.warn('[ALPAS] delete run failed', e);
      return false;
    }
  }, [activeSimId, clientRun, clearCurrentSim, refreshPastSims]);

  const renameRun = useCallback(async (simId, newLabel) => {
    if (!simId || !newLabel || !newLabel.trim()) return false;
    try {
      const r = await fetch(`${API}/simulation/${simId}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      await refreshPastSims();
      return true;
    } catch (e) {
      console.warn('[ALPAS] rename run failed', e);
      return false;
    }
  }, [refreshPastSims]);

  const runLabel = useMemo(() => {
    if (runSource === 'backend' && activeSimId) {
      const entry = pastSims.find((s) => s.id === activeSimId);
      return formatBackendRunLabel(activeSimId, backendAnalysis, entry);
    }
    if (runSource === 'client' && clientRun) return clientRun.label;
    return null;
  }, [runSource, activeSimId, backendAnalysis, clientRun, pastSims]);

  const activeRunId = activeSimId || clientRun?.runKey || null;

  const hasChatContext = useMemo(() => {
    if (runSource === 'backend') {
      return !!(
        activeSimId &&
        (backendAnalysis?.metrics ||
          backendAnalysis?.narrative_summary ||
          runLog?.trim())
      );
    }
    if (runSource === 'client') {
      const m = clientRun?.metrics || clientRun?.analysis?.metrics;
      const hasMetrics =
        m &&
        (m.ASET != null ||
          m.safety_margin != null ||
          m.RSET != null ||
          m.casualties != null);
      const hasSim =
        clientRun?.simResults?.aset != null || clientRun?.simResults?.margin != null;
      return !!(activeRunId && clientRun && (hasMetrics || hasSim || runLog?.trim()));
    }
    return false;
  }, [runSource, activeSimId, activeRunId, backendAnalysis, runLog, clientRun]);

  const contextAnalysis = useMemo(() => {
    if (runSource === 'backend') return backendAnalysis;
    if (runSource === 'client') return clientRun?.analysis;
    return null;
  }, [runSource, backendAnalysis, clientRun]);

  const contextKey = useMemo(
    () => analystContextKey({ runSource, activeSimId, clientRun }),
    [runSource, activeSimId, clientRun]
  );

  const getWelcomeMessages = useCallback(() => {
    const welcome = chatWelcomeMessage({ runSource, runLabel, hasChatContext });
    return [{ role: 'assistant', content: welcome }];
  }, [runSource, runLabel, hasChatContext]);

  // Per-run persisted messages. If we have a saved convo for this run's key, use it (even across nav).
  // Otherwise show a fresh welcome (no auto-save of welcome until user sends first msg).
  const analystMessages = useMemo(() => {
    const stored = chatHistories[contextKey];
    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
    return getWelcomeMessages();
  }, [chatHistories, contextKey, getWelcomeMessages]);

  // Smart setter: always targets the *current* run's key. Accepts value or (prev)=>next updater.
  // Uses the visible messages (stored or current welcome) so first append keeps the welcome.
  const setAnalystMessagesForCurrent = useCallback((updater) => {
    setChatHistories((prev) => {
      const stored = prev[contextKey];
      const visibleCurrent = (stored && Array.isArray(stored) && stored.length > 0)
        ? stored
        : getWelcomeMessages();
      let nextForKey;
      if (typeof updater === 'function') {
        nextForKey = updater(visibleCurrent);
      } else {
        nextForKey = updater;
      }
      if (!Array.isArray(nextForKey)) nextForKey = [];
      const next = { ...prev, [contextKey]: nextForKey };
      persistChatHistories(next);
      return next;
    });
  }, [contextKey, getWelcomeMessages, persistChatHistories]);

  // Public alias so existing consumers (ResultsChatbot etc) keep working unchanged.
  const setAnalystMessages = setAnalystMessagesForCurrent;

  const clearCurrentAnalystChat = useCallback(() => {
    setChatHistories((prev) => {
      const next = { ...prev };
      if (contextKey) delete next[contextKey];
      persistChatHistories(next);
      return next;
    });
  }, [contextKey, persistChatHistories]);

  const askAnalyst = useCallback(
    async (question, history = []) => {
      const body = buildAnalyzePayload({
        question,
        history,
        runSource,
        activeSimId,
        backendAnalysis,
        runLog,
        clientRun,
      });
      const r = await fetch(`${API}/simulation/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      return {
        answer: j.answer || '(no response)',
        mode: j.mode,
        hasContext: j.has_context,
      };
    },
    [runSource, activeSimId, backendAnalysis, runLog, clientRun]
  );

  useEffect(() => {
    refreshPastSims();
  }, [refreshPastSims]);

  const value = {
    activeSimId,
    activeRunId,
    backendAnalysis,
    contextAnalysis,
    runLog,
    logMeta,
    pastSims,
    isLoadingSim,
    isLoadingFullLog,
    runSource,
    clientRun,
    runLabel,
    hasChatContext,
    loadSim,
    loadRun,
    loadFullLog,
    refreshPastSims,
    clearCurrentSim,
    clearAllRuns,
    deleteRun,
    renameRun,
    selectBackendRun,
    setClientRunFromResults,
    askAnalyst,
    setActiveSimId,
    analystMessages,
    setAnalystMessages,
    clearCurrentAnalystChat,
    chatHistories,
    contextKey,
    pendingDashboardRunId,
    requestOpenOnDashboard,
    clearPendingDashboardRun,
    pendingAnalystRunId,
    analystOpenSeq,
    requestOpenOnAnalyst,
    clearPendingAnalystRun,
    openRunForAnalyst,
  };

  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
};