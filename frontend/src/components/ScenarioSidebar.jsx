import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
  Activity,
  Users,
  Clock,
  Flame,
  MapPin,
} from 'lucide-react';
import {
  OCCUPANT_ROOM_OPTION_GROUPS,
  formatOccupantZoneLabel,
  FIRE_LOCATION_OPTION_GROUPS,
} from '../lib/alpasEngine';
import ScenarioPicker from './ScenarioPicker';

function SectionLabel({ dot, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
        {children}
      </span>
    </div>
  );
}

function SliderRow({ icon: Icon, label, value, suffix, min, max, step, onChange }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="scenario-control-card">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="text-[#64748b] shrink-0" />}
          <span className="text-xs text-[#94a3b8]">{label}</span>
        </div>
        <span className="text-xs font-mono font-medium text-[#ff9a6c] tabular-nums shrink-0">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="scenario-range w-full"
        style={{ '--range-pct': `${pct}%` }}
      />
    </div>
  );
}

export default function ScenarioSidebar({
  open,
  onToggleOpen,
  params,
  updateParam,
  updateMit,
  onRun,
  onReset,
  isRunning,
}) {
  const occupantRoom = params.occupantRoom || 'r304';
  const occupantLabel = formatOccupantZoneLabel(occupantRoom);
  const mitActive = Object.values(params.mit || {}).filter(Boolean).length;
  const [openPickerId, setOpenPickerId] = useState(null);

  return (
    <aside
      className={`${
        open ? 'w-[min(100%,21rem)] sm:w-[340px]' : 'w-11'
      } border-r border-white/[0.08] bg-[#0c0f14] flex-shrink-0 flex flex-col min-h-0 transition-[width] duration-200 shadow-[4px_0_24px_rgba(0,0,0,0.35)]`}
    >
      <div
        className={`flex-shrink-0 border-b border-white/[0.08] bg-[#0f131a]/90 ${
          open ? 'px-4 py-3.5' : 'p-2 justify-center flex'
        }`}
      >
        {open ? (
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={onToggleOpen}
              className="scenario-icon-btn shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <SectionLabel dot="bg-[#ff4d1c]">Scenario setup</SectionLabel>
              <p className="text-[11px] text-[#64748b] mt-1 truncate">
                {params.occ} occupants · {occupantLabel}
              </p>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onToggleOpen} className="scenario-icon-btn" title="Expand sidebar">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
            <div className="space-y-2.5">
              <SectionLabel dot="bg-[#ff4d1c]/80">Placement</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                <ScenarioPicker
                  id="occupant-room"
                  label="Occupant room"
                  hint="All floors"
                  icon={MapPin}
                  value={occupantRoom}
                  onChange={(v) => updateParam('occupantRoom', v)}
                  groups={OCCUPANT_ROOM_OPTION_GROUPS}
                  openPickerId={openPickerId}
                  setOpenPickerId={setOpenPickerId}
                  menuMaxHeight={260}
                />
                <ScenarioPicker
                  id="fire-location"
                  label="Fire location"
                  hint="Room, CR, or corridor"
                  icon={Flame}
                  value={params.fireLocation}
                  onChange={(v) => updateParam('fireLocation', v)}
                  groups={FIRE_LOCATION_OPTION_GROUPS}
                  openPickerId={openPickerId}
                  setOpenPickerId={setOpenPickerId}
                  menuMaxHeight={240}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <SectionLabel dot="bg-amber-500/80">Fire & occupancy</SectionLabel>
              <div className="space-y-2.5">
                <SliderRow
                  icon={Users}
                  label="Total occupants"
                  value={params.occ}
                  suffix=""
                  min={20}
                  max={120}
                  step={5}
                  onChange={(e) => updateParam('occ', parseInt(e.target.value, 10))}
                />
                <SliderRow
                  icon={Clock}
                  label="Alarm delay"
                  value={params.delay}
                  suffix=" s"
                  min={15}
                  max={120}
                  step={5}
                  onChange={(e) => updateParam('delay', parseInt(e.target.value, 10))}
                />
                <SliderRow
                  icon={Flame}
                  label="Peak HRR"
                  value={params.hrr}
                  suffix=" MW"
                  min={0.5}
                  max={3}
                  step={0.1}
                  onChange={(e) => updateParam('hrr', parseFloat(e.target.value))}
                />
                <div className="scenario-control-card">
                  <label className="text-xs text-[#94a3b8] block mb-2">Fire growth</label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0a0e14] border border-white/10">
                    {[
                      { id: 'slow', label: 'Slow' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'fast', label: 'Fast' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => updateParam('growth', g.id)}
                        className={`py-2 rounded-lg text-[11px] font-medium transition-all ${
                          params.growth === g.id
                            ? 'bg-[#ff4d1c] text-white shadow-sm'
                            : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-white/[0.04]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel dot="bg-emerald-500/80">Mitigations</SectionLabel>
                <span className="text-[10px] font-mono text-[#64748b] tabular-nums">
                  {mitActive}/6 on
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#111418]/50 p-2.5 grid grid-cols-2 gap-2">
                {[
                  ['sprinkler', 'Sprinklers'],
                  ['fdr', 'Fire doors'],
                  ['vents', 'Smoke vents'],
                  ['wider', 'Wider exits'],
                  ['aiSign', 'AI signage'],
                  ['press', 'Press. stairs'],
                ].map(([key, label]) => {
                  const on = params.mit[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateMit(key, !on)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[11px] transition-all border ${
                        on
                          ? 'bg-[#ff4d1c]/12 border-[#ff4d1c]/35 text-[#ffc9b0]'
                          : 'bg-[#0a0e14]/80 border-white/[0.06] text-[#94a3b8] hover:border-white/15 hover:text-[#cbd5e1]'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 ${
                          on ? 'bg-[#ff4d1c] border-[#ff4d1c]' : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {on && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor">
                            <path d="M10.2 2.8 4.5 8.5 1.8 5.8l1.1-1.1 1.6 1.6 4.6-4.6 1.1 1.1z" />
                          </svg>
                        )}
                      </span>
                      <span className="leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 px-4 py-4 border-t border-white/[0.08] space-y-2 bg-[#0a0c10]/95 backdrop-blur-sm">
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="scenario-run-btn w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <Activity className="animate-pulse" size={17} /> Evacuation in progress…
                </>
              ) : (
                <>
                  <Play size={17} fill="currentColor" /> Run Simulation
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full py-2.5 text-xs rounded-xl border border-white/10 text-[#8a9099] hover:text-white hover:bg-white/[0.04] flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={14} /> Reset to defaults
            </button>
          </div>
        </>
      )}
    </aside>
  );
}