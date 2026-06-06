import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { extendGLTFLoader } from '../lib/gltfLoaderSetup';
import { SCHOOL_BUILDING_URL } from '../config/schoolBuilding';

/**
 * Each viewer gets its own cloned scene — never mount the cached useGLTF root
 * in two places (landing + 3D tab), or WebGL goes black / blank.
 */
export function useSchoolBuilding() {
  const gltf = useGLTF(SCHOOL_BUILDING_URL, false, true, extendGLTFLoader);
  const scene = useMemo(() => {
    if (!gltf?.scene) return null;
    return gltf.scene.clone(true);
  }, [gltf.scene]);

  return { scene, nodes: gltf.nodes, materials: gltf.materials };
}

export function preloadSchoolBuilding() {
  useGLTF.preload(SCHOOL_BUILDING_URL, false, true, extendGLTFLoader);
}