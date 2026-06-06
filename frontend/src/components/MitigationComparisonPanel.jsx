import React from 'react';
import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function Delta({ value, suffix = '', invert = false }) {
  if (value == null || Number.isNaN(value)) return <span className="text-[#64748b]">—</span>;
  const n = Number(value);
  const good = invert ? n < 0 : n > 0;
  const bad = invert ? n > 0 : n < 0;
  const Icon = good ? TrendingUp : bad ? TrendingDown : Minus;
  const color = good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-[#64748b]';
  const sign = n > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${color}`}>
      <Icon size={12} />
      {sign}
      {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
      {suffix}
    </span>
  );
}

const EMPTY_ROWS = [
  { label: 'ASET', unit: 's' },
  { label: 'RSET', unit: 's' },
  { label: 'Safety margin', unit: 's' },
  { label: 'Success rate', unit: '%' },
  { label: 'Est. casualties', unit: '' },
];

const MitigationComparisonPanel = ({ comparison }) => {
  const hasData = !!(comparison?.baseline && comparison?.current);
  const { baseline, current, marginGain, activeLabels } = comparison || {};
  const rows = hasData
    ? [
        { label: 'ASET', unit: 's', b: baseline.aset, c: current.aset, higherBetter: true },
        { label: 'RSET', unit: 's', b: baseline.rset, c: current.rset, higherBetter: false },
        { label: 'Safety margin', unit: 's', b: baseline.margin, c: current.margin, higherBetter: true },
        { label: 'Success rate', unit: '%', b: baseline.successRate, c: current.successRate, higherBetter: true },
        {
          label: 'Est. casualties',
          unit: '',
          b: baseline.casualties,
          c: current.casualties,
          higherBetter: false,
          invertDelta: true,
        },
      ]
    : EMPTY_ROWS.map((r) => ({ ...r, b: null, c: null, invertDelta: r.label === 'Est. casualties' }));

  const verdictPositive = hasData && marginGain > 0;

  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-[#0f131f] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Shield size={18} />
            <span className="text-sm font-semibold tracking-tight">Mitigation impact</span>
          </div>
          <p className="text-xs text-[#94a3b8] max-w-2xl leading-relaxed">
            {hasData
              ? 'Same fire and occupancy with all strategies off vs your current settings — before and after in one table.'
              : 'Compares no mitigations vs your sidebar settings after you run or load a saved run.'}
          </p>
        </div>
        {hasData ? (
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              verdictPositive
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
            }`}
          >
            {verdictPositive ? 'Mitigations improve outcome' : 'Margin still tight — adjust scenario'}
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] text-[#64748b] border border-white/10">
            No run data yet
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0a0c0f]/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#64748b] border-b border-white/10">
              <th className="text-left py-2.5 px-4 font-medium">Metric</th>
              <th className="text-right py-2.5 px-4 font-medium">No mitigations</th>
              <th className="text-right py-2.5 px-4 font-medium">With your strategies</th>
              <th className="text-right py-2.5 px-4 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = hasData && r.b != null && r.c != null ? r.c - r.b : null;
              const cell = (v) =>
                v == null ? (
                  <span className="text-[#475569]">—</span>
                ) : (
                  <>
                    {v}
                    {r.unit}
                  </>
                );
              return (
                <tr key={r.label} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 px-4 text-[#c4c8cc]">{r.label}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#94a3b8]">{cell(r.b)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-200">{cell(r.c)}</td>
                  <td className="py-2.5 px-4 text-right">
                    {hasData ? <Delta value={delta} suffix={r.unit} invert={r.invertDelta} /> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasData && activeLabels?.length > 0 && (
        <p className="mt-2 text-[11px] text-[#64748b]">
          Active strategies: {activeLabels.join(' · ')}
        </p>
      )}
    </div>
  );
};

export default MitigationComparisonPanel;