import React, { useMemo } from 'react';
import { Download, FileText, BarChart3 } from 'lucide-react';
import { metricLabel, formatMetricValue, pickDisplayMetrics } from '../lib/metricLabels';

const API = 'http://localhost:8000';

export function SafetyAnalysisPanel({ analysis, compact = false, hideHeader = false }) {
  const runSource = analysis?.run_source === 'backend' ? 'backend' : 'client';
  const entries = useMemo(
    () => pickDisplayMetrics(analysis?.metrics, { compact, runSource }),
    [analysis, compact, runSource]
  );

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#64748b] leading-relaxed">
        {runSource === 'client'
          ? 'No metrics in this run file. Re-run on the Dashboard to regenerate analysis.'
          : 'Analysis not ready yet — wait for the FDS workflow to finish or refresh this run.'}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="rounded-lg px-2.5 py-2 border border-white/[0.08] bg-[#111418]/80"
          >
            <div className="text-[9px] uppercase tracking-wide text-[#64748b] leading-tight">
              {metricLabel(k)}
            </div>
            <div className="font-mono text-sm text-[#f1f5f9] tabular-nums mt-0.5">
              {formatMetricValue(k, v)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111418] p-5">
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#e2e8f0]">Detailed metrics</div>
            <div className="text-[10px] text-[#64748b]">From analysis.json</div>
          </div>
          {analysis.data_quality && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-[#94a3b8] border border-white/10 shrink-0">
              {analysis.data_quality}
            </span>
          )}
        </div>
      )}

      <div
        className={`grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${
          analysis.narrative_summary || analysis.limitations?.length ? 'mb-4' : ''
        }`}
      >
        {entries.map(([k, v]) => (
          <div key={k} className="bg-black/25 rounded-lg px-2.5 py-2 border border-white/5">
            <div className="text-[10px] text-[#64748b] leading-tight">{metricLabel(k)}</div>
            <div className="font-mono text-sm text-white tabular-nums">{formatMetricValue(k, v)}</div>
          </div>
        ))}
      </div>

      {analysis.narrative_summary && !compact && (
        <div
          className={`text-xs text-[#94a3b8] whitespace-pre-wrap leading-relaxed ${
            hideHeader ? '' : 'border-t border-white/10 pt-3'
          }`}
        >
          {analysis.narrative_summary}
        </div>
      )}

      {hideHeader && analysis.data_quality && (
        <p className="text-[10px] text-[#64748b] mt-3">{analysis.data_quality}</p>
      )}

      {analysis.limitations?.length > 0 && !compact && analysis.run_source === 'backend' && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-amber-400/90 mb-1.5">Limitations</div>
          <ul className="text-[11px] text-[#a1a1aa] space-y-1">
            {analysis.limitations.map((l, i) => (
              <li key={i} className="leading-snug">
                · {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RunLogPanel({
  simId,
  logText = '',
  logMeta = null,
  runSource = 'none',
  onLoadMore,
  loadingMore = false,
  compact = false,
  hideHeader = false,
  maxHeight,
}) {
  const logSubtitle =
    runSource === 'client'
      ? 'run.log · Quick analysis summary'
      : runSource === 'backend'
        ? 'run.log · FDS + JuPedSim'
        : 'run.log';
  const lines = logText ? logText.split('\n') : [];
  const downloadHref = simId ? `${API}/simulation/logs/${simId}?raw=1` : null;

  return (
    <div className={`flex flex-col min-h-0 ${compact ? '' : 'h-full'}`} style={maxHeight ? { maxHeight } : undefined}>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-sky-400" />
            <div>
              <div className="text-sm font-semibold text-[#e2e8f0]">Run log</div>
              <div className="text-[10px] text-[#64748b] font-mono">{logSubtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {logMeta?.truncated && onLoadMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="text-[10px] px-2 py-1 rounded border border-white/10 hover:bg-white/5 text-[#94a3b8] disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load full log'}
              </button>
            )}
            {downloadHref && (
              <a
                href={downloadHref}
                download={simId ? `alpas_run_${simId.slice(0, 8)}.log` : undefined}
                className="text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
              >
                <Download size={12} /> Download
              </a>
            )}
          </div>
        </div>
      )}
      {hideHeader && (logMeta?.truncated || downloadHref) && (
        <div className="flex items-center justify-end gap-2 mb-2 flex-shrink-0">
          {logMeta?.truncated && onLoadMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-[#94a3b8] disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load full log'}
            </button>
          )}
          {downloadHref && (
            <a
              href={downloadHref}
              download={simId ? `alpas_run_${simId.slice(0, 8)}.log` : undefined}
              className="text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
            >
              <Download size={12} /> Download
            </a>
          )}
        </div>
      )}

      {logMeta?.line_count != null && (
        <div className="text-[10px] text-[#475569] mb-1.5 flex-shrink-0">
          Showing {logMeta.line_count} lines
          {logMeta.truncated ? ' (truncated — load full log for complete output)' : ''}
          {logMeta.source === 'global' && ' · from server log (per-run file missing)'}
        </div>
      )}

      <pre
        className={`flex-1 min-h-0 overflow-auto scrollbar-thin bg-[#080a0d] border border-white/10 rounded-xl p-3 text-[11px] font-mono leading-[1.5] text-[#b8c4d4] whitespace-pre-wrap ${
          compact ? 'max-h-[min(12rem,28vh)]' : ''
        }`}
      >
        {lines.length ? (
          lines.map((line, i) => (
            <span key={i} className="block hover:bg-white/[0.03]">
              <span className="inline-block w-8 text-right text-[#475569] select-none mr-2 shrink-0">
                {i + 1}
              </span>
              {line || ' '}
            </span>
          ))
        ) : (
          <span className="text-[#64748b]">No log text available for this run.</span>
        )}
      </pre>
    </div>
  );
}

export function RunSourceBadge({ runSource, runLabel }) {
  const styles = {
    backend: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    client: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    none: 'bg-white/5 text-[#64748b] border-white/10',
  };
  const labels = {
    backend: 'FDS + JuPedSim',
    client: 'Quick analysis',
    none: 'No run',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${styles[runSource] || styles.none}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {labels[runSource] || runSource}
      {runLabel && <span className="opacity-80">· {runLabel}</span>}
    </span>
  );
}