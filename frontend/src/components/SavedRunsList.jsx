import React, { useState } from 'react';
import { Inbox, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';

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
  onRename = null,
  onDelete = null,
  selectingRunId = null,
  isLoadingSim = false,
  emptyAction = null,
  className = '',
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#64748b] border-b border-white/10 shrink-0">
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
            const isEditing = editingId === s.id;

            const startRename = (e) => {
              e.stopPropagation();
              if (!onRename) return;
              setEditingId(s.id);
              setEditValue(s.label || '');
            };

            const cancelRename = (e) => {
              if (e) e.stopPropagation();
              setEditingId(null);
              setEditValue('');
            };

            const commitRename = async (e) => {
              if (e) e.stopPropagation();
              const trimmed = (editValue || '').trim();
              if (trimmed && onRename) {
                await onRename(s, trimmed);
              }
              setEditingId(null);
              setEditValue('');
            };

            const handleDelete = (e) => {
              e.stopPropagation();
              if (onDelete) onDelete(s);
            };

            const handleSelect = () => {
              if (isEditing) return;
              onSelectRun?.(s);
            };

            return (
              <div
                key={s.id}
                className={`group w-full text-left px-4 py-4 rounded-xl border transition-all flex items-start gap-2 ${
                  selected
                    ? 'bg-white/[0.02] border-2 border-emerald-400 ring-2 ring-emerald-500/35 ring-offset-2 ring-offset-[#0d1016]'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                } ${loadingThis ? 'opacity-60' : ''}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleSelect}
                  className={`flex-1 text-left min-w-0 focus:outline-none rounded ${isEditing ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        selected ? 'text-emerald-300' : 'text-[#94a3b8]'
                      }`}
                    >
                      {loadingThis && selected ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" />
                          {s.short_id || s.id?.slice(0, 8)}
                        </span>
                      ) : (
                        s.short_id || s.id?.slice(0, 8)
                      )}
                    </span>
                    {s.created ? (
                      <span className="text-[10px] text-[#64748b] shrink-0 tabular-nums">
                        {formatRunTime(s.created)}
                      </span>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                        className="flex-1 bg-[#111418] border border-white/20 focus:border-purple-500/50 rounded px-2 py-1 text-sm text-white outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={commitRename}
                        className="p-1 rounded hover:bg-white/10 text-emerald-400"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="p-1 rounded hover:bg-white/10 text-red-400"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p
                      className={`text-sm leading-snug mt-1.5 break-words ${
                        selected ? 'text-emerald-50/90' : 'text-[#cbd5e1]'
                      }`}
                      title={s.label}
                    >
                      {s.label || 'Unnamed run'}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        s.source === 'client'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-violet-500/15 text-violet-300'
                      }`}
                    >
                      {s.source === 'client' ? 'Quick' : 'FDS'}
                    </span>
                    {margin != null && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 font-mono">
                        {s.casualties} cas.
                      </span>
                    )}
                  </div>
                </div>

                {/* Rename / Delete actions (shown on hover, hidden while editing) */}
                {!isEditing && (onRename || onDelete) && (
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    {onRename && (
                      <button
                        type="button"
                        onClick={startRename}
                        disabled={!!selectingRunId || isLoadingSim}
                        className="p-1 rounded hover:bg-white/10 text-[#94a3b8] hover:text-purple-300 disabled:opacity-40"
                        title="Rename run"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={!!selectingRunId || isLoadingSim}
                        className="p-1 rounded hover:bg-white/10 text-[#94a3b8] hover:text-red-400 disabled:opacity-40"
                        title="Delete run"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}