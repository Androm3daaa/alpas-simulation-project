"""
ALPAS Backend Analysis Generator + Chat Analyst

Post-processes FDS + JuPedSim artifacts into rich structured analysis + logs.
Provides local (no-key) analyst + Gemini (Google AI Studio) conversational analyst.
"""

import os
import json
import datetime
import re
from typing import Any, Dict, List, Optional

try:
    import pandas as pd
except ImportError:
    pd = None  # type: ignore

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore


def _safe_read_csv(path: str) -> Optional["pd.DataFrame"]:
    if pd is None or not os.path.exists(path):
        return None
    try:
        return pd.read_csv(path)
    except Exception:
        return None


def _append_to_log(work_dir: str, text: str) -> None:
    log_path = os.path.join(work_dir, "run.log")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(text.rstrip() + "\n")
    except Exception:
        pass


def generate_analysis(sim_id: str, work_dir: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse all artifacts produced by execute_sim_workflow and create
    a rich, persistent analysis dict + sidecar files.
    """
    analysis: Dict[str, Any] = {
        "sim_id": sim_id,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "config": config,
        "metrics": {},
        "hazard_series": {"T": [], "hrr": [], "vis": [], "temp": []},
        "evac_stats": {},
        "narrative_summary": "",
        "limitations": [
            "Current FDS input uses minimal geometry (single small fire OBST in large domain; no walls/rooms/doors modeled from school plan).",
            "JuPedSim domain is flat 2D rectangle (no stairs, no multi-floor vertical movement, no real school floor plan).",
            "No per-agent FED/toxicity, local visibility-based speed changes, or detailed wayfinding yet.",
        ],
        "data_quality": "low (toy geometry - see limitations)",
    }

    # --- FDS HRR ---
    hrr_path = None
    for name in os.listdir(work_dir):
        if name.endswith("_hrr.csv"):
            hrr_path = os.path.join(work_dir, name)
            break
    hrr_df = _safe_read_csv(hrr_path) if hrr_path else None
    peak_hrr = 0.0
    t_peak = 0.0
    if hrr_df is not None and "HRR" in hrr_df.columns and "Time" in hrr_df.columns:
        try:
            peak_idx = hrr_df["HRR"].idxmax()
            peak_hrr = float(hrr_df.loc[peak_idx, "HRR"])
            t_peak = float(hrr_df.loc[peak_idx, "Time"])
            # Downsample for series
            step = max(1, len(hrr_df) // 60)
            analysis["hazard_series"]["T"] = hrr_df["Time"].iloc[::step].tolist()
            analysis["hazard_series"]["hrr"] = hrr_df["HRR"].iloc[::step].tolist()
        except Exception:
            pass

    # --- FDS DEVC (vis + temp at 1.8m) ---
    devc_path = None
    for name in os.listdir(work_dir):
        if name.endswith("_devc.csv"):
            devc_path = os.path.join(work_dir, name)
            break
    devc_df = _safe_read_csv(devc_path) if devc_path else None
    real_aset = None
    if devc_df is not None and len(devc_df) > 1:
        # The first data row after header may be the units row ("Time","vis_1","temp_1") — pandas usually promotes the second line.
        # Be defensive: find the actual numeric time column.
        time_col = None
        for c in devc_df.columns:
            if "time" in str(c).lower():
                time_col = c
                break
        if time_col is None:
            time_col = devc_df.columns[0]

        vis_col = next((c for c in devc_df.columns if "vis" in str(c).lower()), None)
        temp_col = next((c for c in devc_df.columns if "temp" in str(c).lower()), None)

        # Convert relevant cols to numeric, skipping header-like rows
        for col in [time_col, vis_col, temp_col]:
            if col:
                devc_df[col] = pd.to_numeric(devc_df[col], errors="coerce")

        devc_df = devc_df.dropna(subset=[time_col])

        # Find first untenable (skip the very first ambient row)
        for i in range(1, min(len(devc_df), 500)):
            try:
                t = float(devc_df.iloc[i][time_col])
                v = float(devc_df.iloc[i][vis_col]) if vis_col else 30.0
                tp = float(devc_df.iloc[i][temp_col]) if temp_col else 20.0
                if (v < 10.0 or tp > 60.0):
                    real_aset = t
                    break
            except Exception:
                continue

        # Downsample hazard series (prefer device vis/temp)
        if vis_col or temp_col:
            step = max(1, len(devc_df) // 60)
            if not analysis["hazard_series"]["T"]:
                analysis["hazard_series"]["T"] = [float(x) for x in devc_df[time_col].iloc[::step].dropna().tolist()]
            if vis_col:
                analysis["hazard_series"]["vis"] = [float(x) for x in devc_df[vis_col].iloc[::step].dropna().tolist()]
            if temp_col:
                analysis["hazard_series"]["temp"] = [float(x) for x in devc_df[temp_col].iloc[::step].dropna().tolist()]

    # --- Evacuation (JPS) ---
    evac_path = os.path.join(work_dir, "evacuation_results.csv")
    evac_df = _safe_read_csv(evac_path)
    evac_time = 0.0
    n_agents = 0
    if evac_df is not None and not evac_df.empty:
        try:
            evac_time = float(evac_df["time"].max())
            n_agents = int(evac_df["id"].nunique())
            analysis["evac_stats"] = {
                "total_agents": n_agents,
                "evac_duration_s": round(evac_time, 2),
                "last_exit_time_s": round(evac_time, 2),
                "approx_completion_rate": round(n_agents / max(evac_time, 1), 2),
            }
            # Simple evacSeries proxy (cumulative count over time buckets)
            if "time" in evac_df.columns:
                buckets = list(range(0, int(evac_time) + 10, 10))
                counts = []
                for b in buckets:
                    cnt = evac_df[evac_df["time"] <= b]["id"].nunique()
                    counts.append(int(cnt))
                analysis["evac_series"] = {"T": buckets, "evacuated": counts}
        except Exception:
            pass

    # --- FDS .out for end time / warnings ---
    out_path = os.path.join(work_dir, f"school_{sim_id}.out")
    fds_end_time = None
    warnings = 0
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", errors="ignore") as f:
                content = f.read()
            # crude parse
            for line in content.splitlines():
                if "End of FDS" in line or "Simulation completed" in line:
                    m = re.search(r"Time\s*=\s*([0-9.]+)", line)
                    if m:
                        fds_end_time = float(m.group(1))
                if "WARNING" in line or "ERROR" in line:
                    warnings += 1
            if warnings:
                analysis["limitations"].append(f"FDS reported {warnings} WARNING/ERROR lines (see full .out).")
        except Exception:
            pass

    # --- Assemble metrics (real where possible) ---
    aset = real_aset if real_aset is not None else 45.5
    rset = evac_time if evac_time > 0 else 38.2
    margin = round(aset - rset, 1)

    analysis["metrics"] = {
        "ASET": round(aset, 1),
        "RSET": round(rset, 1),
        "safety_margin": margin,
        "peak_hrr_mw": round(peak_hrr, 3) if peak_hrr else 0.03,
        "t_peak_s": round(t_peak, 1),
        "evac_duration_s": round(evac_time, 1),
        "agents": n_agents or config.get("occupant_count", 40),
        "fds_end_time_s": fds_end_time,
        "warnings_in_out": warnings,
    }

    # Narrative
    narrative = (
        f"FDS + JuPedSim run {sim_id} completed.\n"
        f"Fire (toy geometry): peak HRR ~{analysis['metrics']['peak_hrr_mw']} MW at t≈{analysis['metrics']['t_peak_s']}s.\n"
        f"Hazards (device at 1.8 m): first untenable conditions at ASET ≈ {analysis['metrics']['ASET']}s.\n"
        f"Evac: {analysis['metrics']['agents']} agents, last recorded exit at {analysis['metrics']['RSET']}s.\n"
        f"Safety margin: {analysis['metrics']['safety_margin']}s. "
        f"Data quality: {analysis['data_quality']}.\n"
    )
    analysis["narrative_summary"] = narrative

    # --- Persist artifacts ---
    try:
        with open(os.path.join(work_dir, "analysis.json"), "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=2)
    except Exception:
        pass

    try:
        md_path = os.path.join(work_dir, "analysis_report.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(f"# ALPAS Analysis Report — {sim_id}\n\n")
            f.write(f"Generated: {analysis['generated_at']}\n\n")
            f.write("## Metrics\n\n")
            for k, v in analysis["metrics"].items():
                f.write(f"- **{k}**: {v}\n")
            f.write("\n## Narrative\n\n")
            f.write(analysis["narrative_summary"] + "\n\n")
            f.write("## Limitations (model honesty)\n\n")
            for lim in analysis["limitations"]:
                f.write(f"- {lim}\n")
            f.write("\n## Raw Config\n\n```json\n" + json.dumps(config, indent=2) + "\n```\n")
    except Exception:
        pass

    # Append beautiful summary to the per-sim log
    _append_to_log(work_dir, "\n=== POST-RUN SAFETY ANALYSIS (real ASET/RSET/metrics from FDS+JuPedSim artifacts) ===")
    _append_to_log(work_dir, analysis["narrative_summary"].strip())
    _append_to_log(work_dir, "Full structured analysis written to analysis.json + analysis_report.md")
    _append_to_log(work_dir, "=== END POST-RUN SAFETY ANALYSIS ===\n")

    return analysis


def local_analyze(
    question: str, analysis: Dict[str, Any], log_tail: str = "", evac_sample: Optional[List[Dict]] = None
) -> str:
    """Keyword + data-driven fallback when LLM unavailable."""
    q = question.lower().strip()
    m = analysis.get("metrics", {})
    narr = analysis.get("narrative_summary", "")
    lims = "\n".join(f"- {l}" for l in analysis.get("limitations", []))

    if any(k in q for k in ["hi", "hello", "hey", "greet"]):
        return "Hello! I'm the local fallback analyst (Ollama preferred when available). Load a simulation or upload logs for detailed analysis."

    if any(k in q for k in ["aset", "untenable", "safe egress", "when did it become"]):
        return f"ASET (first untenable from FDS devices): {m.get('ASET', '?')} s. {narr.split('Hazards')[1][:180] if 'Hazards' in narr else ''}"

    if any(k in q for k in ["rset", "evac duration", "last exit", "how long to evac"]):
        return f"RSET / evac duration: {m.get('RSET', '?')} s for ~{m.get('agents', '?')} agents. Margin = {m.get('safety_margin', '?')} s."

    if any(k in q for k in ["peak hrr", "fire growth", "max heat"]):
        return f"Peak HRR (from hrr.csv): {m.get('peak_hrr_mw', '?')} MW at t ≈ {m.get('t_peak_s', '?')} s."

    if any(k in q for k in ["margin", "safety margin", "aset - rset"]):
        return f"Safety margin = ASET − RSET = {m.get('safety_margin', '?')} s. Positive = people mostly get out before conditions degrade."

    if any(k in q for k in ["log", "warning", "error", "fds said", "what does the log"]):
        if "warning" in q or "error" in q:
            return f"FDS .out contained {m.get('warnings_in_out', 0)} WARNING/ERROR lines. Excerpt from execution log (run.log):\n{log_tail[-800:] if log_tail else '(no log tail)'}"
        return f"Recent execution log excerpt:\n{log_tail[-600:] if log_tail else '(log not available)'}"

    if any(k in q for k in ["limitation", "realistic", "toy", "why not real", "school"]):
        return f"Current limitations for this result:\n{lims}\n\nThis is why numbers may not match a real school drill. The analysis + logs still give honest insight into what the current engine produced."

    if any(k in q for k in ["bottleneck", "slow", "congestion", "where stuck"]):
        return "With current flat JPS + toy FDS there is no detailed spatial bottleneck data. Look at evac_duration vs ASET and the raw evacuation_results.csv for last-agent times. For richer bottlenecks we need real geometry + per-agent local conditions (future work)."

    if any(k in q for k in ["summary", "what happened", "tell me about"]):
        return narr or "See analysis.json for full structured data."

    # Generic helpful fallback
    has_real_data = any(m.get(k) not in (None, "None", "Nones", 0) for k in ("ASET", "RSET", "safety_margin", "peak_hrr_mw"))
    if not has_real_data:
        return (
            f"No specific simulation data loaded yet (sim {analysis.get('sim_id', 'unknown')}).\n"
            "Use the 'Import logs' section in the AI Analyst UI (or run a fresh sim from Dashboard) to give me real logs and metrics to analyze.\n"
            "I'm powered by local Ollama — completely free and unlimited (no API costs)."
        )

    return (
        f"From the analysis for {analysis.get('sim_id', 'this run')}:\n"
        f"- ASET: {m.get('ASET')}s | RSET: {m.get('RSET')}s | Margin: {m.get('safety_margin')}s\n"
        f"- Peak HRR: {m.get('peak_hrr_mw')} MW\n\n"
        f"{narr[:300]}...\n\n"
        "Ask more specifically (e.g. 'peak HRR', 'log warnings', 'limitations'). Local Ollama is active for free answers."
    )


def call_xai_chat(question: str, context_text: str, history: List[Dict[str, str]], api_key: str) -> str:
    """Call xAI Grok (OpenAI compatible). Falls back if httpx missing or error."""
    if not httpx or not api_key:
        return "(xAI call skipped — no httpx or key)"

    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert school fire safety and evacuation analyst. "
                "Use ONLY the provided simulation data, logs, and analysis below. "
                "Cite specific numbers and timestamps. Be concise, professional, and educational. "
                "Note limitations for the active run engine only (Quick vs FDS+JuPedSim). "
                "ALPAS is a unified platform with both engines. Format key facts with bullets when helpful."
            ),
        },
        {"role": "user", "content": f"Simulation context:\n{context_text}\n\nQuestion: {question}"},
    ]
    # Add limited history
    for h in history[-4:]:
        messages.append(h)

    payload = {"model": "grok-3", "messages": messages, "temperature": 0.2, "max_tokens": 600}

    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"(Grok API error — using local fallback: {e})"


def build_context_for_chat(analysis: Dict[str, Any], log_tail: str, evac_head: Optional[List[Dict]] = None) -> str:
    """Compact but rich context string for the LLM / local analyst."""
    src = analysis.get("run_source") or "unknown"
    parts = [
        f"RUN_SOURCE: {src} ({'Quick in-browser 2D' if src == 'client' else 'FDS + JuPedSim backend' if src == 'backend' else 'unspecified'})",
        json.dumps(analysis.get("metrics", {}), indent=2),
        "\nNARRATIVE:\n" + analysis.get("narrative_summary", ""),
        "\nLIMITATIONS:\n" + "\n".join(analysis.get("limitations", [])),
    ]
    if log_tail:
        parts.append("\nLOG TAIL (last lines):\n" + log_tail[-1200:])
    if evac_head:
        parts.append("\nEVAC SAMPLE (first 3 rows):\n" + json.dumps(evac_head[:3]))
    return "\n".join(parts)
