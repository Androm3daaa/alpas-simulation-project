/**
 * Convert Uncle Mugen school DAE → optimized GLB for the web viewer.
 * Merges geometry by material to cut draw calls (SketchUp DAE has 10k+ nodes).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DAE =
  "/home/andromeda/Downloads/uncle-mugens-school-building/source/Uncle+Mugen's+School+Building/model.dae";
const daePath = process.argv[2] || DEFAULT_DAE;
const outPath =
  process.argv[3] ||
  path.join(__dirname, '../public/assets/school_building.glb');

if (!fs.existsSync(daePath)) {
  console.error('DAE not found:', daePath);
  process.exit(1);
}

const resourcePath = path.dirname(daePath) + path.sep;
const METERS_PER_INCH = 0.0254;

const PALETTE = {
  wall: 0xe8e4dc,
  glass: 0x88b4d8,
  roof: 0x9aa3ad,
  ground: 0x6b7280,
  default: 0xd1d5db,
};

function pickColor(material) {
  const name = (material?.name || '').toLowerCase();
  if (name.includes('glass') || name.includes('window')) return PALETTE.glass;
  if (name.includes('roof')) return PALETTE.roof;
  if (name.includes('ground') || name.includes('grass')) return PALETTE.ground;
  if (name.includes('color_') || name.includes('wall') || name.includes('brick')) return PALETTE.wall;
  return PALETTE.default;
}

function loadCollada() {
  const text = fs.readFileSync(daePath, 'utf8');
  const loader = new ColladaLoader();
  const collada = loader.parse(text, resourcePath);
  return collada.scene;
}

function simplifyMaterials(root) {
  const byKey = new Map();

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geom = child.geometry.clone();
    child.updateWorldMatrix(true, false);
    geom.applyMatrix4(child.matrixWorld);

    const srcMat = Array.isArray(child.material) ? child.material[0] : child.material;
    const color = pickColor(srcMat);
    const key = `c_${color}`;

    if (!byKey.has(key)) byKey.set(key, { color, geometries: [] });
    byKey.get(key).geometries.push(geom);
  });

  const merged = new THREE.Group();
  merged.name = 'SchoolBuilding';

  for (const { color, geometries } of byKey.values()) {
    const mergedGeom = mergeGeometries(geometries, false);
    if (!mergedGeom) continue;
    mergedGeom.computeVertexNormals();
    const mesh = new THREE.Mesh(
      mergedGeom,
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.05,
        roughness: 0.85,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    merged.add(mesh);
    geometries.forEach((g) => g.dispose());
  }

  return merged;
}

function exportGlb(object) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result));
        else reject(new Error('Expected binary GLB'));
      },
      reject,
      { binary: true, onlyVisible: true, truncateDrawRange: true }
    );
  });
}

console.log('Loading', daePath);
const scene = loadCollada();

scene.scale.setScalar(METERS_PER_INCH);

const building = simplifyMaterials(scene);
building.updateMatrixWorld(true);

const box = new THREE.Box3().setFromObject(building);
const center = box.getCenter(new THREE.Vector3());
building.position.sub(center);
building.position.y -= box.min.y;

const size = box.getSize(new THREE.Vector3());
console.log('Merged meshes:', building.children.length);
console.log('BBox size (m):', size.toArray().map((v) => v.toFixed(2)));

const glb = await exportGlb(building);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, glb);
console.log('Wrote', outPath, `(${(glb.length / 1024 / 1024).toFixed(2)} MB)`);

building.traverse((c) => {
  c.geometry?.dispose?.();
  c.material?.dispose?.();
});