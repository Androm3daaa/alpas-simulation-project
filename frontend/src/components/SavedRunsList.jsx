import React from 'react';
import { Inbox, Loader2 } from 'lucide-react';

export function truncateLabel(text, max = 52) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function formatRunTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Run History–style saved run picker (shared by Run History and AI Analyst).
 */
export default function SavedRunsList({
  pastSims = [],
  activeRunId,
  onSelectRun,
  selectingRunId = null,
  isLoadingSim = false,
  emptyAction = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#64748b] border-b border-white/10 shrink-0">
        Saved runs
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5 min-h-0">
        {pastSims.length === 0 ? (
          <div className="p-6 text-center">
            <Inbox size={28} className="mx-auto text-[#475569] mb-3 opacity-60" />
            <p className="text-sm text-[#8a9099] leading-relaxed">No runs saved yet.</p>
            {emptyAction}
          </div>
        ) : (
          pastSims.map((s) => {
            const selected = activeRunId === s.id;
            const margin = s.margin;
            const loadingThis = selectingRunId === s.id || (isLoadingSim && selected);

            return (
              <button
                key={s.id}
                type="button"
                disabled={!!selectingRunId || (isLoadingSim && !selected)}
                onClick={() => onSelectRun?.(s)}
                className={`w-full text-left px-3 py-3 rounded-xl border transition-all disabled:opacity-60 ${
                  selected
                    ? 'bg-emerald-500/12 border-emerald-400/45 ring-1 ring-emerald-500/20'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      selected ? 'text-emerald-300' : 'text-[#94a3b8]'
                    }`}
                  >
                    {loadingThis && selected ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        {s.short_id || s.id?.slice(0, 8)}
                      </span>
                    ) : (
                      s.short_id || s.id?.slice(0, 8)
                    )}
                  </span>
                  {s.created ? (
                    <span className="text-[9px] text-[#64748b] shrink-0 tabular-nums">
                      {formatRunTime(s.created)}
                    </span>
                  ) : null}
                </div>
                <p
                  className={`text-[11px] leading-snug mt-1.5 line-clamp-2 ${
                    selected ? 'text-emerald-50/90' : 'text-[#cbd5e1]'
                  }`}
                  title={s.label}
                >
                  {truncateLabel(s.label) || 'Unnamed run'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      s.source === 'client'
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'bg-violet-500/15 text-violet-300'
                    }`}
                  >
                    {s.source === 'client' ? 'Quick' : 'FDS'}
                  </span>
                  {margin != null && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        margin > 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {margin > 0 ? '+' : ''}
                      {Math.round(margin)}s
                    </span>
                  )}
                  {s.casualties != null && s.casualties > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 font-mono">
                      {s.casualties} cas.
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}