import React, { useState, useEffect, useMemo } from 'react';
import FloorPlanViewer, { SimulationTimeline, getBuildingFloorCount } from './FloorPlanViewer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FLOORS, formatOccupantZoneLabel, getOriginFloorIndex } from '../lib/alpasEngine';
import { getSimulationEvents } from '../lib/simulationEvents';

/**
 * Multi-floor enterprise situation board with time scrubbing (no cinematic 3D).
 */
const SituationBoard2D = ({
  agents = [],
  params = null,
  simResults = null,
  currentTime = 0,
  trajectoryHistory = null,
  maxTime = 0,
  onTimeChange,
  isRunning = false,
  fireLocation,
  hideScrubber = false,
}) => {
  const originFloor = getOriginFloorIndex(params || {});
  const [floorIndex, setFloorIndex] = useState(originFloor);
  const storeys = getBuildingFloorCount();
  const effectiveMax = maxTime || trajectoryHistory?.[trajectoryHistory.length - 1]?.t || 0;
  const timelineEvents = useMemo(
    () => getSimulationEvents(params, effectiveMax || 900),
    [params, effectiveMax]
  );

  useEffect(() => {
    setFloorIndex(getOriginFloorIndex(params || {}));
  }, [params?.occupantRoom, params?.fireLocation]);

  const roomLabel = params?.occupantRoom ? formatOccupantZoneLabel(params.occupantRoom) : 'Room 304';

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[#94a3b8] leading-relaxed">
        <span className="text-[#e2e8f0]">{params?.occ ?? 60} occupants</span> start in{' '}
        <span className="text-emerald-300">{roomLabel}</span> (3rd floor) and evacuate through the corridor →
        stairwell → exits. Fire on the corridor. Toggle mitigations in the sidebar, then run analysis to compare
        casualties.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFloorIndex((f) => Math.max(0, f - 1))}
            disabled={floorIndex === 0}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium min-w-[8rem] text-center">
            {floorIndex + 1} / {storeys}
          </span>
          <button
            type="button"
            onClick={() => setFloorIndex((f) => Math.min(storeys - 1, f + 1))}
            disabled={floorIndex >= storeys - 1}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: storeys }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFloorIndex(i)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                floorIndex === i
                  ? 'bg-[#ff4d1c]/20 text-[#ff7a4d] border border-[#ff4d1c]/40'
                  : 'bg-white/5 text-[#64748b] border border-white/10'
              }`}
            >
              {FLOORS[i]?.name?.replace(/ .*/, '') ?? `F${i}`}
            </button>
          ))}
        </div>
      </div>

      <FloorPlanViewer
        floorIndex={floorIndex}
        agents={agents}
        fireLocation={fireLocation ?? params?.fireLocation}
        params={params}
        simResults={simResults}
        currentTime={currentTime}
        trajectoryHistory={trajectoryHistory}
      />

      {!hideScrubber && (
        <>
          <SimulationTimeline
            maxTime={effectiveMax}
            currentTime={currentTime}
            onChange={onTimeChange}
            events={timelineEvents}
            disabled={isRunning}
          />
          {isRunning && (
            <p className="text-[10px] text-[#64748b]">
              Live evacuation — agents move in sim time (pre-movement delay, corridors, exit queues). Scrubber unlocks when the run finishes.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SituationBoard2D;