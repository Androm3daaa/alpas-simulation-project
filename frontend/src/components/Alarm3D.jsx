import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Pulsing alarm indicators at corridor anchors (after evacuation delay).
 */
const Alarm3D = ({ positions = [], active = false, currentTime = 0, delaySec = 60 }) => {
  const groupRef = useRef();
  const triggered = active && currentTime >= delaySec;

  useFrame((state) => {
    if (!groupRef.current || !triggered) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      if (!child.isMesh) return;
      const pulse = 0.85 + Math.sin(t * 6 + i * 1.2) * 0.15;
      child.scale.setScalar(pulse);
      if (child.material?.emissiveIntensity != null) {
        child.material.emissiveIntensity = 0.5 + Math.sin(t * 8 + i) * 0.35;
      }
    });
  });

  if (!triggered || positions.length === 0) return null;

  return (
    <group ref={groupRef}>
      {positions.map((p, i) => (
        <group key={`alarm-${p.floor}-${i}`} position={[p.x, p.y, p.z]}>
          <mesh>
            <sphereGeometry args={[0.45, 12, 12]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#f59e0b"
              emissiveIntensity={0.7}
              transparent
              opacity={0.85}
            />
          </mesh>
          <pointLight color="#fbbf24" intensity={1.2} distance={12} />
        </group>
      ))}
    </group>
  );
};

export default Alarm3D;