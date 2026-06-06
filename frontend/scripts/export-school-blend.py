"""
Headless GLB export for school_building.blend (building only — no ALPAS agents).
"""
import sys

import bpy

argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1 :]
else:
    argv = []

out_path = argv[0] if argv else "/tmp/school_raw.glb"

AGENT_COLLECTIONS = {
    "Agents_60",
    "ALPAS_Demo_Agents",
    "ALPAS_Classroom_Agents",
    "ALPAS_Agents",
    "ALPAS_Animated_Agents",
}


def remove_collection(name):
    coll = bpy.data.collections.get(name)
    if not coll:
        return
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(coll)


for name in AGENT_COLLECTIONS:
    remove_collection(name)

if bpy.data.objects.get("Agents_Controller"):
    bpy.data.objects.remove(bpy.data.objects["Agents_Controller"], do_unlink=True)

# Drop demo agent cylinders (body meshes from create_60_agents.py)
for obj in list(bpy.data.objects):
    if obj.type != "MESH":
        continue
    base = obj.name.split(".")[0]
    if base == "Cylinder" or base.startswith("Agent"):
        bpy.data.objects.remove(obj, do_unlink=True)

for obj in list(bpy.data.objects):
    if obj.type not in {"MESH", "CURVE", "SURFACE", "META", "FONT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

mesh_count = sum(1 for o in bpy.data.objects if o.type == "MESH")
print(f"Exported GLB: {out_path} ({mesh_count} meshes)")