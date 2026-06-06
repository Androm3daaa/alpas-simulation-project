#!/usr/bin/env node
/**
 * Re-import Uncle Mugen's School from SketchUp DAE → optimized GLB.
 *
 * Usage:
 *   node scripts/import-school-building.mjs [path/to/model.dae] [output.glb]
 *
 * Default DAE:
 *   ~/Downloads/uncle-mugens-school-building/source/Uncle+Mugen's+School+Building/model.dae
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DAE =
  "/home/andromeda/Downloads/uncle-mugens-school-building/source/Uncle+Mugen's+School+Building/model.dae";
const DEFAULT_OUT = path.resolve(__dirname, '../public/assets/school_building.glb');

const daePath = path.resolve(process.argv[2] || DEFAULT_DAE);
const outPath = path.resolve(process.argv[3] || DEFAULT_OUT);
const workDir = path.join('/tmp', `school_import_${Date.now()}`);

if (!fs.existsSync(daePath)) {
  console.error('DAE not found:', daePath);
  process.exit(1);
}

fs.mkdirSync(workDir, { recursive: true });
const daeDir = path.dirname(daePath);
fs.copyFileSync(daePath, path.join(workDir, 'model.dae'));
const modelTex = path.join(daeDir, 'model');
if (fs.existsSync(modelTex)) {
  fs.cpSync(modelTex, path.join(workDir, 'model'), { recursive: true });
}

const rawGlb = path.join(workDir, 'school_raw.glb');
console.log('Exporting DAE with assimp (this may take ~3 min)...');
execSync(`assimp export "${path.join(workDir, 'model.dae')}" "${rawGlb}"`, {
  stdio: 'inherit',
  cwd: workDir,
});

console.log('Optimizing (merge/weld/simplify/meshopt)...');
execSync(
  `npx --yes @gltf-transform/cli optimize "${rawGlb}" "${outPath}" --texture-compress false --simplify 0.35 --weld --prune --flatten`,
  { stdio: 'inherit', cwd: workDir }
);

const legacyOut = path.resolve(__dirname, '../../assets/school_building.glb');
fs.mkdirSync(path.dirname(legacyOut), { recursive: true });
fs.copyFileSync(outPath, legacyOut);

// Bump cache-bust version in app config
const configPath = path.resolve(__dirname, '../src/config/schoolBuilding.js');
const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let cfg = fs.readFileSync(configPath, 'utf8');
cfg = cfg.replace(/SCHOOL_BUILDING_VERSION = '[^']*'/, `SCHOOL_BUILDING_VERSION = '${version}dae'`);
cfg = cfg.replace(/sourceBlend:[^\n]*/, `sourceDae:\n    "${daePath.replace(/\\/g, '/')}"`);
cfg = cfg.replace(/name: '[^']*'/, `name: "Uncle Mugen's School Building"`);
fs.writeFileSync(configPath, cfg);

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`Done: ${outPath} (${mb} MB) — default app GLB`);
console.log(`Synced: ${legacyOut}`);
console.log(`Updated cache version: ${version}`);