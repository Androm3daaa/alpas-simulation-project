import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  FLOORS,
  ROOM_COLORS,
  getAgentsAtTime,
  agentMatchesFloor,
  getBuildingFloorCount,
} from '../lib/alpasEngine';

const PLAN_W = 420;
const PLAN_H = 310;

function normAgentCoord(v, axis) {
  if (v == null || Number.isNaN(v)) return 0.5;
  if (v > 1.001) return axis === 'y' ? v / PLAN_H : v / PLAN_W;
  return Math.min(1, Math.max(0, v));
}

function pxFromNorm(nx, ny) {
  return { px: nx * PLAN_W, py: ny * PLAN_H };
}

/**
 * Enterprise 2D situation display — plan-accurate, scrubbable, no 3D required.
 */
const FloorPlanViewer = ({
  floorIndex = 0,
  agents = [],
  fireLocation = 'classroom1',
  params = null,
  simResults = null,
  currentTime = 0,
  trajectoryHistory = null,
  showSprinklers = true,
  showExits = true,
  showLegend = true,
  className = '',
}) => {
  const canvasRef = useRef(null);
  const floorData = FLOORS[floorIndex] ?? FLOORS[0];

  const displayAgents = useMemo(() => {
    if (trajectoryHistory?.length) return getAgentsAtTime(trajectoryHistory, currentTime);
    return agents;
  }, [agents, trajectoryHistory, currentTime]);

  const floorAgents = useMemo(
    () => displayAgents.filter((ag) => !ag.evacuated && agentMatchesFloor(ag, floorIndex)),
    [displayAgents, floorIndex]
  );

  const fireRoom = useMemo(
    () => floorData.rooms.find((r) => r.id === fireLocation),
    [floorData, fireLocation]
  );

  const visM = useMemo(() => {
    if (!simResults?.visSeries?.length) return null;
    const idx = Math.min(
      simResults.visSeries.length - 1,
      Math.max(0, Math.floor(currentTime / 10))
    );
    return simResults.visSeries[idx];
  }, [simResults, currentTime]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 320);
    const h = Math.max(rect.height, 220);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 12;
    const scale = Math.min((w - pad * 2) / PLAN_W, (h - pad * 2) / PLAN_H);
    const offX = (w - PLAN_W * scale) / 2;
    const offY = (h - PLAN_H * scale) / 2;

    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    // Corridor smoke band (visibility proxy)
    if (visM != null) {
      const corridor = floorData.rooms.find((r) => r.type === 'corridor');
      if (corridor) {
        const alpha = visM < 5 ? 0.45 : visM < 10 ? 0.28 : 0.12;
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(corridor.x, corridor.y, corridor.w, corridor.h);
      }
    }

    floorData.rooms.forEach((room) => {
      const isFire = fireRoom && room.id === fireRoom.id;
      ctx.fillStyle = isFire ? '#7f1d1d' : ROOM_COLORS[room.type] || '#1e293b';
      ctx.strokeStyle = isFire ? '#ef4444' : '#334155';
      ctx.lineWidth = isFire ? 2 : 1;
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      ctx.fillStyle = isFire ? '#fecaca' : '#e2e8f0';
      ctx.font = 'bold 11px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = room.label.length > 14 ? room.label.slice(0, 12) + '…' : room.label;
      ctx.fillText(label, room.x + room.w / 2, room.y + room.h / 2);
    });

    // Draw explicit doors (richer geometry for realistic flow)
    if (floorData.doors && floorData.doors.length) {
      floorData.doors.forEach((door) => {
        ctx.fillStyle = '#22c55e';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(door.x, door.y, door.w, door.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(door.x, door.y, door.w, door.h);
        // Small indicator of width importance (wider = thicker stroke or dot)
        if (door.width && door.width > 2.0) {
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(door.x + door.w * 0.35, door.y + door.h * 0.35, door.w * 0.3, door.h * 0.3);
        }
      });
    }

    if (showExits && floorData.exits) {
      floorData.exits.forEach((ex, i) => {
        ctx.fillStyle = '#22c55e';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
      });
    }

    if (showSprinklers && floorData.sprinklers) {
      floorData.sprinklers.forEach((sp) => {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle =
          params?.sprinkler && currentTime >= (params.sprinklerDelay ?? 28)
            ? '#38bdf8'
            : '#475569';
        ctx.fill();
      });
    }

    floorAgents.forEach((ag) => {
      const nx = normAgentCoord(ag.x, 'x');
      const ny = normAgentCoord(ag.y, 'y');
      const { px, py } = pxFromNorm(nx, ny);
      ctx.beginPath();
      ctx.arc(px, py, ag.casualty ? 4 : 3.2, 0, Math.PI * 2);
      if (ag.casualty) {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#7f1d1d';
      } else if (ag.moving) {
        ctx.fillStyle = '#60a5fa';
        ctx.strokeStyle = '#1e3a5f';
      } else {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#854d0e';
      }
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.restore();

    // Floor label
    ctx.fillStyle = '#64748b';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${floorData.name}  ·  t=${Math.round(currentTime)}s`, pad, h - pad);
  }, [
    floorData,
    floorAgents,
    fireRoom,
    visM,
    showExits,
    showSprinklers,
    params,
    currentTime,
  ]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const counts = useMemo(() => {
    const onFloor = displayAgents.filter((a) => agentMatchesFloor(a, floorIndex));
    return {
      active: onFloor.filter((a) => !a.evacuated && !a.casualty).length,
      evac: onFloor.filter((a) => a.evacuated).length,
      cas: onFloor.filter((a) => a.casualty).length,
    };
  }, [displayAgents, floorIndex]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative rounded-xl border border-white/10 bg-[#0a0e14] overflow-hidden">
        <canvas ref={canvasRef} className="w-full block" style={{ height: 280 }} />
        {visM != null && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 text-[10px] font-mono text-[#94a3b8]">
            Visibility {visM.toFixed(1)} m
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#64748b]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#facc15]" /> Occupant
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#60a5fa]" /> Moving
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Casualty / fire
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Exit
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-[#22c55e]/75 border border-[#16a34a]" /> Door (flow)
          </span>
          <span className="ml-auto font-mono tabular-nums">
            {counts.active} inside · {counts.evac} out · {counts.cas} casualties
          </span>
        </div>
      )}
    </div>
  );
};

export default FloorPlanViewer;

const EVENT_CHIP_ACCENT = {
  fire: 'border-l-red-500/70',
  alarm: 'border-l-amber-400/70',
  sprinkler: 'border-l-sky-400/70',
  mitigation: 'border-l-violet-400/70',
  phase: 'border-l-slate-500/50',
};

/** Only show major milestones as chips (no markers on the rail). */
const CHIP_EVENT_IDS = new Set(['ignition', 'sprinkler', 'alarm', 'end']);

function formatPlaybackTime(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}:${String(r).padStart(2, '0')}`;
  return `${s}s`;
}

/**
 * Playback scrubber — flat rail, no native thumb; milestone chips below.
 */
export function SimulationTimeline({
  maxTime = 0,
  currentTime = 0,
  onChange,
  events = [],
  disabled = false,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const seekFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el || disabled || maxTime <= 0) return;
      const { left, width } = el.getBoundingClientRect();
      if (width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      onChange?.(Math.round(ratio * maxTime));
    },
    [disabled, maxTime, onChange]
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => seekFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, seekFromClientX]);

  if (maxTime <= 0) return null;

  const t = Math.min(currentTime, maxTime);
  const pct = maxTime > 0 ? (t / maxTime) * 100 : 0;
  const chipEvents = events.filter(
    (ev) => CHIP_EVENT_IDS.has(ev.id) || ev.type === 'fire' || ev.type === 'alarm'
  );

  const handleTrackPointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handleTrackKeyDown = (e) => {
    if (disabled) return;
    const step = e.shiftKey ? Math.max(5, Math.round(maxTime / 40)) : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange?.(Math.min(maxTime, t + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange?.(Math.max(0, t - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange?.(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange?.(maxTime);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">Current time</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-[#f8fafc] tracking-tight">
            {formatPlaybackTime(t)}
          </div>
        </div>
        <div className="text-right pb-0.5">
          <div className="text-[10px] text-[#64748b]">Duration</div>
          <div className="font-mono text-sm tabular-nums text-[#94a3b8]">
            {formatPlaybackTime(maxTime)}
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Evacuation playback time"
        aria-valuemin={0}
        aria-valuemax={maxTime}
        aria-valuenow={t}
        aria-valuetext={formatPlaybackTime(t)}
        aria-disabled={disabled}
        onPointerDown={handleTrackPointerDown}
        onKeyDown={handleTrackKeyDown}
        className={`relative h-9 flex items-center select-none touch-none outline-none rounded-md ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } focus-visible:ring-1 focus-visible:ring-[#ff7a4d]/40`}
      >
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full bg-[#1e293b] overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full bg-[#ff6a3d]/55 transition-[width] duration-75 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {chipEvents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-0.5 -mx-0.5 px-0.5">
          {chipEvents.map((ev) => {
            const active = Math.abs(t - ev.t) <= Math.max(2, maxTime * 0.008);
            const past = t >= ev.t;
            const accent = EVENT_CHIP_ACCENT[ev.type] || EVENT_CHIP_ACCENT.phase;
            return (
              <button
                key={`chip-${ev.id}-${ev.t}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange?.(ev.t)}
                title={ev.detail || undefined}
                className={`inline-flex shrink-0 items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-md text-[10px] font-medium border border-l-2 transition-colors ${
                  active
                    ? `${accent} border-[#ff6a3d]/35 bg-[#ff4d1c]/10 text-[#fde8e0]`
                    : past
                      ? `${accent} border-white/[0.08] bg-white/[0.03] text-[#94a3b8] hover:border-white/15`
                      : `${accent} border-transparent bg-white/[0.02] text-[#64748b] hover:text-[#94a3b8] hover:bg-white/[0.04]`
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span>{ev.label}</span>
                <span className="font-mono text-[#64748b] tabular-nums text-[9px]">
                  {formatPlaybackTime(ev.t)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** @deprecated use SimulationTimeline */
export function FloorPlanScrubber(props) {
  return <SimulationTimeline {...props} />;
}

export { PLAN_W, PLAN_H, getBuildingFloorCount };