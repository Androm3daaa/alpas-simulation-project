import React, { Suspense, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera, PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  calibrateFromScene,
  agentToBuildingLocal,
  roomIdToBuildingLocal,
  getSprinklerPositionsBuildingLocal,
  getAlarmPositionsBuildingLocal,
} from '../lib/buildingCalibration';
import {
  agentToWorld3D,
  getFireBasePosition3D,
  getSprinklerPositions3D,
  getAlarmPositions3D,
  getSprinklerActivationSec,
  getFloorIndexForRoom,
} from '../lib/alpasEngine';
import { useSchoolBuilding } from '../hooks/useSchoolBuilding';
import { BUILDING_DISPLAY_NAME } from '../config/schoolBuilding';
import Sprinkler3D from './Sprinkler3D';
import Alarm3D from './Alarm3D';

const HIDDEN_Y = -200;
const MAX_VISIBLE_AGENTS = 120;

const SchoolModel = ({ onSceneReady }) => {
  const { scene } = useSchoolBuilding();
  const reported = useRef(false);

  useEffect(() => {
    reported.current = false;
  }, [scene]);

  useEffect(() => {
    if (!scene || !onSceneReady || reported.current) return;
    reported.current = true;
    onSceneReady(scene);
  }, [scene, onSceneReady]);

  if (!scene) return null;
  return <primitive object={scene} />;
};

const BuildingShell = ({ onSceneReady, xrayMode = false }) => {
  const groupRef = useRef();

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        mat.transparent = xrayMode;
        mat.opacity = xrayMode ? 0.45 : 1;
        mat.depthWrite = !xrayMode;
        mat.needsUpdate = true;
      });
    });
  }, [xrayMode]);

  return (
    <group ref={groupRef}>
      <SchoolModel onSceneReady={onSceneReady} />
    </group>
  );
};

const CameraFrame = ({ buildingAlign }) => {
  const { camera } = useThree();
  const framed = useRef(false);

  useEffect(() => {
    framed.current = false;
  }, [buildingAlign?.scale]);

  useEffect(() => {
    if (!buildingAlign?.box || framed.current) return;
    framed.current = true;
    camera.position.set(32, 24, 32);
    camera.lookAt(0, 6, 0);
    camera.updateProjectionMatrix();
  }, [buildingAlign, camera]);

  return null;
};

const AgentMesh = ({ data, floorFilter, buildingAlign }) => {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorRef = useMemo(() => new THREE.Color(), []);

  const agents = useMemo(() => {
    if (!data?.length) return [];
    if (floorFilter === 'all') return data.slice(0, MAX_VISIBLE_AGENTS);
    const f = Number(floorFilter);
    return data.filter((ag) => (ag.floor ?? 0) === f).slice(0, MAX_VISIBLE_AGENTS);
  }, [data, floorFilter]);

  const count = agents.length;
  const useGlb = !!buildingAlign?.box;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const placeHidden = (i) => {
      dummy.position.set(0, HIDDEN_Y, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };

    for (let i = 0; i < count; i++) {
      const ag = agents[i];
      if (!ag || ag.evacuated) {
        placeHidden(i);
        continue;
      }
      const local = useGlb ? agentToBuildingLocal(ag, buildingAlign) : agentToWorld3D(ag);
      if (!local) {
        placeHidden(i);
        continue;
      }
      if (ag.casualty) {
        dummy.position.set(local.x, local.y - 0.12, local.z);
        colorRef.set('#ef4444');
      } else {
        dummy.position.set(local.x, local.y, local.z);
        if (ag.moving) dummy.position.y += Math.sin(state.clock.elapsedTime * 9 + i) * 0.03;
        colorRef.set(ag.moving ? '#60a5fa' : '#facc15');
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorRef);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <capsuleGeometry args={[0.22, 0.5, 4, 6]} />
      <meshStandardMaterial metalness={0.15} roughness={0.7} />
    </instancedMesh>
  );
};

const FireOrigin = ({ fireLocation = 'waiting', currentTime = 0, params = null, buildingAlign }) => {
  const fireRef = useRef();
  const lightRef = useRef();
  const floorIndex = getFloorIndexForRoom(fireLocation);

  const basePos = useMemo(() => {
    if (buildingAlign?.box) {
      const local = roomIdToBuildingLocal(fireLocation, buildingAlign, 0.2);
      if (local) return [local.x, local.y, local.z];
    }
    return getFireBasePosition3D(fireLocation, floorIndex);
  }, [fireLocation, buildingAlign, floorIndex]);

  const sprinklerOn = !!params?.sprinkler;
  const suppressed = sprinklerOn && currentTime > 40;
  const fireCount = suppressed ? 18 : 32;

  const firePositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < fireCount; i++) {
      arr.push((Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4);
    }
    return new Float32Array(arr);
  }, [fireCount]);

  useFrame((state) => {
    if (!fireRef.current) return;
    const pos = fireRef.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y = (y + 0.06) % 1.2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    if (lightRef.current) {
      lightRef.current.intensity = 1.8 + Math.sin(state.clock.elapsedTime * 7) * 0.8;
    }
  });

  return (
    <group position={basePos}>
      <mesh>
        <sphereGeometry args={[0.35, 10, 10]} />
        <meshStandardMaterial color="#ff5722" emissive="#ff3d00" emissiveIntensity={1.2} />
      </mesh>
      <points ref={fireRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={fireCount} array={firePositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.22} color="#ff6b35" transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>
      <pointLight ref={lightRef} color="#ff8844" intensity={2} distance={14} />
    </group>
  );
};

const BuildingAlignedRoot = ({ buildingAlign, modelOffsetY, sceneScale, onSceneReady, xrayMode, children }) => {
  const ready = !!buildingAlign?.box;
  const pos = buildingAlign?.position ?? [0, modelOffsetY, 0];
  const scl = buildingAlign?.scale ?? sceneScale;

  return (
    <group position={pos} scale={[scl, scl, scl]}>
      <BuildingShell onSceneReady={onSceneReady} xrayMode={xrayMode} />
      {children}
    </group>
  );
};

const SimulationViewer = ({
  evacData,
  currentTime,
  buildingReference = false,
  fireLocation,
  params,
  onClearData,
  hasRealData = false,
  modelOffsetY = 0,
  sceneScale = 1,
  showAgents = true,
  showFire = true,
  showSprinklers = true,
  showAlarm = true,
  sprinklerActive = false,
  xrayMode = false,
  playbackMode = null,
  floorFilter = 'all',
  onCalibration,
  buildingAlign = null,
}) => {
  const [isFreeFly, setIsFreeFly] = useState(false);

  const handleSceneReady = useCallback(
    (scene) => {
      if (!onCalibration) return;
      try {
        onCalibration(calibrateFromScene(scene));
      } catch (err) {
        console.error('[SimulationViewer] calibration failed', err);
      }
    },
    [onCalibration]
  );

  const calibrated = !!buildingAlign?.box;

  const sprinklerPositions = useMemo(() => {
    if (!showSprinklers) return [];
    const all = calibrated
      ? getSprinklerPositionsBuildingLocal(buildingAlign)
      : getSprinklerPositions3D('all');
    if (floorFilter === 'all') return all;
    const f = Number(floorFilter);
    return all.filter((p) => p.floor === f);
  }, [showSprinklers, buildingAlign, calibrated, floorFilter]);

  const alarmPositions = useMemo(() => {
    if (!showAlarm) return [];
    return calibrated
      ? getAlarmPositionsBuildingLocal(buildingAlign, floorFilter)
      : getAlarmPositions3D(floorFilter);
  }, [showAlarm, buildingAlign, calibrated, floorFilter]);

  const sprinklerLive = sprinklerActive && currentTime >= getSprinklerActivationSec();
  const showOrbit = !isFreeFly;

  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl relative">
      <Canvas
        shadows={!isFreeFly}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.shadowMap.enabled = !isFreeFly;
        }}
      >
        <color attach="background" args={['#0f172a']} />
        <PerspectiveCamera makeDefault position={[32, 24, 32]} fov={42} />
        <CameraFrame buildingAlign={buildingAlign} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[20, 30, 15]} intensity={0.85} castShadow={!isFreeFly} />
        <pointLight position={[10, 20, 10]} intensity={0.5} />

        <Suspense fallback={null}>
          <BuildingAlignedRoot
            buildingAlign={buildingAlign}
            modelOffsetY={modelOffsetY}
            sceneScale={sceneScale}
            onSceneReady={handleSceneReady}
            xrayMode={xrayMode}
          >
            {showAgents && (
              <AgentMesh data={evacData} floorFilter={floorFilter} buildingAlign={buildingAlign} />
            )}
            {showFire && (
              <FireOrigin
                fireLocation={fireLocation}
                currentTime={currentTime}
                params={params}
                buildingAlign={buildingAlign}
              />
            )}
            {showSprinklers && (
              <Sprinkler3D positions={sprinklerPositions} active={sprinklerLive} intensity={0.85} />
            )}
            {showAlarm && (
              <Alarm3D
                positions={alarmPositions}
                active
                currentTime={currentTime}
                delaySec={params?.delay ?? 60}
              />
            )}
          </BuildingAlignedRoot>
          <Environment preset="city" />
          <ContactShadows position={[0, 0, 0]} opacity={0.25} scale={80} blur={3} far={6} />
        </Suspense>

        {showOrbit && <OrbitControls makeDefault enableDamping dampingFactor={0.1} target={[0, 5, 0]} />}
        {isFreeFly && <PointerLockControls />}
      </Canvas>

      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
        <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg font-mono backdrop-blur pointer-events-auto flex items-center gap-2">
          {hasRealData && (
            <span className="bg-emerald-500/80 text-white px-1.5 py-px rounded text-[10px] font-sans">
              {buildingReference
                ? 'BUILDING'
                : playbackMode === 'backend'
                  ? 'JUPEDSIM'
                  : 'SNAPSHOT'}
            </span>
          )}
          {calibrated ? BUILDING_DISPLAY_NAME : `Loading ${BUILDING_DISPLAY_NAME}…`}
        </div>
        <div className="flex gap-2 pointer-events-auto">

          <button
            onClick={() => setIsFreeFly(!isFreeFly)}
            className="bg-black/70 hover:bg-black/90 text-white px-4 py-1.5 text-xs rounded-lg"
          >
            {isFreeFly ? 'Exit Free Fly' : 'Free Fly'}
          </button>
          {hasRealData && onClearData && (
            <button onClick={onClearData} className="bg-red-500/70 text-white px-3 py-1.5 text-xs rounded-lg">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationViewer;