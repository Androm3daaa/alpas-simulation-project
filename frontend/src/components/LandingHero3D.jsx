import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import { useSchoolBuilding } from '../hooks/useSchoolBuilding';
import * as THREE from 'three';

// Lightweight school model loader (re-uses the same GLB)
const SchoolModel = ({ scale = 1, position = [0, 0, 0] }) => {
  const { scene } = useSchoolBuilding();
  if (!scene) return null;
  return <primitive object={scene} scale={scale} position={position} />;
};

// Cinematic slow-orbiting camera controller for hero
const HeroCamera = ({ radius = 52, height = 32, speed = 0.035 }) => {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * speed;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius * 0.82; // slight ellipse for nicer angles
    groupRef.current.position.set(x, height, z);
    groupRef.current.lookAt(0, 6, 0); // look toward center of building
  });

  return <PerspectiveCamera ref={groupRef} makeDefault fov={46} near={1} far={400} />;
};

// Subtle atmospheric fire + smoke particles (cinematic, not full sim)
const HeroFireSmoke = ({ intensity = 0.9 }) => {
  const fireRef = useRef();
  const smokeRef = useRef();

  const firePositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 65; i++) {
      arr.push(
        (Math.random() - 0.5) * 2.8,
        Math.random() * 2.4 + 0.4,
        (Math.random() - 0.5) * 2.8
      );
    }
    return new Float32Array(arr);
  }, []);

  const smokePositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 110; i++) {
      arr.push(
        (Math.random() - 0.5) * 5.5,
        2.2 + Math.random() * 7,
        (Math.random() - 0.5) * 5.5
      );
    }
    return new Float32Array(arr);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (fireRef.current) {
      const pos = fireRef.current.geometry.attributes.position;
      const spd = 0.07 * intensity;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y = (y + spd) % 2.6;
        pos.setY(i, y);
        // slight horizontal drift
        const x = pos.getX(i);
        pos.setX(i, x + Math.sin(t * 1.8 + i) * 0.003);
      }
      pos.needsUpdate = true;
    }

    if (smokeRef.current) {
      const pos = smokeRef.current.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += 0.014;
        if (y > 13) y = 1.8 + Math.random() * 0.6;
        pos.setY(i, y);
        const x = pos.getX(i);
        pos.setX(i, x + Math.sin(t * 0.7 + i * 0.6) * 0.008);
      }
      pos.needsUpdate = true;
    }
  });

  // Position tuned for the school model (slightly in front / side)
  const fireBase = [2.5, 7.5, -3.5];

  return (
    <group position={fireBase}>
      {/* Fire particles */}
      <points ref={fireRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={firePositions.length / 3}
            array={firePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.38}
          color="#ff4a1f"
          transparent
          opacity={0.9 * intensity}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Smoke particles */}
      <points ref={smokeRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={smokePositions.length / 3}
            array={smokePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.25}
          color="#3a4758"
          transparent
          opacity={0.38 * intensity}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Warm fire light */}
      <pointLight
        position={[0, 1.2, 0]}
        color="#ff9a4d"
        intensity={2.6 * intensity}
        distance={48}
      />
    </group>
  );
};

const LandingHero3D = ({ className = '', showFire = true }) => {
  return (
    <div className={`relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden bg-[#050608]/70 border border-white/10 shadow-2xl ring-1 ring-white/5 backdrop-blur-[1px] ${className}`}>
      <Canvas
        style={{ background: 'transparent', display: 'block', width: '100%', height: '100%' }}
        gl={{ 
          antialias: true, 
          alpha: false, 
          preserveDrawingBuffer: false,
          powerPreference: "high-performance"
        }}
      >
        <HeroCamera />

        <ambientLight intensity={0.28} />
        <directionalLight 
          position={[-18, 42, -12]} 
          intensity={0.85} 
          color="#e8f0ff" 
        />

        <Suspense fallback={null}>
          {/* Main building - positioned and scaled to look good in cinematic framing */}
          <group position={[0, -8.5, 0]} scale={0.95}>
            <SchoolModel />
          </group>

          {/* Atmospheric fire/smoke to immediately signal the product's purpose */}
          {showFire && <HeroFireSmoke intensity={0.85} />}

          <Environment preset="city" />
        </Suspense>

        {/* Very subtle fog for depth */}
        <fog attach="fog" args={['#050608', 38, 135]} />
      </Canvas>

      {/* Overlay chrome */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_0.6px,transparent_1px)] bg-[length:3px_3px] pointer-events-none" />

      {/* Bottom-left status badge */}
      <div className="absolute bottom-4 left-4 z-10 px-3 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] font-mono tracking-[1.5px] text-[#ff7a4d] border border-white/10 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#ff4d1c] animate-pulse" />
        LIVE 3D PREVIEW
      </div>

      {/* Top-right tech label — safely inset so it never touches edges or overlaps other elements */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-md bg-black/70 backdrop-blur text-[9px] font-mono tracking-[1.5px] text-[#8a9099] border border-white/10">
        SCHOOL BUILDING • FDS + AGENT MODEL
      </div>
    </div>
  );
};

export default LandingHero3D;
