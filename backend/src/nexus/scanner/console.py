from __future__ import annotations

import re
from typing import Any

from nexus.services.websocket import manager

_MAX_LINES = 2000
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07")

_logs: dict[str, list[str]] = {}


def strip_ansi(text: str) -> str:
    return _ANSI.sub("", text)


def append_log(scan_id: str, line: str) -> int:
    cleaned = strip_ansi(line).rstrip("\r\n")
    if not cleaned:
        return len(_logs.get(scan_id, []))
    lines = _logs.setdefault(scan_id, [])
    lines.append(cleaned)
    if len(lines) > _MAX_LINES:
        del lines[: len(lines) - _MAX_LINES]
    return len(lines)


def get_log(scan_id: str, offset: int = 0) -> dict[str, Any]:
    lines = _logs.get(scan_id, [])
    offset = max(0, offset)
    chunk = lines[offset:]
    return {
        "scan_id": scan_id,
        "lines": chunk,
        "offset": offset + len(chunk),
        "total": len(lines),
    }


async def emit_log(scan_id: str, line: str) -> None:
    idx = append_log(scan_id, line)
    await manager.broadcast(
        "scan.log",
        {
            "scan_id": scan_id,
            "line": strip_ansi(line).rstrip("\r\n"),
            "offset": idx,
        },
    )


def clear_log(scan_id: str) -> None:
    _logs.pop(scan_id, None)
