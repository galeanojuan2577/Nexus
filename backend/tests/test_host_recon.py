from __future__ import annotations

import asyncio
from pathlib import Path

from nexus.scanner.host_recon import (
    _PHASE_PROGRESS,
    _heartbeat_progress,
    _tail_recon_log,
    parse_recon_findings,
)


def test_parse_recon_findings_subdomains(tmp_path: Path):
    sub = tmp_path / "01-subdomains"
    sub.mkdir()
    (sub / "all_subdomains.txt").write_text("a.example.com\nb.example.com\n")
    live = tmp_path / "02-probing"
    live.mkdir()
    (live / "live_urls.txt").write_text("https://a.example.com\n")
    ports = tmp_path / "03-ports"
    ports.mkdir()
    (ports / "open_ports.txt").write_text("443\n3306\n")

    findings = parse_recon_findings(tmp_path, level=2)
    types = {f["check_type"] for f in findings}
    assert "recon_subdomains" in types
    assert "recon_live_hosts" in types
    assert "recon_open_ports" in types
    assert "recon_risky_port" in types
    assert any(f["severity"] == "high" for f in findings)


def test_parse_recon_empty(tmp_path: Path):
    findings = parse_recon_findings(tmp_path, level=1)
    assert findings == []


def test_phase_progress_includes_fase_6():
    assert 6 in _PHASE_PROGRESS


async def test_tail_recon_log_advances_on_fase(tmp_path: Path, monkeypatch):
    from nexus.scanner import host_recon as hr

    lines_emitted: list[str] = []
    progresses: list[tuple[int, str]] = []

    async def fake_emit(scan_id: str, line: str) -> None:
        lines_emitted.append(line)

    async def progress(pct: int, stage: str) -> None:
        progresses.append((pct, stage))

    monkeypatch.setattr(hr, "emit_log", fake_emit)

    log1 = tmp_path / "recon_pro.log"
    log2 = tmp_path / "recon.log"
    log1.write_text("banner\n")
    stop = asyncio.Event()
    seen: set[int] = set()

    async def run():
        task = asyncio.create_task(
            _tail_recon_log("scan1", [log1, log2], progress, 1, stop, seen)
        )
        await asyncio.sleep(0.05)
        with log1.open("a") as f:
            f.write("FASE 0: WHOIS\n")
        await asyncio.sleep(0.5)
        with log2.open("a") as f:
            f.write("FASE 1: SUBS\n")
        await asyncio.sleep(0.5)
        stop.set()
        await asyncio.gather(task)

    await run()
    assert any("FASE 0" in x for x in lines_emitted)
    assert any("FASE 1" in x for x in lines_emitted)
    assert (36, "host_recon_l1") in progresses
    assert (40, "host_recon_l1") in progresses
    assert 0 in seen and 1 in seen


async def test_heartbeat_advances_without_phases():
    progresses: list[int] = []

    async def progress(pct: int, stage: str) -> None:
        progresses.append(pct)

    stop = asyncio.Event()
    seen: set[int] = set()
    hr_mod = __import__("nexus.scanner.host_recon", fromlist=["x"])
    original = hr_mod._HEARTBEAT_S
    hr_mod._HEARTBEAT_S = 0.05
    try:
        task = asyncio.create_task(_heartbeat_progress(progress, 1, stop, seen))
        await asyncio.sleep(0.35)
        stop.set()
        await task
    finally:
        hr_mod._HEARTBEAT_S = original

    assert len(progresses) >= 2
    assert progresses == sorted(progresses)
