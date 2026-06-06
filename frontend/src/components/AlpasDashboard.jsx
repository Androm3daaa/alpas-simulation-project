import React, { useState, useRef, useEffect } from 'react';
import {
  runEvacuationLive,
  agentMatchesFloor,
  FLOORS,
  DEFAULT_PARAMS,
  computeMitigationComparison,
  normalizeParamsFromServer,
  runEvacuationBatch,
} from '../lib/alpasEngine';
import MitigationComparisonPanel from './MitigationComparisonPanel';
import { buildTrajectoryFromCsv } from '../lib/jupedsimAdapter';
import { normalizeBackendToSimResults } from '../lib/backendAnalysis';
import { useSimulation } from '../context/SimulationContext';
import {
  Flame,
  Users,
  Shield,
  Activity,
  Box,
  ChevronDown,
  TrendingUp,
  Eye,
  UserCheck,
  AlertTriangle,
  BarChart3,
  Target,
  Map,
  FileText,
  Bot,
  RotateCcw,
} from 'lucide-react';
import SimulationCommandCenter from './SimulationCommandCenter';
import ScenarioSidebar from './ScenarioSidebar';
import { BUILDING_DISPLAY_NAME } from '../config/schoolBuilding';

// Chart.js + react-chartjs-2
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AlpasDashboard = ({ onPushTo3D, sharedSim, onClearSharedSim, onSwitchToLogs, onSwitchToAI }) => {
  const {
    loadRun,
    loadSim,
    clearCurrentSim,
    setClientRunFromResults,
    activeRunId: displayActiveRunId,
    runSource,
    hasChatContext,
    refreshPastSims,
    pastSims,
    pendingDashboardRunId,
    clearPendingDashboardRun,
  } = useSimulation();

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [isRunning, setIsRunning] = useState(false);
  const [simData, setSimData] = useState(null);
  const [occupants, setOccupants] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Configure parameters and run simulation');
  const [statusType, setStatusType] = useState('idle'); // idle | running | done | danger
  const [simResults, setSimResults] = useState(null); // final computed metrics + series
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scrubTime, setScrubTime] = useState(0);
  const [savedRunSelect, setSavedRunSelect] = useState('');
  const [loadingSavedRun, setLoadingSavedRun] = useState(false);

  const chartsRef = useRef({});
  const trajectoryRef = useRef([]);
  const backendPollRef = useRef(null);
  const evacAbortRef = useRef(false);

  useEffect(() => {
    if (!pendingDashboardRunId) return;
    const runId = pendingDashboardRunId;
    clearPendingDashboardRun();
    loadPastSim(runId);
  }, [pendingDashboardRunId, clearPendingDashboardRun]);

  // Update a single param
  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const updateMit = (key, value) => {
    setParams((prev) => {
      const mit = { ...prev.mit, [key]: value };
      const next = { ...prev, mit };
      if (key === 'sprinkler') next.sprinkler = value;
      if (key === 'fdr') next.fdr = value;
      if (key === 'vents') next.vents = value;
      return next;
    });
  };

  // Toggle helpers for the fancy toggle switches
  const toggle = (key) => {
    setParams((prev) => {
      const val = !prev[key];
      const next = { ...prev, [key]: val };
      if (key === 'sprinkler' || key === 'fdr' || key === 'vents') {
        next.mit = { ...prev.mit, [key]: val };
      }
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────────
  // RUN SIMULATION — live stepped evacuation (realistic timing on 2D board)
  // ──────────────────────────────────────────────────────────────
  const runSimulation = async () => {
    if (isRunning) return;

    evacAbortRef.current = false;
    setIsRunning(true);
    setStatusType('running');
    setStatusMsg('Alarm — occupants responding (pre-movement delay)…');
    setCurrentTime(0);
    setScrubTime(0);
    setOccupants([]);
    setSimResults(null);
    trajectoryRef.current = [];

    try {
      const result = await runEvacuationLive(
        params,
        ({ simTime, trajectoryHistory, simData, moving, evacuated, casualties, done }) => {
          trajectoryRef.current = trajectoryHistory;
          setSimData(simData);
          setCurrentTime(simTime);

          if (!done) {
            const waiting = simTime < (params.delay ?? 60) * 0.85;
            setStatusMsg(
              waiting
                ? `Pre-movement — t=${Math.round(simTime)}s (alarm delay ~${params.delay}s)`
                : `Evacuation — t=${Math.round(simTime)}s · ${moving} moving · ${evacuated} out · ${casualties} casualties`
            );
          }
        },
        { shouldAbort: () => evacAbortRef.current }
      );

      const { occupants, trajectoryHistory, simResults, simTime, finalEvac, finalCas } = result;

      setOccupants(occupants);
      trajectoryRef.current = trajectoryHistory;
      setCurrentTime(simTime);
      setScrubTime(simTime);
      const mitComparison = computeMitigationComparison(params);
      const resultsPayload = {
        ...simResults,
        mitComparison,
        mitigations: mitComparison.scenarios,
        trajectoryHistory,
      };
      setSimResults(resultsPayload);
        const { synced } = await setClientRunFromResults(params, resultsPayload);
        const syncNote = synced
          ? ' Saved to Run History.'
          : ' Backend offline — run queued; start uvicorn to sync.';

        const safe = finalCas === 0;
      setStatusType(safe ? 'done' : 'danger');
        setStatusMsg(
          safe
            ? `✓ Evacuation complete — ${finalEvac} cleared in ${Math.round(simTime)}s sim time.${syncNote}`
            : `⚠ Evacuation complete — ${finalEvac} evacuated · ${finalCas} casualties at t=${Math.round(simTime)}s.${syncNote}`
        );

      window.setTimeout(() => buildCharts(simResults), 80);
    } catch (err) {
      console.error(err);
      setStatusType('danger');
      setStatusMsg('Simulation failed — check console');
    } finally {
      setIsRunning(false);
    }
  };

  const clearLoadedRun = () => {
    evacAbortRef.current = true;
    setIsRunning(false);
    setCurrentTime(0);
    setScrubTime(0);
    setOccupants([]);
    setSimData(null);
    setSimResults(null);
    trajectoryRef.current = [];
    setSavedRunSelect('');
    setStatusType('idle');
    setStatusMsg('Configure parameters and run simulation');
    onClearSharedSim?.();
    if (backendPollRef.current) {
      clearInterval(backendPollRef.current);
      backendPollRef.current = null;
    }
    clearCurrentSim();
    Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
    chartsRef.current = {};
  };

  const resetSimulation = () => {
    clearLoadedRun();
    setParams({ ...DEFAULT_PARAMS });
    setStatusMsg('Scenario reset — 60 in Room 304, corridor fire, mitigations on');
  };

  async function fetchAnalysis(simId) {
    if (!simId) return null;
    return loadSim(simId);
  }

  async function loadPastSim(simId) {
    if (!simId) return;
    setLoadingSavedRun(true);
    try {
      const entry = pastSims.find((s) => s.id === simId);

      if (entry?.source === 'client') {
        const res = await fetch(`http://localhost:8000/simulation/client-run/${simId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const restoredParams = normalizeParamsFromServer(data.params || {});
        setParams(restoredParams);
        await loadRun(entry);

        let results = data.sim_results || {};
        let history = results.trajectoryHistory;

        if (!history?.length) {
          setStatusType('running');
          setStatusMsg('Replaying saved run on floor plan…');
          const batch = runEvacuationBatch(restoredParams, { maxTimeSec: 600 });
          history = batch.trajectoryHistory;
          const mitComparison = computeMitigationComparison(restoredParams);
          results = {
            ...batch.simResults,
            mitComparison,
            mitigations: mitComparison.scenarios,
            trajectoryHistory: history,
          };
        }

        trajectoryRef.current = history;
        const endT = history[history.length - 1]?.t ?? 0;
        setCurrentTime(endT);
        setScrubTime(endT);
        setOccupants([]);
        setSimResults(results);
        setSimData(results);
        window.setTimeout(() => buildCharts(results), 60);
        setStatusType('done');
        setStatusMsg(`Loaded ${entry.label || simId.slice(0, 8)} — scrub timeline on the floor plan`);
        return;
      }

      await loadRun(simId);
      const poll = await fetch(`http://localhost:8000/simulation/results/${simId}`);
      const data = await poll.json();

      if (data.status === 'complete') {
        const a = data.analysis || (await fetchAnalysis(simId));
        const norm = normalizeBackendToSimResults(data, a);
        setSimResults(norm);
        setSimData(norm);
        trajectoryRef.current = [];
        setOccupants([]);
        if (norm.T) window.setTimeout(() => buildCharts(norm), 60);

        if (data.evacuation?.length) {
          const { trajectoryHistory, maxTime } = buildTrajectoryFromCsv(data.evacuation);
          trajectoryRef.current = trajectoryHistory;
          setScrubTime(maxTime);
          setCurrentTime(maxTime);
          onPushTo3D?.({
            occupants: trajectoryHistory.at(-1)?.agents ?? [],
            currentTime: 0,
            params: { ...params },
            simResults: a?.metrics ?? norm,
            trajectoryHistory,
            isLive: false,
            playbackMode: 'backend',
            maxTime,
          });
        }
        setStatusType('done');
        setStatusMsg(`Loaded FDS run ${simId.slice(0, 8)} — charts and AI Analyst updated`);
      } else {
        setStatusType('running');
        setStatusMsg(`Run ${simId.slice(0, 8)} is still ${data.status || 'processing'} — try again shortly`);
      }
    } catch (e) {
      console.error('loadPastSim', e);
      setStatusType('danger');
      setStatusMsg(`Failed to load run: ${e.message}`);
    } finally {
      setLoadingSavedRun(false);
      setSavedRunSelect('');
    }
  }

  const open3DView = () => {
    if (!trajectoryRef.current.length && !simResults) return;
    const t = scrubTime || currentTime;
    const hist = trajectoryRef.current;
    onPushTo3D?.(
      {
        occupants: occupants.map((a) => ({ ...a })),
        currentTime: t,
        params: { ...params },
        simResults,
        trajectoryHistory: hist.map((frame) => ({
          t: frame.t,
          agents: frame.agents.map((ag) => ({ ...ag })),
        })),
        isLive: false,
        playbackMode: 'snapshot',
        maxTime: hist.length ? hist[hist.length - 1].t : t,
      },
      { switchTo3D: true }
    );
    // Note: in the 3D tab the dynamic overlays are intentionally disabled.
    // The 3D view is for building reference only. Accurate agent/fire behavior is in the 2D plans + Analyst.
  };

  const boardTime = isRunning ? currentTime : scrubTime;
  const boardHistory = trajectoryRef.current.length
    ? trajectoryRef.current.map((f) => ({ t: f.t, agents: f.agents }))
    : null;
  const boardMaxTime = boardHistory?.length ? boardHistory[boardHistory.length - 1].t : currentTime;

  // ──────────────────────────────────────────────────────────────
  // CHARTS
  // ──────────────────────────────────────────────────────────────
  const buildCharts = (d) => {
    // Destroy old charts if any
    Object.values(chartsRef.current).forEach(c => c?.destroy?.());
    chartsRef.current = {};

    const labels = d.T.map(t => t + 's');

    // HRR + Temp
    const hrrCtx = document.getElementById('hrrChart');
    if (hrrCtx) {
      chartsRef.current.hrr = new ChartJS(hrrCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'HRR (MW)', data: d.hrrSeries, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', tension: 0.35, fill: true, yAxisID: 'y', borderWidth: 2, pointRadius: 0 },
            { label: 'Temp (°C)', data: d.tempSeries, borderColor: '#f59e0b', borderDash: [4, 2], backgroundColor: 'transparent', tension: 0.35, yAxisID: 'y2', borderWidth: 2, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { position: 'left', ticks: { color: '#ef4444', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'MW', color: '#ef4444', font: { size: 9 } } },
            y2: { position: 'right', ticks: { color: '#f59e0b', font: { size: 10 } }, grid: { display: false }, title: { display: true, text: '°C', color: '#f59e0b', font: { size: 9 } } },
          },
        },
      });
    }

    // Visibility + CO
    const visCtx = document.getElementById('visChart');
    if (visCtx) {
      chartsRef.current.vis = new ChartJS(visCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Visibility (m)', data: d.visSeries, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', tension: 0.35, fill: true, yAxisID: 'y', borderWidth: 2, pointRadius: 0 },
            { label: 'CO (ppm)', data: d.coSeries, borderColor: '#a855f7', borderDash: [4, 2], backgroundColor: 'transparent', tension: 0.35, yAxisID: 'y2', borderWidth: 2, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { position: 'left', ticks: { color: '#3b82f6', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'm', color: '#3b82f6', font: { size: 9 } } },
            y2: { position: 'right', ticks: { color: '#a855f7', font: { size: 10 } }, grid: { display: false }, title: { display: true, text: 'ppm', color: '#a855f7', font: { size: 9 } } },
          },
        },
      });
    }

    // Evacuation progress
    const evacCtx = document.getElementById('evacChart');
    if (evacCtx) {
      chartsRef.current.evac = new ChartJS(evacCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Evacuated', data: d.evacSeries, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', tension: 0.35, fill: true, borderWidth: 2, pointRadius: 0 },
            { label: 'Total', data: Array(d.T.length).fill(d.totalOcc), borderColor: 'rgba(255,255,255,0.2)', borderDash: [3, 3], backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { ticks: { color: '#22c55e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
          },
        },
      });
    }

    // Congestion
    const congCtx = document.getElementById('congChart');
    if (congCtx) {
      chartsRef.current.cong = new ChartJS(congCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Congestion',
            data: d.congSeries,
            backgroundColor: d.congSeries.map(v => v > 3.5 ? 'rgba(239,68,68,0.7)' : v > 2 ? 'rgba(245,158,11,0.7)' : 'rgba(59,130,246,0.65)'),
            borderRadius: 2,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { max: 6, ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
          },
        },
      });
    }

    // Mitigation comparison
    const mitCtx = document.getElementById('mitChart');
    if (mitCtx) {
      const colors = d.mitigations.map((m) => {
        if (m.kind === 'baseline') return 'rgba(100,116,139,0.85)';
        if (m.kind === 'current') return 'rgba(34,197,94,0.9)';
        return m.margin > 30
          ? 'rgba(56,189,248,0.75)'
          : m.margin > 0
            ? 'rgba(245,158,11,0.8)'
            : 'rgba(239,68,68,0.75)';
      });
      chartsRef.current.mit = new ChartJS(mitCtx, {
        type: 'bar',
        data: {
          labels: d.mitigations.map(m => m.name),
          datasets: [{
            label: 'Safety Margin (s)',
            data: d.mitigations.map(m => +m.margin.toFixed(0)),
            backgroundColor: colors,
            borderRadius: 3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555b63', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'Safety Margin (s)', color: '#888', font: { size: 9 } } },
            y: { ticks: { color: '#8a9099', font: { size: 10 } }, grid: { display: false } },
          },
        },
      });
    }
  };

  useEffect(() => {
    return () => {
      Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
    };
  }, []);

  // Load list of past backend runs on mount so user can pick them
  useEffect(() => {
    refreshPastSims();
  }, []);

  // ──────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ──────────────────────────────────────────────────────────────
  const renderMetric = (label, value, sub, tone = 'neutral') => {
    const toneClasses = {
      safe: 'border-emerald-500/30 bg-emerald-500/5',
      danger: 'border-red-500/30 bg-red-500/5',
      warn: 'border-amber-500/30 bg-amber-500/5',
      neutral: 'border-white/10 bg-[#111418]',
    };
    const valTone = {
      safe: 'text-emerald-400',
      danger: 'text-red-400',
      warn: 'text-amber-400',
      neutral: 'text-white',
      info: 'text-blue-400',
    }[tone] || 'text-white';

    return (
      <div className={`rounded-2xl border p-4 transition-all ${toneClasses[tone] || toneClasses.neutral}`}>
        <div className="text-[10px] uppercase tracking-[0.5px] text-[#64748b] font-medium mb-1.5">{label}</div>
        <div className={`font-mono text-2xl font-semibold tabular-nums ${valTone}`}>{value}</div>
        <div className="text-[11px] text-[#475569] mt-1.5 leading-tight">{sub}</div>
      </div>
    );
  };

  const hasResults = !!simResults;
  const runBoundToDashboard = !!(simResults || (displayActiveRunId && hasChatContext));

  return (
    <div className="flex h-full bg-[#0a0c0f] text-[#e8eaed] font-sans overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScenarioSidebar
        open={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((o) => !o)}
        params={params}
        updateParam={updateParam}
        updateMit={updateMit}
        onRun={runSimulation}
        onReset={resetSimulation}
        isRunning={isRunning}
      />

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0a0c0f] scrollbar-thin">
        {/* Top Status Bar - Slim & Minimal */}
        <div className="flex items-center gap-3 px-6 py-2.5 bg-[#0f131f] border-b border-white/10 text-sm">
          <div className={`w-2 h-2 rounded-full ${statusType === 'running' ? 'bg-amber-400 animate-pulse' : statusType === 'done' ? 'bg-emerald-400' : statusType === 'danger' ? 'bg-red-500' : 'bg-[#555b63]'}`} />
          <span className="text-[#8a9099] flex-1 min-w-0 truncate">{statusMsg}</span>

          {runBoundToDashboard && (
            <button
              type="button"
              onClick={clearLoadedRun}
              disabled={isRunning || loadingSavedRun}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-400/25 bg-amber-500/10 text-amber-200/90 text-[10px] hover:bg-amber-500/15 disabled:opacity-40 shrink-0"
              title="Unload this run from the Dashboard (keeps your scenario settings)"
            >
              <RotateCcw size={13} /> Clear loaded run
            </button>
          )}

          {/* quick access to logs/analysis + past runs + analyst chat */}
          {displayActiveRunId && hasChatContext && onSwitchToAI && (
            <button
              onClick={() => onSwitchToAI()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-400/30 text-purple-300 text-[10px]"
            >
              <Bot size={13} /> AI Analyst
            </button>
          )}
          {displayActiveRunId && hasChatContext && onSwitchToLogs && (
            <button
              onClick={() => onSwitchToLogs()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/10 text-[10px] text-[#94a3b8]"
            >
              <FileText size={13} /> Logs
            </button>
          )}
          {pastSims.length > 0 && (
            <select
              value={savedRunSelect}
              disabled={loadingSavedRun || isRunning}
              onChange={(e) => {
                const id = e.target.value;
                setSavedRunSelect(id);
                if (id) loadPastSim(id);
              }}
              className="text-[11px] min-w-[11rem] max-w-[16rem] bg-[#1a2234] border border-white/25 rounded-lg px-2.5 py-1.5 text-[#f1f5f9] shadow-sm disabled:opacity-50 [color-scheme:dark]"
            >
              <option value="" className="bg-[#1a2234] text-[#94a3b8]">
                {loadingSavedRun ? 'Loading…' : 'Load saved run…'}
              </option>
              {pastSims.slice(0, 12).map((s) => (
                <option key={s.id} value={s.id} className="bg-[#1a2234] text-[#f1f5f9]">
                  {s.label || s.short_id || s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}

          {currentTime > 0 && (
            <span className="text-[#ff7a4d] font-mono tabular-nums">t = {Math.round(currentTime)}s</span>
          )}
        </div>

        {/* Simulation command center (FuseLab-style: map + events + multi-variable timeline) */}
        <div className="px-6 pt-4 pb-6">
          <div className="bg-gradient-to-br from-[#111418] to-[#0a0c0f] border border-white/10 rounded-3xl p-6 md:p-8 ring-1 ring-white/5">
            <div className="mb-6">
              <div className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Map size={20} className="text-emerald-400" />
                Simulation Command Center
              </div>
              <p className="text-sm text-[#64748b] mt-2 max-w-2xl">
                Floor plans, metrics, logs, and the AI Analyst. The <strong className="text-[#8a9099]">{BUILDING_DISPLAY_NAME}</strong> tab is 3D reference only (no live sim overlays).
              </p>
            </div>

            {(occupants.length > 0 || isRunning || simResults) ? (
              <SimulationCommandCenter
                agents={boardHistory ? [] : occupants}
                params={params}
                simResults={simResults}
                currentTime={boardTime}
                trajectoryHistory={boardHistory}
                maxTime={boardMaxTime}
                onTimeChange={setScrubTime}
                isRunning={isRunning}
                fireLocation={params.fireLocation}
                onOpen3D={onPushTo3D ? open3DView : undefined}
                showOpen3D={!!onPushTo3D}
                onOpenLogs={onSwitchToLogs || undefined}
                showOpenLogs={!!onSwitchToLogs}
                onOpenAI={onSwitchToAI || undefined}
                showOpenAI={!!onSwitchToAI}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 py-16 text-center text-[#64748b] text-sm">
                Configure variables (left), then run a simulation to open the command center.
              </div>
            )}
          </div>
        </div>

        {/* Outcome + hazards — layout always visible; numbers only after run or load */}
        <div className="px-6 pb-6">
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold tracking-tight">Evacuation outcome & hazards</div>
              <div className="text-xs text-[#64748b]">
                {hasResults
                  ? 'Egress times are in the mitigation table below'
                  : 'Run a simulation or open a saved run from Run History'}
              </div>
            </div>
            {hasResults ? (
              <div className="text-[10px] px-3 py-1 rounded-full bg-white/5 text-[#64748b] font-mono shrink-0">
                SIMULATION COMPLETE
              </div>
            ) : (
              <div className="text-[10px] px-3 py-1 rounded-full bg-white/[0.04] text-[#64748b] border border-white/10 shrink-0">
                AWAITING RUN
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {hasResults ? (
              <>
                {renderMetric(
                  'Evacuated',
                  `${simResults.actualEvac ?? Math.round(simResults.totalOcc * (simResults.successRate / 100))} / ${simResults.totalOcc}`,
                  `${(simResults.actualRate ?? simResults.successRate)?.toFixed(1)}% success`,
                  (simResults.actualRate ?? simResults.successRate) > 95
                    ? 'safe'
                    : (simResults.actualRate ?? simResults.successRate) > 80
                      ? 'warn'
                      : 'danger'
                )}
                {renderMetric(
                  'Casualties',
                  String(simResults.casualties ?? 0),
                  'Estimated at end of sim',
                  (simResults.casualties ?? 0) === 0
                    ? 'safe'
                    : (simResults.casualties ?? 0) <= 3
                      ? 'warn'
                      : 'danger'
                )}
                {renderMetric(
                  'Min Visibility',
                  Math.min(...simResults.visSeries).toFixed(1) + 'm',
                  'Worst-case corridor',
                  Math.min(...simResults.visSeries) < 3
                    ? 'danger'
                    : Math.min(...simResults.visSeries) < 10
                      ? 'warn'
                      : 'safe'
                )}
                {renderMetric(
                  'FED',
                  simResults.fed,
                  'Fractional effective dose',
                  simResults.fed > 0.3 ? 'danger' : simResults.fed > 0.1 ? 'warn' : 'safe'
                )}
              </>
            ) : (
              ['Evacuated', 'Casualties', 'Min visibility', 'FED'].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-dashed border-white/12 bg-[#111418]/60 p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.5px] text-[#64748b] font-medium mb-1.5">
                    {label}
                  </div>
                  <div className="font-mono text-2xl font-semibold text-[#334155] tabular-nums">—</div>
                  <div className="text-[11px] text-[#475569] mt-1.5">After run or load</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <MitigationComparisonPanel comparison={hasResults ? simResults.mitComparison : null} />
        </div>

        {/* Analysis & Outcomes — 6 cards in 3 by 2 grid (perfect symmetry) */}
        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
            {/* 1-4: The four main charts */}
            {[
              { title: "Fire Growth & Temperature", sub: "Heat Release Rate and plume temperature", id: "hrrChart", icon: <TrendingUp size={20} className="text-[#64748b]" /> },
              { title: "Visibility & Toxic Gas", sub: "Smoke obscuration and carbon monoxide levels", id: "visChart", icon: <Eye size={20} className="text-[#64748b]" /> },
              { title: "Evacuation Progress", sub: "Cumulative successful egress over time", id: "evacChart", icon: <UserCheck size={20} className="text-[#64748b]" /> },
              { title: "Congestion & Bottlenecks", sub: "Exit and corridor pressure during evacuation", id: "congChart", icon: <AlertTriangle size={20} className="text-[#64748b]" /> },
            ].map((item, idx) => (
              <div key={idx} className="bg-[#0f131f] border border-white/10 rounded-3xl p-5 flex flex-col min-h-[320px]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-xs text-[#64748b]">{item.sub}</div>
                  </div>
                </div>

                {hasResults ? (
                  <div className="flex-1">
                    <canvas id={item.id} className="w-full h-full" style={{ height: '220px' }} />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-2xl">
                    <div className="mb-2 opacity-40">{item.icon}</div>
                    <div className="text-xs text-[#64748b]">Run a simulation to populate</div>
                    <div className="text-[10px] text-[#475569] mt-0.5">this metric</div>
                  </div>
                )}
              </div>
            ))}

            {/* 5: Per-Floor Evacuation Outcomes */}
            <div className="bg-[#0f131f] border border-white/10 rounded-3xl p-5 flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Per-Floor Evacuation Outcomes</div>
                  <div className="text-xs text-[#64748b]">Live agent-based results by building level</div>
                </div>
              </div>
              <div className="flex-1 overflow-auto" style={{ maxHeight: '220px' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#64748b] text-xs border-b border-white/10 sticky top-0 bg-[#0f131f] z-10">
                      <th className="py-2 pr-3 font-normal">Floor</th>
                      <th className="py-2 px-3 font-normal">Occupants</th>
                      <th className="py-2 px-3 font-normal text-emerald-400">Evacuated</th>
                      <th className="py-2 px-3 font-normal text-red-400">Casualties</th>
                      <th className="py-2 px-3 font-normal">Temp</th>
                      <th className="py-2 px-3 font-normal">CO</th>
                      <th className="py-2 px-3 font-normal">Visibility</th>
                      <th className="py-2 pl-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#8a9099]">
                    {hasResults && simResults.floorData ? (
                      simResults.floorData.map((f, idx) => {
                        const zoneAgents = occupants.filter(ag => agentMatchesFloor(ag, idx));
                        const zEvac = zoneAgents.filter(a => a.evacuated).length;
                        const zCas = zoneAgents.filter(a => a.casualty).length;
                        const zOcc = zoneAgents.length || f.occ;
                        const status = zCas > 5 ? 'DANGER' : zCas > 0 ? 'WARNING' : 'SAFE';
                        return (
                          <tr key={idx} className="border-b border-white/10 last:border-0 hover:bg-white/5">
                            <td className="py-2.5 pr-3 font-medium text-white">{f.name}</td>
                            <td className="py-2.5 px-3 font-mono">{zOcc}</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400">{zEvac}</td>
                            <td className="py-2.5 px-3 font-mono text-red-400">{zCas}</td>
                            <td className="py-2.5 px-3 font-mono">{f.temp}°C</td>
                            <td className="py-2.5 px-3 font-mono">{f.co} ppm</td>
                            <td className="py-2.5 px-3 font-mono">{f.vis}m</td>
                            <td className="py-2.5 pl-3">
                              <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-mono tracking-wider ${status === 'SAFE' ? 'bg-emerald-500/15 text-emerald-400' : status === 'WARNING' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12">
                          <div className="flex flex-col items-center justify-center text-center text-[#64748b]">
                            <Users size={20} className="mb-2 opacity-40" />
                            <div className="text-xs">Run a simulation to see per-floor details</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6: Mitigation Strategy Effectiveness */}
            <div className="bg-[#0f131f] border border-white/10 rounded-3xl p-5 flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Mitigation Strategy Effectiveness</div>
                  <div className="text-xs text-[#64748b]">Safety margin by scenario (recomputed, not scaled)</div>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {hasResults ? (
                  <canvas id="mitChart" className="w-full h-full" style={{ height: '220px' }} />
                ) : (
                  <div className="text-center text-[#64748b]">
                    <Target size={20} className="mx-auto mb-2 opacity-40" />
                    <div className="text-xs">Run a simulation to see</div>
                    <div className="text-[10px] text-[#475569] mt-0.5">mitigation impact</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlpasDashboard;
