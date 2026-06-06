import React, { useEffect, useState, useMemo } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { SafetyAnalysisPanel, RunLogPanel, RunSourceBadge } from './RunArtifacts';
import {
  FileText,
  RefreshCw,
  Trash2,
  LayoutDashboard,
  BarChart3,
  ScrollText,
  Loader2,
  Bot,
} from 'lucide-react';
import SavedRunsList, { formatRunTime } from './SavedRunsList';

const RunsAndLogs = ({ onSwitchToDashboard, onSwitchToAI, onPushTo3D }) => {
  const {
    activeSimId,
    runLog,
    logMeta,
    pastSims,
    loadRun,
    activeRunId,
    contextAnalysis,
    hasChatContext,
    runSource,
    loadFullLog,
    isLoadingSim,
    isLoadingFullLog,
    refreshPastSims,
    clearAllRuns,
    requestOpenOnDashboard,
    openRunForAnalyst,
  } = useSimulation();

  const [openingAnalyst, setOpeningAnalyst] = useState(false);

  const openOnDashboard = async () => {
    if (!activeRunId) return;
    await loadRun(activeRunId);
    requestOpenOnDashboard(activeRunId);
    onSwitchToDashboard?.();
  };

  const openOnAnalyst = async () => {
    if (!activeRunId || openingAnalyst) return;
    setOpeningAnalyst(true);
    try {
      const ok = await openRunForAnalyst(activeRunId);
      if (ok) onSwitchToAI?.();
    } finally {
      setOpeningAnalyst(false);
    }
  };

  const selectRun = async (entry) => {
    if (!entry?.id || isLoadingSim) return;
    await loadRun(entry);
  };

  const [detailTab, setDetailTab] = useState('analysis');
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingRunId, setSelectingRunId] = useState(null);

  const activeEntry = useMemo(
    () => pastSims.find((s) => s.id === activeRunId),
    [pastSims, activeRunId]
  );

  useEffect(() => {
    refreshPastSims();
  }, [refreshPastSims]);

  useEffect(() => {
    if (pastSims.length > 0 && !activeRunId && !isLoadingSim) {
      loadRun(pastSims[0]);
    }
  }, [pastSims.length, activeRunId, isLoadingSim, loadRun, pastSims]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPastSims();
      if (activeRunId) await loadRun(activeRunId);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0c0f] overflow-hidden">
      <header className="flex-shrink-0 px-5 py-3.5 border-b border-white/10 bg-[#0f131f] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-base">Run History</h1>
            <p className="text-[11px] text-[#64748b] truncate">
              {pastSims.length} saved run{pastSims.length === 1 ? '' : 's'} on the server
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs px-3 py-2 border border-white/10 rounded-lg hover:bg-white/5 flex items-center gap-1.5 text-[#94a3b8] disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            disabled={clearing || pastSims.length === 0}
            onClick={async () => {
              if (
                !window.confirm(
                  'Delete all saved runs? This removes every Quick and FDS run folder on the server. Cannot be undone.'
                )
              ) {
                return;
              }
              setClearing(true);
              try {
                await clearAllRuns();
                setDetailTab('analysis');
              } catch (e) {
                window.alert(`Could not clear runs: ${e.message}`);
              } finally {
                setClearing(false);
              }
            }}
            className="text-xs px-3 py-2 border border-red-500/25 rounded-lg hover:bg-red-500/10 flex items-center gap-1.5 text-red-300 disabled:opacity-40"
          >
            <Trash2 size={13} /> {clearing ? 'Clearing…' : 'Clear all'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-[min(100%,17rem)] sm:w-72 lg:w-80 flex-shrink-0 border-r border-white/10 bg-[#0d1016] flex flex-col min-h-0">
          <SavedRunsList
            pastSims={pastSims}
            activeRunId={activeRunId}
            onSelectRun={async (s) => {
              setSelectingRunId(s.id);
              try {
                await selectRun(s);
              } finally {
                setSelectingRunId(null);
              }
            }}
            selectingRunId={selectingRunId}
            isLoadingSim={isLoadingSim}
            className="flex-1 min-h-0"
            emptyAction={
              <button
                type="button"
                onClick={openOnDashboard}
                className="mt-4 text-xs px-4 py-2 rounded-lg bg-[#ff4d1c] text-white font-medium hover:bg-[#ff6a3d]"
              >
                Go to Dashboard
              </button>
            }
          />
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0c0f]">
          {!hasChatContext && !isLoadingSim ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
              <BarChart3 size={36} className="text-[#475569] mb-4 opacity-50" />
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Pick a run on the left to see safety metrics and the run log. Your latest run loads
                automatically when available.
              </p>
            </div>
          ) : isLoadingSim ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#94a3b8]">
              <Loader2 size={28} className="animate-spin text-emerald-400/80" />
              <span className="text-sm">Loading run…</span>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 px-5 py-3 border-b border-white/10 bg-[#0f131f]/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <RunSourceBadge runSource={runSource} />
                    {activeRunId && (
                      <span className="text-[10px] font-mono text-[#64748b]">{activeRunId.slice(0, 8)}…</span>
                    )}
                    {activeEntry?.created ? (
                      <span className="text-[10px] text-[#64748b]">{formatRunTime(activeEntry.created)}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openOnAnalyst}
                      disabled={!activeRunId || isLoadingSim || openingAnalyst}
                      title={
                        activeRunId
                          ? 'Load this run into the AI Analyst and open the chat'
                          : 'Select a run first'
                      }
                      className="text-xs px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {openingAnalyst ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Bot size={14} />
                      )}
                      {openingAnalyst ? 'Loading…' : 'Ask AI Analyst'}
                    </button>
                    <button
                      type="button"
                      onClick={openOnDashboard}
                      disabled={!activeRunId || isLoadingSim}
                      title={
                        activeRunId
                          ? 'Replay this run on the Dashboard floor plan and charts'
                          : 'Select a run first'
                      }
                      className="text-xs px-4 py-2 rounded-lg bg-[#ff4d1c] hover:bg-[#ff6a3d] text-white font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <LayoutDashboard size={14} /> Open on Dashboard
                    </button>
                    {onPushTo3D && runSource === 'backend' && (
                      <button
                        type="button"
                        onClick={() => onPushTo3D?.({})}
                        className="text-xs px-3 py-2 rounded-lg border border-white/10 text-[#94a3b8] hover:bg-white/5"
                      >
                        3D
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 px-5 pt-3">
                <div className="inline-flex p-1 rounded-xl bg-[#111418] border border-white/10">
                  {[
                    { id: 'analysis', label: 'Safety analysis', icon: BarChart3 },
                    { id: 'log', label: 'Run log', icon: ScrollText },
                  ].map((t) => {
                    const Icon = t.icon;
                    const on = detailTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDetailTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                          on
                            ? 'bg-emerald-500/20 text-emerald-200 shadow-sm'
                            : 'text-[#64748b] hover:text-[#94a3b8]'
                        }`}
                      >
                        <Icon size={14} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 p-5 pt-3 overflow-hidden">
                {detailTab === 'analysis' ? (
                  <div className="h-full overflow-y-auto scrollbar-thin">
                    <SafetyAnalysisPanel analysis={contextAnalysis} hideHeader />
                  </div>
                ) : runLog ? (
                  <RunLogPanel
                    simId={activeSimId}
                    logText={runLog}
                    logMeta={logMeta}
                    runSource={runSource}
                    onLoadMore={loadFullLog}
                    loadingMore={isLoadingFullLog}
                    hideHeader
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#111418]/30 p-8 text-center max-w-md mx-auto">
                    <ScrollText size={32} className="text-[#475569] mb-3 opacity-60" />
                    <p className="text-sm text-[#8a9099] leading-relaxed">
                      Log not loaded yet. Hit <strong className="text-[#94a3b8] font-normal">Refresh</strong>{' '}
                      or run again on the Dashboard.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default RunsAndLogs;