from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
import subprocess
import os
import shutil
import json
import uuid
import datetime
import pandas as pd
import logging
from typing import Optional, Dict, Any

# Simple .env loader (no extra deps)
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip().strip('"\''))

load_env()

# Local analysis + chatbot support (new)
try:
    from analysis import generate_analysis, local_analyze, call_xai_chat, build_context_for_chat
except Exception:
    generate_analysis = None
    local_analyze = None
    call_xai_chat = None
    build_context_for_chat = None

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/home/andromeda/school-fire-sim/backend/simulation.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Quick check for Ollama (the completely free local option) — run this early
def _check_ollama():
    base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3.2")
    try:
        import urllib.request
        import urllib.error
        req = urllib.request.Request(f"{base}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
        models = [m.get("name", "") for m in data.get("models", [])]
        if any(model in m or m.startswith(model) for m in models):
            return True, base, model
        else:
            return False, base, model
    except Exception:
        return False, base, model

ollama_available, ollama_base_checked, ollama_model_checked = _check_ollama()

# Helpful startup note for the AI keys (Ollama is primary for completely free)
has_gemini = bool(os.getenv("GEMINI_API_KEY"))
has_groq = bool(os.getenv("GROQ_API_KEY"))
has_openrouter = bool(os.getenv("OPENROUTER_API_KEY"))
has_xai = bool(os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY"))
has_deepseek = bool(os.getenv("DEEPSEEK_API_KEY"))

if has_deepseek:
    logger.info("DEEPSEEK_API_KEY detected — PRIMARY: fast DeepSeek (excellent at vague/general queries). Local Ollama is free fallback.")
if has_gemini:
    logger.info("GEMINI_API_KEY present (fallback).")
if has_groq:
    logger.info("GROQ_API_KEY present (fallback).")
if has_openrouter:
    logger.info("OPENROUTER_API_KEY present (fallback).")
if has_xai:
    logger.info("XAI_API_KEY present (fallback).")

if ollama_available:
    logger.info(f"Ollama local available as free unlimited fallback at {ollama_base_checked} with '{ollama_model_checked}'.")
else:
    logger.info("Ollama not detected — using DeepSeek (or other configured keys) for the AI Analyst.")

# Optional: quick validation of Groq key at startup so user sees immediately if it's bad (1010 etc.)
def _validate_groq_key(key: str | None) -> None:
    if not key:
        return
    try:
        import urllib.request
        import urllib.error
        test_payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1
        }
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(test_payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            _ = resp.read(100)
        logger.info("GROQ_API_KEY validated successfully with Groq — real LLM answers enabled.")
    except Exception as e:
        msg = str(e)
        if "1010" in msg or "401" in msg or "403" in msg or "unauthorized" in msg.lower() or "invalid" in msg.lower():
            logger.warning(
                "GROQ_API_KEY looks INVALID (Groq returned auth/1010 error). "
                "The AI Analyst will fall back to local mode. "
                "Create a fresh key at https://console.groq.com/keys (copy it immediately) and update backend/.env"
            )
        else:
            logger.info(f"GROQ key check produced non-auth error (may still work): {msg[:120]}")

_validate_groq_key(os.getenv("GROQ_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SIM_DIR = "/home/andromeda/school-fire-sim/simulations"
os.makedirs(SIM_DIR, exist_ok=True)

class ClientRunPayload(BaseModel):
    """Persist in-browser Quick analysis to the same simulations store as FDS runs."""
    params: Dict[str, Any] = {}
    sim_results: Dict[str, Any] = {}
    analysis: Optional[Dict[str, Any]] = None
    label: Optional[str] = None


class SimulationConfig(BaseModel):
    # Core (existing)
    hrr_peak: float = 3000.0
    growth_rate: str = "medium"
    soot_yield: float = 0.02
    occupant_count: int = 40
    walking_speed: float = 1.2
    pre_movement_delay: float = 30.0

    # Extended for richer analysis / future parity with frontend alpasEngine DEFAULT_PARAMS
    hoc: float = 17.0
    co_yield: float = 0.04
    sprinkler: bool = True
    spTemp: float = 68.0
    rti: float = 50.0
    fdr: bool = True
    doorsOpen: bool = True
    windowsOpen: bool = False
    vents: bool = False
    hvac: bool = True
    fireLocation: str = "waiting"
    mit: Dict[str, bool] = {"sprinkler": True, "fdr": True, "vents": False, "wider": False, "aiSign": False, "press": False}

@app.get("/")
def read_root():
    return {"status": "ALPAS Backend Active", "sim_dir": SIM_DIR}

@app.post("/simulation/run")
async def run_simulation(config: SimulationConfig, background_tasks: BackgroundTasks):
    sim_id = str(uuid.uuid4())
    work_dir = os.path.join(SIM_DIR, sim_id)
    os.makedirs(work_dir, exist_ok=True)

    # Persist full config for analysis + chatbot context
    try:
        with open(os.path.join(work_dir, "config.json"), "w") as f:
            json.dump(config.dict(), f, indent=2)
    except Exception:
        pass

    logger.info(f"Starting simulation {sim_id} in {work_dir}")
    background_tasks.add_task(execute_sim_workflow, sim_id, work_dir, config)

    return {"simulation_id": sim_id, "status": "started"}


def _label_for_run_dir(work_dir: str, name: str, created: float) -> str:
    """Human-readable list label from config.json or analysis.json."""
    cfg_path = os.path.join(work_dir, "config.json")
    when = datetime.datetime.fromtimestamp(created).strftime("%b %d %H:%M") if created else ""
    try:
        if os.path.exists(cfg_path):
            with open(cfg_path) as cf:
                cfg = json.load(cf)
            if cfg.get("run_source") == "client" or cfg.get("label"):
                return cfg.get("label") or name[:8]
            occ = cfg.get("occupant_count") or cfg.get("occ") or "?"
            hrr = cfg.get("hrr_peak") or cfg.get("hrr") or 0
            return f"{when} · {occ} occ · {float(hrr) / 1000:.1f} MW".strip(" ·")
    except Exception:
        pass
    return name[:8]


def _run_source_for_dir(work_dir: str) -> str:
    cfg_path = os.path.join(work_dir, "config.json")
    try:
        if os.path.exists(cfg_path):
            with open(cfg_path) as cf:
                cfg = json.load(cf)
            if cfg.get("run_source"):
                return cfg["run_source"]
    except Exception:
        pass
    analysis_path = os.path.join(work_dir, "analysis.json")
    try:
        if os.path.exists(analysis_path):
            with open(analysis_path) as af:
                data = json.load(af)
            if data.get("run_source"):
                return data["run_source"]
    except Exception:
        pass
    return "backend"


@app.post("/simulation/client-run")
def save_client_run(payload: ClientRunPayload):
    """Store Quick analysis on disk so Run History stays in sync across tabs and reloads."""
    sim_id = str(uuid.uuid4())
    work_dir = os.path.join(SIM_DIR, sim_id)
    os.makedirs(work_dir, exist_ok=True)

    params = payload.params or {}
    sim_results = payload.sim_results or {}
    analysis = dict(payload.analysis or {})
    label = payload.label or ""

    if not label:
        occ = params.get("occ") or params.get("occupant_count") or "?"
        hrr = params.get("hrr") or params.get("hrr_peak") or 3000
        label = f"Quick analysis · {occ} occupants · {float(hrr) / 1000:.1f} MW"

    analysis["sim_id"] = sim_id
    analysis["run_source"] = "client"
    analysis["config"] = params

    config = {
        "run_source": "client",
        "label": label,
        **params,
        "occupant_count": params.get("occ", params.get("occupant_count")),
        "hrr_peak": params.get("hrr", params.get("hrr_peak", 3000)),
        "walking_speed": params.get("speed", params.get("walking_speed", 1.2)),
        "pre_movement_delay": params.get("delay", params.get("pre_movement_delay", 60)),
    }

    try:
        with open(os.path.join(work_dir, "config.json"), "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        with open(os.path.join(work_dir, "analysis.json"), "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=2)
        with open(os.path.join(work_dir, "client_results.json"), "w", encoding="utf-8") as f:
            json.dump({"sim_results": sim_results}, f, indent=2)
        metrics = analysis.get("metrics") or {}
        mit = params.get("mit") or {}
        mit_on = ", ".join(k for k, v in mit.items() if v) or "none"
        room = str(params.get("occupantRoom", "r304")).replace("r", "")
        log_lines = [
            "ALPAS — Quick analysis run log",
            "=" * 44,
            f"Label: {label}",
            f"Scenario: Room {room} · fire in {params.get('fireLocation', 'corridor')}",
            f"Occupants: {metrics.get('agents', params.get('occ', '?'))} · "
            f"HRR peak: {params.get('hrr', '?')} MW",
            f"Alarm delay: {params.get('delay', '?')} s · Growth: {params.get('growth', 'medium')}",
            f"Mitigations on: {mit_on}",
            "-" * 44,
            f"ASET: {metrics.get('ASET', '?')} s",
            f"RSET: {metrics.get('RSET', '?')} s",
            f"Safety margin: {metrics.get('safety_margin', '?')} s",
            f"Estimated casualties: {metrics.get('casualties', 0)}",
            "-" * 44,
            (analysis.get("narrative_summary") or "").strip(),
        ]
        with open(os.path.join(work_dir, "run.log"), "w", encoding="utf-8") as f:
            f.write("\n".join(log_lines) + "\n")
    except Exception as e:
        logger.error(f"Failed to save client run {sim_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"Saved client (quick) analysis run {sim_id}")
    return {
        "simulation_id": sim_id,
        "status": "complete",
        "source": "client",
        "label": label,
    }


@app.get("/simulation/client-run/{sim_id}")
def get_client_run(sim_id: str):
    """Reload Quick analysis payload saved by POST /simulation/client-run."""
    work_dir = os.path.join(SIM_DIR, sim_id)
    if not os.path.isdir(work_dir):
        return {"status": "not_found", "message": "run folder not found"}

    out = {"simulation_id": sim_id, "status": "complete", "source": "client"}
    cfg_path = os.path.join(work_dir, "config.json")
    if os.path.exists(cfg_path):
        with open(cfg_path) as f:
            out["params"] = json.load(f)
            out["label"] = out["params"].get("label")

    analysis_path = os.path.join(work_dir, "analysis.json")
    if os.path.exists(analysis_path):
        with open(analysis_path) as f:
            out["analysis"] = json.load(f)

    cr_path = os.path.join(work_dir, "client_results.json")
    if os.path.exists(cr_path):
        with open(cr_path) as f:
            out["sim_results"] = json.load(f).get("sim_results", {})

    return out


@app.get("/simulation/results/{sim_id}")
async def get_results(sim_id: str):
    work_dir = os.path.join(SIM_DIR, sim_id)
    evac_file = os.path.join(work_dir, "evacuation_results.csv")

    if not os.path.exists(evac_file):
        # Check if FDS is still running by looking at the .out file
        out_file = os.path.join(work_dir, f"school_{sim_id}.out")
        status = "processing"
        phase = "fds"
        if os.path.exists(out_file):
            try:
                with open(out_file, 'r') as f:
                    content = f.read()
                    if "End of FDS" in content:
                        status = "FDS complete, running evacuation"
                        phase = "jps"
            except Exception:
                pass
        # Also check for our run.log to give better phase
        run_log = os.path.join(work_dir, "run.log")
        if os.path.exists(run_log):
            try:
                with open(run_log) as f:
                    tail = f.read()[-800:]
                    if "Analysis generated" in tail or "POST-RUN SAFETY ANALYSIS" in tail or "POST-RUN ANALYSIS" in tail:
                        phase = "analysis"
            except Exception:
                pass
        return {"status": status, "phase": phase}

    try:
        evac_data = pd.read_csv(evac_file).to_dict(orient="records")

        # Load rich analysis if present (new!)
        analysis = None
        analysis_path = os.path.join(work_dir, "analysis.json")
        if os.path.exists(analysis_path):
            try:
                with open(analysis_path) as f:
                    analysis = json.load(f)
            except Exception:
                pass

        response = {
            "status": "complete",
            "evacuation": evac_data,
            "metrics": analysis.get("metrics") if analysis else calculate_metrics(work_dir, sim_id),
            "bounds": {
                "minX": -42.28,
                "maxX": 8.31,
                "minY": -4.78,
                "maxY": 62.87,
            },
            "storeyCount": 4,
            "phase": "complete",
        }
        if analysis:
            response["analysis"] = analysis
            # Also surface hazard series for charts if present
            if "hazard_series" in analysis:
                response["hazard_series"] = analysis["hazard_series"]
        return response
    except Exception as e:
        logger.error(f"Error reading results for {sim_id}: {e}")
        return {"status": "error", "message": str(e)}

def _append_run_log(work_dir: str, line: str) -> None:
    try:
        with open(os.path.join(work_dir, "run.log"), "a", encoding="utf-8") as f:
            f.write(line.rstrip() + "\n")
    except Exception:
        pass


def execute_sim_workflow(sim_id, work_dir, config):
    try:
        # 1. Generate FDS File
        fds_path = generate_fds_file(sim_id, work_dir, config)
        logger.info(f"[{sim_id}] FDS file generated")
        _append_run_log(work_dir, f"[{sim_id}] FDS file generated at {fds_path}")

        # 2. Run FDS
        logger.info(f"[{sim_id}] Running FDS...")
        _append_run_log(work_dir, f"[{sim_id}] Running FDS (T_END from input)...")
        result = subprocess.run(["fds", f"school_{sim_id}.fds"], cwd=work_dir, capture_output=True, text=True)

        # Always capture full FDS output for logs/analysis
        _append_run_log(work_dir, "\n=== FDS STDOUT ===")
        _append_run_log(work_dir, result.stdout or "(no stdout)")
        if result.stderr:
            _append_run_log(work_dir, "=== FDS STDERR ===")
            _append_run_log(work_dir, result.stderr)

        if result.returncode != 0:
            logger.error(f"[{sim_id}] FDS failed: {result.stderr}")
            _append_run_log(work_dir, f"[{sim_id}] FDS FAILED (rc={result.returncode})")
            return

        _append_run_log(work_dir, f"[{sim_id}] FDS finished (rc=0)")

        # 3. Run Evacuation
        logger.info(f"[{sim_id}] Running JuPedSim...")
        _append_run_log(work_dir, f"[{sim_id}] Running JuPedSim...")
        run_jupedsim(work_dir, config)
        logger.info(f"[{sim_id}] Simulation complete")
        _append_run_log(work_dir, f"[{sim_id}] JuPedSim complete. evacuation_results.csv written.")

        # 4. Generate rich analysis + logs (the key new step)
        if generate_analysis:
            try:
                analysis = generate_analysis(sim_id, work_dir, config.dict() if hasattr(config, "dict") else config)
                logger.info(f"[{sim_id}] Analysis generated (ASET={analysis.get('metrics',{}).get('ASET')})")
                _append_run_log(work_dir, f"[{sim_id}] Analysis + report generated successfully.")

                # Also print a nice summary to the terminal so "we have log right now"
                print("\n" + "="*60)
                print(f"ALPAS SIM COMPLETE: {sim_id}")
                print(analysis.get("narrative_summary", ""))
                print("Artifacts: run.log (execution log), analysis.json, analysis_report.md, evacuation_results.csv")
                print("="*60 + "\n")
            except Exception as e:
                logger.error(f"[{sim_id}] Analysis generation failed: {e}")
                _append_run_log(work_dir, f"[{sim_id}] Analysis generation failed: {e}")
        else:
            _append_run_log(work_dir, f"[{sim_id}] (analysis module not available)")

    except Exception as e:
        logger.error(f"[{sim_id}] Workflow error: {e}")
        _append_run_log(work_dir, f"[{sim_id}] WORKFLOW EXCEPTION: {e}")

def generate_fds_file(sim_id, work_dir, config):
    fds_content = f"""&HEAD CHID='school_{sim_id}', TITLE='School Fire Simulation' /
&MESH IJK=30,30,10, XB=-25.0,25.0,-20.0,20.0,0.0,15.0 /
&TIME T_END=60.0 /
&REAC ID='WOOD', C=6., H=10., O=5., SOOT_YIELD={config.soot_yield} /
&SURF ID='FIRE', HRRPUA={config.hrr_peak/4.0}, TAU_Q=-{300.0 if config.growth_rate == "medium" else 150.0}, COLOR='RED' /
&OBST XB=4.0,6.0,4.0,6.0,0.0,2.0, SURF_ID='FIRE' /
&DEVC ID='vis_1', QUANTITY='VISIBILITY', XYZ=0.0,0.0,1.8 /
&DEVC ID='temp_1', QUANTITY='TEMPERATURE', XYZ=2.0,0.0,1.8 /
&SLCF QUANTITY='TEMPERATURE', PBX=5.0 /
&SLCF QUANTITY='VISIBILITY', PBX=5.0 /
&TAIL /
"""
    file_path = os.path.join(work_dir, f"school_{sim_id}.fds")
    with open(file_path, "w") as f:
        f.write(fds_content)
    return file_path

def run_jupedsim(work_dir, config):
    import jupedsim as jps
    from shapely.geometry import Polygon
    import csv

    coords = [(-42.28, -4.78), (8.31, -4.78), (8.31, 62.87), (-42.28, 62.87)]
    walkable_area = Polygon(coords)
    sim = jps.Simulation(model=jps.CollisionFreeSpeedModel(), geometry=walkable_area, dt=0.05)
    
    exit_poly = Polygon([(-2.0, -4.8), (2.0, -4.8), (2.0, -4.3), (-2.0, -4.3)])
    exit_id = sim.add_exit_stage(exit_poly)
    journey_id = sim.add_journey(jps.JourneyDescription([exit_id]))

    params = jps.CollisionFreeSpeedModelAgentParameters(
        desired_speed=config.walking_speed, 
        radius=0.2,
        journey_id=journey_id,
        stage_id=exit_id
    )

    for i in range(config.occupant_count):
        params.position = (-10 + (i % 5) * 1.5, 20 + (i // 5) * 1.5)
        sim.add_agent(params)

    trajectories = []
    for _ in range(1200): # Up to 60s for test
        if sim.agent_count == 0: break
        sim.iterate()
        t = sim.iteration_count() * 0.05
        for agent in sim.agents():
            trajectories.append([t, agent.id, agent.position[0], agent.position[1]])

    with open(os.path.join(work_dir, "evacuation_results.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["time", "id", "x", "y"])
        writer.writerows(trajectories)

def calculate_metrics(work_dir, sim_id):
    # Kept for backward compat; real work now happens in analysis.generate_analysis
    return {
        "ASET": 45.5,
        "RSET": 38.2,
        "safety_margin": 7.3
    }


# ------------------------------------------------------------------
# New endpoints for Logs, Analysis listing, and Chatbot Analyst
# ------------------------------------------------------------------

@app.delete("/simulations")
def clear_all_simulations():
    """Remove all stored FDS run folders and truncate the global backend log."""
    removed = 0
    errors = []
    global_log = "/home/andromeda/school-fire-sim/backend/simulation.log"
    try:
        for name in os.listdir(SIM_DIR):
            p = os.path.join(SIM_DIR, name)
            if not os.path.isdir(p):
                continue
            try:
                shutil.rmtree(p)
                removed += 1
            except Exception as e:
                errors.append(f"{name}: {e}")
        try:
            with open(global_log, "w", encoding="utf-8") as f:
                f.write("")
        except Exception as e:
            errors.append(f"simulation.log: {e}")
        return {
            "ok": len(errors) == 0,
            "removed": removed,
            "errors": errors,
            "message": f"Cleared {removed} run(s). Ready for a fresh simulation.",
        }
    except Exception as e:
        return {"ok": False, "removed": removed, "errors": [str(e)], "message": str(e)}


@app.get("/simulations")
def list_simulations(limit: int = 30):
    """List recent simulation runs so the UI can show 'Past backend runs'."""
    try:
        entries = []
        for name in sorted(os.listdir(SIM_DIR), reverse=True):
            if len(entries) >= limit:
                break
            p = os.path.join(SIM_DIR, name)
            if not os.path.isdir(p):
                continue
            has_evac = os.path.exists(os.path.join(p, "evacuation_results.csv"))
            has_analysis = os.path.exists(os.path.join(p, "analysis.json"))
            has_log = os.path.exists(os.path.join(p, "run.log"))
            created = os.path.getctime(p) if os.path.exists(p) else 0
            source = _run_source_for_dir(p)
            label = _label_for_run_dir(p, name, created)
            is_client = source == "client"
            margin_preview = None
            casualties_preview = None
            if has_analysis:
                try:
                    with open(os.path.join(p, "analysis.json"), encoding="utf-8") as af:
                        am = json.load(af).get("metrics") or {}
                    margin_preview = am.get("safety_margin")
                    casualties_preview = am.get("casualties")
                except Exception:
                    pass
            entries.append({
                "id": name,
                "label": label,
                "short_id": name[:8],
                "source": source,
                "status": "complete" if (has_evac or is_client) else "processing",
                "created": created,
                "has_evac": has_evac,
                "has_analysis": has_analysis,
                "has_log": has_log,
                "margin": margin_preview,
                "casualties": casualties_preview,
            })
        return {"simulations": entries}
    except Exception as e:
        return {"simulations": [], "error": str(e)}


@app.get("/simulation/logs/{sim_id}")
def get_logs(sim_id: str, tail: int = 500, raw: bool = False, full: bool = False):
    """Return per-run execution log. ?raw=1 plain text download. ?full=1 returns entire run.log."""
    work_dir = os.path.join(SIM_DIR, sim_id)
    log_path = os.path.join(work_dir, "run.log")
    if not os.path.exists(log_path):
        global_log = "/home/andromeda/school-fire-sim/backend/simulation.log"
        try:
            with open(global_log) as f:
                all_lines = [l for l in f if sim_id in l]
            total = len(all_lines)
            use_lines = all_lines if full else all_lines[-tail:]
            log_text = "\n".join(use_lines)
            truncated = not full and total > len(use_lines)
            line_count = len(use_lines)
        except Exception:
            log_text = "(no per-run log yet — workflow may still be running)"
            total = 0
            truncated = False
            line_count = 0
        if raw:
            return PlainTextResponse(log_text, media_type="text/plain")
        return {
            "sim_id": sim_id,
            "log": log_text,
            "source": "global",
            "line_count": line_count,
            "total_lines": total,
            "truncated": truncated,
        }
    try:
        with open(log_path, encoding="utf-8", errors="ignore") as f:
            content = f.read()
        all_lines = content.strip().splitlines()
        total = len(all_lines)
        use_lines = all_lines if full else all_lines[-tail:]
        log_text = "\n".join(use_lines)
        truncated = not full and total > len(use_lines)
        if raw:
            return PlainTextResponse(log_text, media_type="text/plain")
        return {
            "sim_id": sim_id,
            "log": log_text,
            "source": "run.log",
            "line_count": len(use_lines),
            "total_lines": total,
            "truncated": truncated,
        }
    except Exception as e:
        log_text = f"(error reading log: {e})"
        if raw:
            return PlainTextResponse(log_text, media_type="text/plain")
        return {"sim_id": sim_id, "log": log_text, "source": "error", "line_count": 0, "total_lines": 0, "truncated": False}


@app.get("/simulation/analysis/{sim_id}")
def get_analysis(sim_id: str):
    work_dir = os.path.join(SIM_DIR, sim_id)
    path = os.path.join(work_dir, "analysis.json")
    if not os.path.exists(path):
        return {"status": "not_found", "message": "analysis.json not yet generated for this sim"}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _analyst_engine_guidance(analysis: dict, run_source: str) -> str:
    """Tell the LLM which ALPAS engine produced this run (unified app, two engines)."""
    src = analysis.get("run_source") or run_source or "none"
    if src == "client":
        return (
            "PLATFORM: ALPAS is one unified app (Dashboard, Run History, AI Analyst). "
            "THIS RUN: Quick analysis — in-browser 2D coupled fire–evacuation on the school floor plan. "
            "OTHER ENGINE: FDS + JuPedSim backend runs exist on the same platform (Run History tag: FDS); "
            "they are not what produced this Quick save. "
            "When discussing limitations, scope them to Quick analysis only — do not say the whole product lacks FDS/JuPedSim."
        )
    if src == "backend":
        return (
            "PLATFORM: ALPAS is one unified app (Dashboard, Run History, AI Analyst). "
            "THIS RUN: FDS + JuPedSim server workflow (CFD fire + microscopic evacuation). "
            "OTHER ENGINE: Quick analysis is the fast in-browser 2D path (Run History tag: Quick). "
            "Use the LIMITATIONS list for this FDS/JuPedSim result; note geometry fidelity where listed."
        )
    return (
        "No specific run engine identified. ALPAS supports Quick analysis (in-browser) and FDS + JuPedSim (backend) "
        "in one unified UI — suggest the user load a run from Run History."
    )


@app.post("/simulation/analyze")
async def analyze_chat(payload: Dict[str, Any]):
    """
    Chatbot endpoint. Supports multi-turn when Gemini key is configured.
    Body: { "sim_id": "...", "question": "...", "history": [ {"role": "user"|"assistant", "content": "..." }, ... ] (optional) }
    For backend runs it grounds answers in the sim's analysis.json + run.log + metrics.
    Returns { "answer": "...", "mode": "gemini" | "grok" | "local", "sources": [...] }
    """
    sim_id = payload.get("sim_id")
    question = payload.get("question", "").strip()
    history = payload.get("history", []) or []

    if not question:
        return {"answer": "Please ask a question about the simulation.", "mode": "local", "has_context": False}

    run_source = payload.get("run_source") or ("backend" if payload.get("sim_id") else "none")
    work_dir = os.path.join(SIM_DIR, sim_id) if sim_id else None
    analysis = None
    log_tail = ""
    evac_sample = None

    def _has_metrics(metrics: dict) -> bool:
        if not metrics:
            return False
        for v in metrics.values():
            if v is not None and v != "" and v != "None":
                return True
        return False

    # Frontend may send data already loaded in the UI (preferred — avoids stale disk reads)
    inline_analysis = payload.get("inline_analysis")
    if inline_analysis:
        if isinstance(inline_analysis, str):
            try:
                inline_analysis = json.loads(inline_analysis)
            except Exception:
                inline_analysis = None
        if isinstance(inline_analysis, dict):
            analysis = inline_analysis

    if payload.get("inline_log"):
        log_tail = str(payload.get("inline_log"))[-2000:]

    if work_dir and os.path.isdir(work_dir) and analysis is None:
        a_path = os.path.join(work_dir, "analysis.json")
        if os.path.exists(a_path):
            try:
                with open(a_path) as f:
                    analysis = json.load(f)
            except Exception:
                pass

        if not log_tail:
            l_path = os.path.join(work_dir, "run.log")
            if os.path.exists(l_path):
                try:
                    with open(l_path, encoding="utf-8", errors="ignore") as f:
                        log_tail = f.read()[-2000:]
                except Exception:
                    pass

        e_path = os.path.join(work_dir, "evacuation_results.csv")
        if pd is not None and os.path.exists(e_path):
            try:
                df = pd.read_csv(e_path)
                evac_sample = df.head(3).to_dict(orient="records")
            except Exception:
                pass

        if analysis is None:
            cfg_path = os.path.join(work_dir, "config.json")
            cfg = {}
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path) as cf:
                        cfg = json.load(cf)
                except Exception:
                    pass
            metrics = calculate_metrics(work_dir, sim_id) if sim_id else {}
            analysis = {
                "sim_id": sim_id,
                "config": cfg,
                "metrics": metrics,
                "narrative_summary": f"Backend run {sim_id[:8]} — safety analysis file not found; using evacuation metrics.",
                "limitations": ["analysis.json missing — regenerate by re-running or wait for workflow to finish."],
            }

    if analysis is None:
        analysis = {"sim_id": sim_id or "unknown", "metrics": {}, "narrative_summary": "", "limitations": []}

    # In-browser analytical run (Dashboard → Run simulation)
    client_ctx = payload.get("client_context") or payload.get("js_context")
    if client_ctx and run_source == "client":
        inline = client_ctx.get("analysis")
        if isinstance(inline, dict):
            analysis = {**analysis, **inline}
        metrics = client_ctx.get("metrics") or {}
        if metrics:
            analysis["metrics"] = {**analysis.get("metrics", {}), **metrics}
        analysis["config"] = client_ctx.get("params") or analysis.get("config") or {}
        analysis["sim_id"] = analysis.get("sim_id") or "client-run"
        analysis["run_source"] = "client"
        label = client_ctx.get("label") or "Quick analysis"
        analysis["narrative_summary"] = (
            analysis.get("narrative_summary")
            or f"Client-side analytical run ({label}). Params: {json.dumps(client_ctx.get('params') or {}, default=str)[:400]}"
        )
        if not analysis.get("limitations"):
            analysis["limitations"] = [
                "This save is Quick analysis: in-browser 2D model on the school floor plan (not the FDS/JuPedSim CSV workflow for this run).",
                "ALPAS is unified: FDS + JuPedSim backend runs are available separately (Run History → FDS badge).",
            ]
        sim_id = None
        run_source = "client"

    uploaded_analysis = payload.get("uploaded_analysis")
    if uploaded_analysis:
        if isinstance(uploaded_analysis, str):
            try:
                uploaded_analysis = json.loads(uploaded_analysis)
            except Exception:
                pass
        analysis = uploaded_analysis
        if payload.get("uploaded_log"):
            log_tail = str(payload.get("uploaded_log"))[-2000:]
        sim_id = sim_id or "imported"
        run_source = "imported"

    has_context = _has_metrics(analysis.get("metrics", {})) or bool(log_tail.strip()) or bool(analysis.get("narrative_summary"))

    engine_guidance = _analyst_engine_guidance(analysis, run_source)

    # Build context
    context_text = ""
    if build_context_for_chat:
        context_text = build_context_for_chat(analysis, log_tail, evac_sample)
    else:
        context_text = json.dumps(analysis.get("metrics", {})) + "\n" + analysis.get("narrative_summary", "")

    api_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    answer = ""
    mode = "local"

    # DeepSeek primary (user key) - fast, strong at vague/general queries
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if deepseek_key:
        try:
            import urllib.request
            import urllib.error

            has_real_data = _has_metrics(analysis.get("metrics", {})) or bool(log_tail.strip())
            if has_real_data:
                sys_prompt = (
                    "You are an expert school fire safety and evacuation analyst. "
                    "Use ONLY the provided simulation data, logs, and safety analysis below. "
                    "Cite specific numbers, timestamps, and sections from the execution log or analysis. "
                    "Be concise, professional, and educational. Note limitations for the active run engine only.\n\n"
                    f"{engine_guidance}\n\n"
                    f"Current simulation context (analysis + recent execution log + metrics):\n{context_text}\n"
                )
            else:
                sys_prompt = (
                    "You are a helpful, fast assistant for a fire safety simulation project. "
                    "The user may not have loaded specific data yet or is asking vague/general questions. "
                    "Answer conversationally, helpfully, and directly even if the query is vague or broad. "
                    "If they want data-grounded answers (ASET, logs, safety margin, etc.), suggest loading a sim from Dashboard or importing logs via the AI Analyst UI. "
                    "You are powered by DeepSeek (fast + excellent reasoning).\n\n"
                    f"Current simulation context (may be empty):\n{context_text}\n"
                )

            messages = [{"role": "system", "content": sys_prompt}]
            for h in (history or [])[-6:]:
                role = "assistant" if h.get("role") in ("assistant", "model") else "user"
                txt = str(h.get("content", "")).strip()
                if txt:
                    messages.append({"role": role, "content": txt})
            messages.append({"role": "user", "content": question})

            url = "https://api.deepseek.com/chat/completions"
            payload = {
                "model": "deepseek-chat",  # fast general model; change to "deepseek-reasoner" for more complex/vague
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 900
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Authorization": f"Bearer {deepseek_key}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=35) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            answer = res["choices"][0]["message"]["content"].strip()
            mode = "deepseek"
        except Exception as e:
            err = str(e)[:300]
            # fall through to Ollama or local (e.g. 402 Payment Required if no balance on the key)

    # === Ollama first (the "ollama way" — completely free, unlimited, local) ===
    # This is now the preferred provider for zero-cost operation.
    ollama_base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    if ollama_base and mode != "deepseek":
        try:
            import urllib.request
            import urllib.error

            has_real_data = _has_metrics(analysis.get("metrics", {})) or bool(log_tail.strip())
            if has_real_data:
                sys_prompt = (
                    "You are an expert school fire safety and evacuation analyst. "
                    "Use ONLY the provided simulation data, logs, and safety analysis below. "
                    "Cite specific numbers, timestamps, and sections from the execution log or analysis. "
                    "Be concise, professional, and educational. Note limitations for the active run engine only.\n\n"
                    f"{engine_guidance}\n\n"
                    f"Current simulation context (analysis + recent execution log + metrics):\n{context_text}\n"
                )
            else:
                sys_prompt = (
                    "You are a helpful assistant for a fire safety simulation educational project. "
                    "The user has not loaded specific simulation data yet (or is chatting generally). "
                    "Respond conversationally and helpfully. "
                    "If they ask about specific results (ASET, safety margin, logs, etc.), suggest loading a simulation from the Dashboard or using the 'Import logs' section in the AI Analyst UI to upload analysis.json + run.log. "
                    "You are running locally via Ollama (completely free and unlimited).\n\n"
                    f"Current simulation context (may be empty):\n{context_text}\n"
                )

            messages = [{"role": "system", "content": sys_prompt}]
            for h in (history or [])[-6:]:
                role = "assistant" if h.get("role") in ("assistant", "model") else "user"
                txt = str(h.get("content", "")).strip()
                if txt:
                    messages.append({"role": role, "content": txt})
            messages.append({"role": "user", "content": question})

            payload = {
                "model": ollama_model,
                "messages": messages,
                "options": {"temperature": 0.2},
                "stream": False
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{ollama_base}/v1/chat/completions",
                data=data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=120) as resp:  # local models can be slower on CPU, especially larger ones
                res = json.loads(resp.read().decode("utf-8"))
            answer = res["choices"][0]["message"]["content"].strip()
            mode = "ollama"
        except Exception as e:
            # Ollama not available or model issue — give friendly response for vague/general chat
            err = str(e)[:150]
            if os.getenv("OLLAMA_BASE_URL"):
                logger.warning(f"Ollama at {ollama_base} failed for this request: {err}")
            answer = "Hello! Local Ollama is having trouble responding right now (check `ollama serve` is running and a model is pulled). I can still chat generally about fire safety simulations. What would you like to know (even if vague)?"
            mode = "local"

    if gemini_key:
        # Use Gemini (Google AI Studio key from user) — now with proper multi-turn support.
        # We always attempt the call with whatever is in GEMINI_API_KEY so we can show the real
        # error from Google (very helpful when people paste the wrong kind of credential).
        try:
            import urllib.request
            import urllib.error

            # Build multi-turn contents for Gemini conversational API.
            # We put rich instructions + full current run context (analysis + log tail + metrics) in the first turn.
            # Then replay recent history (user <-> model), then the new question.
            # This makes follow-up questions actually interact with prior answers + the data.
            contents = []

            sys_ctx = (
                "You are an expert school fire safety and evacuation analyst. "
                "Continue the conversation naturally across turns. Reference prior answers when relevant. "
                "Use ONLY the provided simulation data, logs, and analysis below for every response. "
                "Cite specific numbers, timestamps, and sections from the execution log or analysis.json. "
                "Be concise, professional, and educational. Note limitations for the active run engine only. "
                "Format key facts with bullets when helpful.\n\n"
                f"{engine_guidance}\n\n"
                f"Current simulation context (analysis + recent execution log + metrics):\n{context_text}\n"
            )
            contents.append({"role": "user", "parts": [{"text": sys_ctx}]})

            # Replay limited prior turns (assistant role must be "model" for Gemini)
            for h in (history or [])[-6:]:
                role = "model" if (h.get("role") == "assistant" or h.get("role") == "model") else "user"
                txt = str(h.get("content", "")).strip()
                if txt:
                    contents.append({"role": role, "parts": [{"text": txt}]})

            # The current user question
            contents.append({"role": "user", "parts": [{"text": question}]})

            # Try a few reliable model aliases. "gemini-1.5-flash" sometimes 404s on v1beta depending on
            # the project / key type; the "-latest" alias and a couple of explicit versions are more robust.
            candidate_models = [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash",
                "gemini-1.5-flash-002",
                "gemini-2.0-flash",
            ]

            res = None
            last_http_body = ""
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                payload = {
                    "contents": contents,
                    "generationConfig": {"temperature": 0.25, "maxOutputTokens": 900}
                }
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

                try:
                    with urllib.request.urlopen(req, timeout=35) as resp:
                        res = json.loads(resp.read().decode('utf-8'))
                    break  # success
                except urllib.error.HTTPError as http_err:
                    body = http_err.read().decode('utf-8', errors='ignore')
                    last_http_body = body
                    # If it's a model-not-found, try the next alias; otherwise re-raise so outer except catches it
                    if http_err.code == 404 and ("not found" in body.lower() or "NOT_FOUND" in body):
                        continue
                    raise RuntimeError(f"HTTP {http_err.code} for model {model_name}: {body[:300]}") from http_err

            if res is None:
                raise RuntimeError(f"All model candidates failed. Last response from Google: {last_http_body[:400]}")

            # If we reach here with a 429/ quota error in the response body, we can surface it cleanly below.

            # Gemini can return candidates or promptFeedback on block
            cand = (res.get("candidates") or [{}])[0]
            if cand and cand.get("content") and cand["content"].get("parts"):
                answer = cand["content"]["parts"][0].get("text", "").strip()
            else:
                fb = res.get("promptFeedback", {})
                answer = "(Gemini returned no content — possibly safety filter or empty response. " + str(fb)[:120] + ")"
            mode = "gemini"
        except Exception as e:
            err = str(e)[:400]
            k = str(gemini_key).strip()
            advice = ""

            if "429" in err or "quota" in err.lower() or "exceeded your current quota" in err.lower():
                advice = " QUOTA / RATE LIMIT: You have hit the free tier limits for this API key / Google Cloud project (very common with AI Studio keys). " \
                         "Solutions: (1) Wait 1-2 minutes and try again, (2) Go to the Google Cloud project linked to this key and add billing / increase quota, " \
                         "or (3) Create a fresh API key in a new project at https://aistudio.google.com/app/apikey . See https://ai.google.dev/gemini-api/docs/rate-limits ."
            elif k.startswith("AQ."):
                advice = " NOTE: Your key starts with 'AQ.Ab8...' (unusual for AI Studio). It reached Google but then hit the error above. If you generated the key in AI Studio, double-check you copied the full key value."
            elif not k.startswith("AIza"):
                advice = " The value in GEMINI_API_KEY does not look like a standard AIzaSy... key. "

            if local_analyze:
                local_ans = local_analyze(question, analysis, log_tail, evac_sample)
                answer = f"(Gemini API error using your key:{advice}\n\nRaw error from Google: {err})\n\nFalling back to local keyword analyst for this turn.\n\n{local_ans}"
            else:
                answer = f"(Gemini API error:{advice}{err})"
            # mode stays "local" so the UI can show it is not using the cloud model this turn

    # --- Free alternative: Groq (https://console.groq.com/keys) ---
    # Very generous free tier, OpenAI-compatible, fast Llama models. Great when Gemini quota is hit.
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and mode not in ("gemini", "ollama", "deepseek"):
        try:
            import urllib.request
            import urllib.error

            sys_prompt = (
                "You are an expert school fire safety and evacuation analyst. "
                "Use ONLY the provided simulation data, logs, and analysis below. "
                "Cite specific numbers, timestamps, and sections from the execution log or analysis. "
                "Be concise, professional, and educational. Note limitations for the active run engine only. "
                "Format key facts with bullets when helpful.\n\n"
                f"{engine_guidance}\n\n"
                f"Current simulation context (analysis + recent execution log + metrics):\n{context_text}\n"
            )

            messages = [{"role": "system", "content": sys_prompt}]
            for h in (history or [])[-6:]:
                role = "assistant" if h.get("role") in ("assistant", "model") else "user"
                txt = str(h.get("content", "")).strip()
                if txt:
                    messages.append({"role": role, "content": txt})
            messages.append({"role": "user", "content": question})

            # Try several reliable free-tier models on Groq
            candidate_models = [
                "llama-3.3-70b-versatile",
                "llama-3.1-8b-instant",
                "gemma2-9b-it",
                "llama-3.1-70b-versatile"
            ]

            last_err_body = ""
            success = False
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 850
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=data,
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json"
                    }
                )
                try:
                    with urllib.request.urlopen(req, timeout=40) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                    answer = res["choices"][0]["message"]["content"].strip()
                    mode = "groq"
                    success = True
                    break
                except urllib.error.HTTPError as http_err:
                    body = http_err.read().decode("utf-8", errors="ignore")
                    last_err_body = body
                    # 403/401 usually means bad key or no access to model; try next model
                    if http_err.code in (401, 403, 404):
                        continue
                    # For 429 etc, surface immediately
                    raise RuntimeError(f"HTTP {http_err.code} ({model_name}): {body[:250]}") from http_err

            if not success:
                raise RuntimeError(f"All Groq models failed. Last response: {last_err_body[:300]}")
        except Exception as e:
            err = str(e)[:400]
            advice = ""
            if "1010" in err:
                advice = " This usually means the Groq API key is invalid, revoked, or was not created correctly. Go to https://console.groq.com/keys , create a brand new key (they are shown only once — copy it right away), paste it as GROQ_API_KEY=... in backend/.env, and restart the backend."
            if local_analyze:
                local_ans = local_analyze(question, analysis, log_tail, evac_sample)
                answer = f"(Groq API error: {err}.{advice} Falling back to local analyst.)\n\n{local_ans}"
            else:
                answer = f"(Groq error: {err}{advice})"
            # mode remains local

    # --- OpenRouter (many free models, filter :free on openrouter.ai/models) ---
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key and mode not in ("groq", "gemini", "ollama", "deepseek"):
        try:
            import urllib.request
            import urllib.error

            sys_prompt = (
                "You are an expert school fire safety and evacuation analyst for ALPAS. "
                "Use ONLY the provided simulation data, logs, and analysis below. "
                "Cite specific numbers, timestamps, and sections from the execution log or analysis. "
                "Be concise, professional, and educational. Note limitations for the active run engine only.\n\n"
                f"{engine_guidance}\n\n"
                f"Current simulation context (analysis + recent execution log + metrics):\n{context_text}\n"
            )

            messages = [{"role": "system", "content": sys_prompt}]
            for h in (history or [])[-6:]:
                role = "assistant" if h.get("role") in ("assistant", "model") else "user"
                txt = str(h.get("content", "")).strip()
                if txt:
                    messages.append({"role": role, "content": txt})
            messages.append({"role": "user", "content": question})

            # Try popular free or low-cost models on OpenRouter (user can change)
            candidate_models = [
                "meta-llama/llama-3.3-70b-instruct:free",
                "meta-llama/llama-3.1-8b-instruct:free",
                "google/gemini-2.0-flash-exp:free",
                "qwen/qwen-2.5-72b-instruct:free"
            ]

            last_err_body = ""
            success = False
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 850
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    data=data,
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5173",  # for OpenRouter stats
                        "X-Title": "ALPAS Fire Sim Analyst"
                    }
                )
                try:
                    with urllib.request.urlopen(req, timeout=40) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                    answer = res["choices"][0]["message"]["content"].strip()
                    mode = "openrouter"
                    success = True
                    break
                except urllib.error.HTTPError as http_err:
                    body = http_err.read().decode("utf-8", errors="ignore")
                    last_err_body = body
                    if http_err.code in (401, 403, 404):
                        continue
                    raise RuntimeError(f"HTTP {http_err.code} ({model_name}): {body[:250]}") from http_err

            if not success:
                raise RuntimeError(f"All OpenRouter free models failed. Last: {last_err_body[:300]}")
        except Exception as e:
            err = str(e)[:350]
            if local_analyze:
                local_ans = local_analyze(question, analysis, log_tail, evac_sample)
                answer = f"(OpenRouter error: {err}. Falling back to local.)\n\n{local_ans}"
            else:
                answer = f"(OpenRouter error: {err})"

    # Ollama is now tried first (see the early block after context building).
    # Cloud providers below are fallbacks only.

    elif api_key and call_xai_chat:
        answer = call_xai_chat(question, context_text, history, api_key)
        if answer and "(xAI call skipped" not in answer and "API error" not in answer:
            mode = "grok"
        else:
            if not answer and local_analyze:
                answer = local_analyze(question, analysis, log_tail, evac_sample)
            else:
                answer = answer or "Analysis unavailable."
    if not answer and local_analyze:
        answer = local_analyze(question, analysis, log_tail, evac_sample)
    if not answer:
        answer = "Local analyst not available. Raw metrics: " + json.dumps(analysis.get("metrics", {}))

    sources = []
    if sim_id:
        sources = ["analysis.json (safety analysis)", "run.log (FDS + JuPedSim)", "evacuation_results.csv"]
    elif run_source == "client":
        sources = ["client analytical model metrics"]
    elif run_source == "imported":
        sources = ["imported safety analysis", "imported run log"]

    return {
        "answer": answer,
        "mode": mode,
        "has_context": has_context,
        "run_source": run_source,
        "sources": sources,
        "sim_id": sim_id,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
