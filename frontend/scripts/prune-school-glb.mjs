#!/usr/bin/env node
/**
 * Remove site/ground slabs from school_building.glb (meshes with depth > 35m in Z).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const inPath = path.resolve(process.argv[2] || path.join(frontendDir, 'public/assets/school_building.glb'));
const outPath = path.resolve(process.argv[3] || inPath);

const runner = `
globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const MAX_Z = 35;
const buf = fs.readFileSync(${JSON.stringify(inPath)});
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((r,j)=>loader.parse(ab,'',r,j));
const scene = gltf.scene;
const toRemove = [];
scene.traverse(o => {
  if (!o.isMesh) return;
  const b = new THREE.Box3().setFromObject(o);
  const s = b.getSize(new THREE.Vector3());
  if (s.z > MAX_Z) toRemove.push(o);
});
toRemove.forEach(m => m.parent?.remove(m));
console.log('Removed', toRemove.length, 'site meshes');

const exporter = new GLTFExporter();
const out = await exporter.parseAsync(scene, { binary: true });
fs.writeFileSync(${JSON.stringify(outPath)}, Buffer.from(out));
console.log('Wrote', ${JSON.stringify(outPath)});
`;

const tmp = path.join('/tmp', `prune_run_${Date.now()}.mjs`);
fs.writeFileSync(tmp, runner);
execSync(`node ${JSON.stringify(tmp)}`, { stdio: 'inherit', cwd: frontendDir });

const legacy = path.resolve(frontendDir, '../assets/school_building.glb');
fs.mkdirSync(path.dirname(legacy), { recursive: true });
fs.copyFileSync(outPath, legacy);

const configPath = path.join(frontendDir, 'src/config/schoolBuilding.js');
const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let cfg = fs.readFileSync(configPath, 'utf8');
cfg = cfg.replace(/SCHOOL_BUILDING_VERSION = '[^']*'/, `SCHOOL_BUILDING_VERSION = '${version}'`);
fs.writeFileSync(configPath, cfg);
console.log('Synced legacy + cache version', version);