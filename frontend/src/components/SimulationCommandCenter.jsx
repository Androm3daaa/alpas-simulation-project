import React, { useMemo } from 'react';
import { Activity, Bell, Droplets, Flame, Layers, Clock } from 'lucide-react';
import SituationBoard2D from './SituationBoard2D';
import { getSimulationEvents, getActivePhase, getScenarioVariables } from '../lib/simulationEvents';
import { SimulationTimeline } from './FloorPlanViewer';
import { BUILDING_DISPLAY_NAME } from '../config/schoolBuilding';

const TONE_STYLES = {
  fire: 'bg-red-500/15 text-red-300 border-red-500/35',
  alarm: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  sprinkler: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  water: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  mit: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
  neutral: 'bg-white/5 text-[#94a3b8] border-white/10',
  phase: 'bg-white/5 text-[#64748b] border-white/10',
};

const EVENT_ICONS = {
  fire: Flame,
  alarm: Bell,
  sprinkler: Droplets,
  phase: Activity,
  mitigation: Layers,
};

/**
 * FuseLab-inspired simulation command center:
 * map-based spatial view + multi-variable chips + event timeline + time scrubbing.
 */
const SimulationCommandCenter = ({
  agents = [],
  params = null,
  simResults = null,
  currentTime = 0,
  trajectoryHistory = null,
  maxTime = 0,
  onTimeChange,
  isRunning = false,
  fireLocation,
  onOpen3D,
  showOpen3D = false,
  onOpenLogs,
  onOpenAI,
  showOpenLogs = false,
  showOpenAI = false,
}) => {
  const effectiveMax = maxTime || trajectoryHistory?.[trajectoryHistory.length - 1]?.t || 0;
  const events = useMemo(
    () => getSimulationEvents(params, effectiveMax || 900),
    [params, effectiveMax]
  );
  const variables = useMemo(() => getScenarioVariables(params), [params]);
  const phase = getActivePhase(events, currentTime);

  return (
    <div className="space-y-4">
      {/* Scenario header — multiple variables at a glance */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {variables.map((v) => (
            <span
              key={v.key}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${TONE_STYLES[v.tone] || TONE_STYLES.neutral}`}
            >
              {v.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[#64748b]">
            <Clock size={12} />
            Phase
          </span>
          <span className="font-mono text-[#e2e8f0] tabular-nums">{phase}</span>
          {showOpen3D && onOpen3D && (
            <button
              type="button"
              onClick={onOpen3D}
              className="ml-2 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[10px] font-medium hover:bg-blue-500/25"
            >
              View {BUILDING_DISPLAY_NAME} (3D reference)
            </button>
          )}
          {showOpenLogs && onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/25"
            >
              Full Logs &amp; Analysis
            </button>
          )}
          {showOpenAI && onOpenAI && (
            <button
              type="button"
              onClick={onOpenAI}
              className="ml-2 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-300 text-[10px] font-medium hover:bg-purple-500/25"
            >
              Ask AI Analyst
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {/* Map-based building simulation (primary) */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0e14] p-4 ring-1 ring-white/5">
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-3 font-semibold">
            Event simulation — building floor plan
          </div>
          <SituationBoard2D
            agents={agents}
            params={params}
            simResults={simResults}
            currentTime={currentTime}
            trajectoryHistory={trajectoryHistory}
            maxTime={effectiveMax}
            onTimeChange={onTimeChange}
            isRunning={isRunning}
            fireLocation={fireLocation}
            hideScrubber
          />
        </div>

        {/* Event log — event-based sequence */}
        <div className="rounded-2xl border border-white/10 bg-[#111418] p-4 flex flex-col max-h-[420px]">
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-3 font-semibold">
            Event sequence
          </div>
          <ul className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
            {events.map((ev) => {
              const Icon = EVENT_ICONS[ev.type] || Activity;
              const past = currentTime >= ev.t;
              const active = past && (events.find((e) => e.t > ev.t && currentTime < e.t) || !events.some((e) => e.t > ev.t && currentTime < e.t));
              return (
                <li
                  key={`${ev.id}-${ev.t}`}
                  className={`flex gap-2.5 p-2.5 rounded-xl border transition-colors ${
                    active
                      ? 'border-[#ff4d1c]/40 bg-[#ff4d1c]/10'
                      : past
                        ? 'border-white/5 bg-white/[0.02] opacity-70'
                        : 'border-white/10 bg-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      past ? 'bg-white/10' : 'bg-white/5'
                    }`}
                  >
                    <Icon size={14} className={past ? 'text-[#94a3b8]' : 'text-[#475569]'} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#e2e8f0] truncate">{ev.label}</div>
                    {ev.detail && (
                      <div className="text-[10px] text-[#64748b] truncate">{ev.detail}</div>
                    )}
                    <div className="text-[10px] font-mono text-[#ff7a4d] mt-0.5">t = {ev.t}s</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Evacuation playback */}
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#121820] to-[#0d1016] px-4 py-4 shadow-inner shadow-black/20">
        <div className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold mb-3">
          Evacuation playback
        </div>

        <SimulationTimeline
          maxTime={effectiveMax}
          currentTime={currentTime}
          onChange={onTimeChange}
          events={events}
          disabled={isRunning}
        />
      </div>
    </div>
  );
};

export default SimulationCommandCenter;