/**
 * Default 3D building for the entire web app.
 * Source: Uncle Mugen SketchUp DAE → GLB.
 * Re-import: `npm run import-building` (from frontend/)
 */
export const SCHOOL_BUILDING_GLB = 'school_building.glb';

/** Bump ?v= when you run import-building so browsers drop cached GLBs */
export const SCHOOL_BUILDING_VERSION = '20260603dae';

export const SCHOOL_BUILDING_URL = `/assets/${SCHOOL_BUILDING_GLB}?v=${SCHOOL_BUILDING_VERSION}`;

/** User-facing name for the 3D reference building (generic, not tied to asset author). */
export const BUILDING_DISPLAY_NAME = 'SCHOOL BUILDING';

export const SCHOOL_BUILDING_META = {
  name: BUILDING_DISPLAY_NAME,
  sourceDae:
    "/home/andromeda/Downloads/uncle-mugens-school-building/source/Uncle+Mugen's+School+Building/model.dae",
  optimized: true,
};