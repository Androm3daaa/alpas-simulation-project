import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Sprinkler3D
 *
 * Simple animated water jet / droplet visualization for active sprinklers.
 * Positioned in building-local space (see getSprinklerPositionsBuildingLocal).
 *
 * When the sprinkler system is active in the simulation params, these should be rendered
 * near the ceiling of the affected rooms.
 */
const Sprinkler3D = ({ positions = [], intensity = 1.0, active = true }) => {
  const countPerSprinkler = 14; // much denser for wow

  const allPositions = React.useMemo(() => {
    const arr = [];
    positions.forEach((pos, i) => {
      for (let j = 0; j < countPerSprinkler; j++) {
        arr.push({
          baseX: pos.x,
          baseY: pos.y,
          baseZ: pos.z,
          phase: (i * 1.1 + j * 0.19) % 1,
          speed: 2.1 + Math.random() * 0.9,
          lateral: (j % 3) * 0.7,
        });
      }
    });
    return arr;
  }, [positions]);

  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current || !active) return;

    const t = state.clock.elapsedTime;

    allPositions.forEach((p, idx) => {
      const phase = (p.phase + t * p.speed * 0.55) % 1;
      const fall = phase * 2.6 * intensity;

      const lateral = Math.sin(t * 4 + idx) * 0.09 * p.lateral;
      dummy.position.set(
        p.baseX + lateral,
        p.baseY - fall,
        p.baseZ + Math.cos(t * 3.2 + idx * 1.3) * 0.07
      );

      const s = 0.55 + Math.sin(t * 7 + idx) * 0.25;
      dummy.scale.set(s, s * 0.9, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active || positions.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, allPositions.length]}>
      <sphereGeometry args={[0.055, 4, 4]} />
      <meshStandardMaterial
        color="#7dd3fc"
        emissive="#0e7490"
        emissiveIntensity={0.4}
        transparent
        opacity={0.85}
        metalness={0.15}
        roughness={0.2}
      />
    </instancedMesh>
  );
};

export default Sprinkler3D;