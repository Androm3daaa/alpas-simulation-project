#!/usr/bin/env node
/**
 * Re-import school from Blender .blend → optimized GLB for the web app.
 *
 * Usage:
 *   npm run import-building-blend
 *   node scripts/import-school-building-blend.mjs [path/to/school_building.blend]
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BLEND = '/home/andromeda/School_Fire_Project/school_building.blend';
const DEFAULT_OUT = path.resolve(__dirname, '../public/assets/school_building.glb');
const EXPORT_SCRIPT = path.resolve(__dirname, 'export-school-blend.py');

const blendPath = path.resolve(process.argv[2] || DEFAULT_BLEND);
const outPath = path.resolve(process.argv[3] || DEFAULT_OUT);

const BLENDER_CANDIDATES = [
  'flatpak run --command=blender org.blender.Blender',
  'blender',
  '/usr/bin/blender',
];

function runBlender(cmd) {
  const workDir = path.resolve(__dirname, '../.import-work');
  fs.mkdirSync(workDir, { recursive: true });
  const rawGlb = path.join(workDir, 'school_raw.glb');

  console.log('Blend source:', blendPath);
  console.log('Exporting GLB with Blender (may take 1–3 min)...');
  execSync(
    `${cmd} -b "${blendPath}" --python "${EXPORT_SCRIPT}" -- "${rawGlb}"`,
    { stdio: 'inherit', env: { ...process.env, HOME: process.env.HOME } }
  );

  if (!fs.existsSync(rawGlb)) {
    throw new Error(`Blender export failed — missing ${rawGlb}`);
  }

  console.log('Packing GLB (copy/dedup — meshopt skipped, was inflating file size)...');
  execSync(`npx --yes @gltf-transform/cli copy "${rawGlb}" "${outPath}"`, { stdio: 'inherit' });

  return workDir;
}

if (!fs.existsSync(blendPath)) {
  console.error('Blend file not found:', blendPath);
  process.exit(1);
}

let lastErr = null;
for (const candidate of BLENDER_CANDIDATES) {
  try {
    runBlender(candidate);
    lastErr = null;
    break;
  } catch (e) {
    lastErr = e;
    console.warn(`Blender candidate failed (${candidate}):`, e.message || e);
  }
}

if (lastErr) {
  console.error('No working Blender install found. Install Blender or Flatpak org.blender.Blender.');
  process.exit(1);
}

const legacyOut = path.resolve(__dirname, '../../assets/school_building.glb');
fs.mkdirSync(path.dirname(legacyOut), { recursive: true });
fs.copyFileSync(outPath, legacyOut);

const configPath = path.resolve(__dirname, '../src/config/schoolBuilding.js');
const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let cfg = fs.readFileSync(configPath, 'utf8');
cfg = cfg.replace(/SCHOOL_BUILDING_VERSION = '[^']*'/, `SCHOOL_BUILDING_VERSION = '${version}'`);
cfg = cfg.replace(/sourceBlend: '[^']*'/, `sourceBlend: '${blendPath.replace(/'/g, "\\'")}'`);
fs.writeFileSync(configPath, cfg);

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`Done: ${outPath} (${mb} MB)`);
console.log(`Synced: ${legacyOut}`);
console.log(`Cache version: ${version}`);