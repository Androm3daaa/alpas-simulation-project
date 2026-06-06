import React, { useState, useEffect, useRef } from 'react';
import { useSimulation } from '../context/SimulationContext';
import ResultsChatbot from './ResultsChatbot';
import { RunSourceBadge } from './RunArtifacts';
import SavedRunsList from './SavedRunsList';
import { Bot, PanelLeftClose, PanelLeft, Loader2 } from 'lucide-react';

const AIAnalyst = ({ onPushTo3D, onSwitchToDashboard }) => {
  const {
    activeRunId,
    runSource,
    runLabel,
    hasChatContext,
    loadRun,
    isLoadingSim,
    askAnalyst,
    pendingAnalystRunId,
    analystOpenSeq,
    clearPendingAnalystRun,
    pastSims,
    refreshPastSims,
  } = useSimulation();

  const [runsPanelOpen, setRunsPanelOpen] = useState(true);
  const [selectingRunId, setSelectingRunId] = useState(null);
  const hydrateAttemptRef = useRef(null);

  useEffect(() => {
    refreshPastSims();
  }, [refreshPastSims]);

  useEffect(() => {
    if (!pendingAnalystRunId) return;
    const runId = pendingAnalystRunId;
    clearPendingAnalystRun();
    loadRun(runId);
  }, [pendingAnalystRunId, analystOpenSeq, clearPendingAnalystRun, loadRun]);

  useEffect(() => {
    if (!activeRunId || isLoadingSim || hasChatContext) return;
    if (hydrateAttemptRef.current === activeRunId) return;
    hydrateAttemptRef.current = activeRunId;
    loadRun(activeRunId);
  }, [activeRunId, isLoadingSim, hasChatContext, loadRun]);

  const selectRun = async (entry) => {
    if (!entry?.id || isLoadingSim) return;
    setSelectingRunId(entry.id);
    try {
      await loadRun(entry);
    } finally {
      setSelectingRunId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0c0f] overflow-hidden">
      <header className="flex-shrink-0 px-4 py-2 border-b border-white/10 bg-[#0f131f] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
          <Bot className="text-purple-300" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">AI Analyst</h1>
          <p className="text-[10px] text-[#64748b] truncate">
            {hasChatContext && runLabel
              ? `Loaded: ${runLabel}`
              : 'Pick a saved run on the left, then ask questions'}
          </p>
        </div>
        <RunSourceBadge runSource={runSource} runLabel={runLabel} />
        <button
          type="button"
          onClick={() => setRunsPanelOpen((o) => !o)}
          className="lg:hidden p-1.5 rounded-md border border-white/10 text-[#94a3b8]"
          aria-label="Toggle saved runs"
        >
          {runsPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {runsPanelOpen && (
          <aside className="w-[min(100%,17rem)] sm:w-72 lg:w-80 flex-shrink-0 border-r border-white/10 bg-[#0d1016] flex flex-col min-h-0">
            <SavedRunsList
              pastSims={pastSims}
              activeRunId={activeRunId}
              onSelectRun={selectRun}
              selectingRunId={selectingRunId}
              isLoadingSim={isLoadingSim}
              className="flex-1 min-h-0"
              emptyAction={
                onSwitchToDashboard ? (
                  <button
                    type="button"
                    onClick={onSwitchToDashboard}
                    className="mt-4 text-xs px-4 py-2 rounded-lg bg-[#ff4d1c] text-white font-medium hover:bg-[#ff6a3d]"
                  >
                    Go to Dashboard
                  </button>
                ) : null
              }
            />
          </aside>
        )}

        <main className="flex-1 flex flex-col min-w-0 min-h-0 p-3 lg:p-4">
          {isLoadingSim && !hasChatContext ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#94a3b8]">
              <Loader2 size={28} className="animate-spin text-purple-400/80" />
              <span className="text-sm">Loading run context…</span>
            </div>
          ) : (
            <ResultsChatbot
              embedded
              runSource={runSource}
              runLabel={runLabel}
              hasContext={hasChatContext}
              onSendQuestion={(q, hist) => askAnalyst(q, hist)}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default AIAnalyst;