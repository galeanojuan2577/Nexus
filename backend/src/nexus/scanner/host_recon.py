from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

from nexus.scanner.console import emit_log
from nexus.scanner.registry import register_process, unregister_process

logger = logging.getLogger(__name__)

RECON_PRO = Path(os.environ.get("NEXUS_RECON_PRO", "/root/Escritorio/recon_pro.sh"))
RECON_OUT_ROOT = Path(os.environ.get("NEXUS_RECON_OUT", "/tmp/nexus_recon"))
# 0 = no overall recon cap (the scan runs as long as needed).
RECON_TIMEOUT_S = int(os.environ.get("NEXUS_RECON_TIMEOUT", "0"))
# Kill recon if no file in the outdir grows for this long (a stuck tool).
STALL_S = int(os.environ.get("NEXUS_RECON_STALL", "1800"))
POLL_S = 15

ProgressCb = Callable[[int, str], Awaitable[None]]

LEVEL_LABELS = {
    1: "Recon rápido (nivel 1)",
    2: "Recon normal (nivel 2)",
    3: "Recon profundo (nivel 3)",
}

_PHASE_PROGRESS = {
    0: 36,
    1: 40,
    2: 45,
    3: 49,
    4: 52,
    5: 54,
    6: 54,
}
_FASE_RE = re.compile(r"FASE\s+(\d+)")
_HEARTBEAT_S = 15
_HEARTBEAT_STEPS = (37, 40, 43, 46, 49, 52, 54)


async def _noop(_p: int, _s: str) -> None:
    return None


async def _tail_recon_log(
    scan_id: str,
    log_paths: list[Path],
    progress: ProgressCb,
    level: int,
    stop: asyncio.Event,
    seen_phases: set[int],
) -> None:
    """Stream recon logs to the live console and advance progress by phase."""
    positions: dict[str, int] = {str(p): 0 for p in log_paths}
    pending: dict[str, str] = {}
    emitted: set[str] = set()
    while not stop.is_set():
        progressed = False
        try:
            for path in log_paths:
                key = str(path)
                if not path.exists():
                    continue
                size = path.stat().st_size
                if size < positions[key]:
                    positions[key] = 0
                if size <= positions[key]:
                    continue
                with open(path, encoding="utf-8", errors="replace") as f:
                    f.seek(positions[key])
                    chunk = f.read()
                    positions[key] = f.tell()
                pending[key] = pending.get(key, "") + chunk
                while "\n" in pending[key]:
                    line, pending[key] = pending[key].split("\n", 1)
                    if not line.strip():
                        continue
                    if line not in emitted:
                        emitted.add(line)
                        await emit_log(scan_id, line)
                    m = _FASE_RE.search(line)
                    if m:
                        phase = int(m.group(1))
                        if phase not in seen_phases:
                            seen_phases.add(phase)
                            pct = _PHASE_PROGRESS.get(phase)
                            if pct is not None:
                                await progress(pct, f"host_recon_l{level}")
                                progressed = True
        except OSError:
            pass
        if not progressed:
            await asyncio.sleep(0.35 if any(p.exists() for p in log_paths) else 0.2)
    for key, rest in pending.items():
        if rest.strip() and rest not in emitted:
            await emit_log(scan_id, rest)


async def _heartbeat_progress(
    progress: ProgressCb,
    level: int,
    stop: asyncio.Event,
    seen_phases: set[int],
) -> None:
    """Advance recon progress on a timer so long phases do not freeze at 35%."""
    step = 0
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=_HEARTBEAT_S)
            return
        except TimeoutError:
            pass
        if seen_phases:
            continue
        if step < len(_HEARTBEAT_STEPS):
            await progress(_HEARTBEAT_STEPS[step], f"host_recon_l{level}")
            step += 1


def _newest_mtime(root: Path) -> float:
    """Newest mtime under root — any tool writing output refreshes this."""
    newest = 0.0
    try:
        for p in root.rglob("*"):
            try:
                if p.is_file():
                    m = p.stat().st_mtime
                    if m > newest:
                        newest = m
            except OSError:
                continue
    except OSError:
        pass
    return newest


async def _kill_proc_group(proc: asyncio.subprocess.Process) -> None:
    """SIGKILL the whole process group so no orphaned tool survives."""
    if proc.returncode is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), 9)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            proc.kill()
        except ProcessLookupError:
            pass
    try:
        await proc.wait()
    except asyncio.CancelledError:
        raise


async def run_host_recon(
    scan_id: str,
    target: str,
    level: int,
    progress: ProgressCb | None = None,
) -> tuple[list[dict], dict]:
    """Run recon_pro.sh on the host. Returns (findings, stats)."""
    cb = progress or _noop
    host = target.split(":")[0].strip()
    if host.startswith("http://") or host.startswith("https://"):
        host = host.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0]

    outdir = RECON_OUT_ROOT / scan_id
    outdir.mkdir(parents=True, exist_ok=True)

    if not RECON_PRO.is_file() or not shutil.which("bash"):
        await emit_log(scan_id, "[!] recon_pro.sh no encontrado — omitiendo host recon")
        await cb(40, "host_recon_skipped")
        return [], {"skipped": True, "reason": "recon_pro.sh not found"}

    await cb(35, f"host_recon_l{level}")
    await emit_log(
        scan_id,
        f"$ bash recon_pro.sh {host} -l {level} -o {outdir} -f -q",
    )
    path = "/root/go/bin:/usr/local/bin:/usr/bin:/bin:" + os.environ.get("PATH", "")
    env = {**os.environ, "PATH": path}
    stdbuf = shutil.which("stdbuf")
    base_cmd = [stdbuf, "-oL", "-eL", "bash"] if stdbuf else ["bash"]
    cmd = [
        *base_cmd,
        str(RECON_PRO),
        host,
        "-l",
        str(level),
        "-o",
        str(outdir),
        "-f",
        "-q",
    ]

    log_path = outdir / "recon_pro.log"
    recon_log_path = outdir / "recon.log"
    try:
        log_f = open(log_path, "w", buffering=1)
    except OSError as e:
        logger.error("Cannot open recon log: %s", e)
        await emit_log(scan_id, f"[!] No se pudo abrir log de recon: {e}")
        await cb(45, "host_recon_skipped")
        return [], {"skipped": True, "reason": str(e)}

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=log_f,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
            start_new_session=True,
            cwd=str(outdir),
        )
    except (OSError, ValueError) as e:
        log_f.close()
        logger.error("Failed to start recon_pro: %s", e)
        await emit_log(scan_id, f"[!] Fallo al arrancar recon_pro: {e}")
        await cb(45, "host_recon_skipped")
        return [], {"skipped": True, "reason": str(e)}

    register_process(scan_id, proc)
    stop_tail = asyncio.Event()
    seen_phases: set[int] = set()
    tail_task = asyncio.create_task(
        _tail_recon_log(scan_id, [log_path, recon_log_path], cb, level, stop_tail, seen_phases)
    )
    hb_task = asyncio.create_task(_heartbeat_progress(cb, level, stop_tail, seen_phases))

    deadline = time.monotonic() + RECON_TIMEOUT_S if RECON_TIMEOUT_S > 0 else None
    newest_seen = 0.0
    last_change = time.monotonic()
    killed: str | None = None
    try:
        while proc.returncode is None:
            if deadline is not None and time.monotonic() >= deadline:
                killed = "timeout"
                break
            mtime = _newest_mtime(outdir)
            if mtime > newest_seen:
                newest_seen = mtime
                last_change = time.monotonic()
            elif STALL_S > 0 and time.monotonic() - last_change > STALL_S:
                killed = "stalled"
                break
            try:
                await asyncio.wait_for(proc.wait(), timeout=POLL_S)
            except TimeoutError:
                continue
    except asyncio.CancelledError:
        # Cancelled upstream (cancel button / engine failure): never orphan children.
        await _kill_proc_group(proc)
        stop_tail.set()
        await asyncio.gather(tail_task, hb_task, return_exceptions=True)
        log_f.close()
        unregister_process(scan_id)
        raise
    finally:
        stop_tail.set()
        if not log_f.closed:
            log_f.close()
        unregister_process(scan_id)

    if killed:
        await _kill_proc_group(proc)
        await asyncio.gather(tail_task, hb_task, return_exceptions=True)
        if killed == "timeout":
            await emit_log(scan_id, f"[!] recon timeout tras {RECON_TIMEOUT_S}s — parcial")
        else:
            await emit_log(
                scan_id,
                f"[!] tool stall: sin escritura por {STALL_S}s — kill, resultados parciales",
            )
        await cb(55, "host_recon_timeout")
        stats = _parse_recon_stats(outdir)
        findings = parse_recon_findings(outdir, level)
        if killed == "stalled":
            return findings, {**stats, "stalled": True, "level": level}
        return findings, {**stats, "timeout": True, "level": level}

    await asyncio.gather(tail_task, hb_task, return_exceptions=True)
    await emit_log(scan_id, f"[✓] recon_pro exit={proc.returncode}")
    await cb(55, "host_recon_parse")
    stats = _parse_recon_stats(outdir)
    findings = parse_recon_findings(outdir, level)
    stats["level"] = level
    stats["exit_code"] = proc.returncode
    return findings, stats


def _read_lines(path: Path) -> list[str]:
    if not path.is_file():
        return []
    try:
        return [
            line.strip()
            for line in path.read_text(errors="replace").splitlines()
            if line.strip() and not line.startswith("#")
        ]
    except OSError:
        return []


def _parse_recon_stats(outdir: Path) -> dict:
    return {
        "subdomains": len(_read_lines(outdir / "01-subdomains" / "all_subdomains.txt")),
        "live_hosts": len(_read_lines(outdir / "02-probing" / "live_urls.txt")),
        "open_ports": len(_read_lines(outdir / "03-ports" / "open_ports.txt")),
        "outdir": str(outdir),
        "skipped": False,
    }


def parse_recon_findings(outdir: Path, level: int) -> list[dict]:
    findings: list[dict] = []
    stats = _parse_recon_stats(outdir)

    if stats["subdomains"] > 0:
        findings.append(
            {
                "check_type": "recon_subdomains",
                "severity": "info",
                "title": f"Discovered {stats['subdomains']} subdomain(s)",
                "description": (
                    f"Host recon (level {level}) enumerated "
                    f"{stats['subdomains']} unique subdomains. "
                    f"Live HTTP(S): {stats['live_hosts']}."
                ),
                "remediation": "Review subdomain inventory for unmanaged or stale assets",
                "raw_data": str(stats),
            }
        )

    if stats["live_hosts"] > 0:
        findings.append(
            {
                "check_type": "recon_live_hosts",
                "severity": "info",
                "title": f"{stats['live_hosts']} live HTTP host(s) found",
                "description": "httpx/probing confirmed live web services for the target scope.",
                "remediation": "Ensure every live host is in inventory and monitored",
                "raw_data": str(stats),
            }
        )

    if stats["open_ports"] > 0 and level >= 2:
        findings.append(
            {
                "check_type": "recon_open_ports",
                "severity": "medium",
                "title": f"{stats['open_ports']} open port(s) detected",
                "description": (
                    "Port scan found open ports. Verify each service is required "
                    "and not exposed unintentionally."
                ),
                "remediation": (
                    "Close unused ports; restrict management services to trusted networks"
                ),
                "raw_data": str(stats),
            }
        )

    risky = {"21", "23", "3389", "445", "1433", "3306", "6379", "27017", "11211"}
    for line in _read_lines(outdir / "03-ports" / "open_ports.txt")[:30]:
        port = line.strip()
        if port.isdigit() and port in risky:
            findings.append(
                {
                    "check_type": "recon_risky_port",
                    "severity": "high",
                    "title": f"Sensitive service exposure (port {port})",
                    "description": (
                        f"Port {port} is commonly associated with remote admin or "
                        "data services. Confirm intentional exposure and auth hardening."
                    ),
                    "remediation": (
                        "Restrict via firewall/security groups; require MFA/VPN for admin ports"
                    ),
                    "raw_data": line,
                }
            )

    nuclei_file = outdir / "04-vulns" / "nuclei_results.txt"
    if not nuclei_file.is_file():
        candidates = list(outdir.rglob("*nuclei*"))
        nuclei_file = candidates[0] if candidates else nuclei_file
    for line in _read_lines(nuclei_file)[:50]:
        sev = "high"
        low = line.lower()
        if "critical" in low:
            sev = "critical"
        elif "medium" in low:
            sev = "medium"
        elif "low" in low or "info" in low:
            sev = "low" if "low" in low else "info"
        findings.append(
            {
                "check_type": "recon_nuclei",
                "severity": sev,
                "title": f"Nuclei: {line[:200]}",
                "description": "Template match reported by nuclei during host recon.",
                "remediation": (
                    "Validate the match manually and patch or mitigate the affected component"
                ),
                "raw_data": line,
            }
        )

    waf_file = outdir / "02-probing" / "waf_detection.txt"
    for line in _read_lines(waf_file):
        if "No WAF" in line or "no waf" in line.lower():
            findings.append(
                {
                    "check_type": "recon_waf",
                    "severity": "medium",
                    "title": "No WAF detected on live URL",
                    "description": line,
                    "remediation": "Deploy or verify WAF/CDN edge controls for public apps",
                    "raw_data": line,
                }
            )
            break

    if level >= 3:
        secrets_file = outdir / "04-web" / "secrets.txt"
        for line in _read_lines(secrets_file)[:10]:
            findings.append(
                {
                    "check_type": "recon_secret_js",
                    "severity": "high",
                    "title": "Potential secret/API key pattern in client JS",
                    "description": line[:300],
                    "remediation": "Rotate the credential; never ship secrets in frontend JS",
                    "raw_data": line,
                }
            )

    return findings
