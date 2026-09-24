from __future__ import annotations

from collections import Counter
from typing import Any

_SEV_ES = {
    "critical": "crítico",
    "high": "alto",
    "medium": "medio",
    "low": "bajo",
    "info": "informativo",
}


def interpret_scan(
    findings: list[dict[str, Any]],
    *,
    level: int,
    scan_type: str,
    target: str,
    recon_stats: dict | None = None,
) -> str:
    """Plain-language explanation of scan results for non-specialist readers."""
    if not findings:
        return (
            "## Qué encontramos\n\n"
            f"Escaneamos **{target}** (nivel {level}, tipo {scan_type}).\n\n"
            "No apareció ningún problema con las verificaciones que corrimos. "
            "Eso no garantiza que el sistema esté 100% seguro, pero en esta "
            "profundidad de escaneo no vimos alertas.\n\n"
            "**Qué podés hacer ahora:** si querés más confianza, corré un "
            "escaneo de nivel 3 o revisá a mano los endpoints más importantes."
        )

    by_sev = Counter(f.get("severity", "info") for f in findings)
    ordered = ["critical", "high", "medium", "low", "info"]
    top = sorted(
        findings,
        key=lambda f: (
            ordered.index(f.get("severity", "info")) if f.get("severity") in ordered else 99
        ),
    )[:5]

    risk = "BAJO"
    if by_sev.get("critical"):
        risk = "CRÍTICO"
    elif by_sev.get("high"):
        risk = "ALTO"
    elif by_sev.get("medium"):
        risk = "MEDIO"

    counts = ", ".join(f"{by_sev[sev]} {_SEV_ES[sev]}(s)" for sev in ordered if by_sev.get(sev))

    lines = [
        "## Qué encontramos",
        "",
        f"Escaneamos **{target}** (nivel {level}, tipo {scan_type}). "
        f"El nivel de riesgo general es **{risk}**.",
        "",
        f"En total hay **{len(findings)} hallazgo(s)**: {counts}.",
        "",
    ]

    if recon_stats and not recon_stats.get("skipped"):
        lines += [
            "### Qué vimos en el reconocimiento",
            f"- Subdominios encontrados: **{recon_stats.get('subdomains', 0)}**",
            f"- Sitios web activos: **{recon_stats.get('live_hosts', 0)}**",
            f"- Puertos abiertos: **{recon_stats.get('open_ports', 0)}**",
            "",
        ]

    lines.append("### Los puntos más importantes")
    for i, f in enumerate(top, 1):
        sev = _SEV_ES.get(f.get("severity", "info"), f.get("severity", "info"))
        title = f.get("title", "Sin título")
        desc = (f.get("description") or "").strip().replace("\n", " ")[:200]
        rem = (f.get("remediation") or "").strip().replace("\n", " ")[:180]
        lines.append(f"{i}. **[{sev.upper()}]** {title}")
        if desc:
            lines.append(f"   - Qué encontré: {desc}")
        if rem:
            lines.append(f"   - Qué hacer: {rem}")

    lines += [
        "",
        "### Recomendaciones",
        "- Arreglá primero lo marcado como crítico o alto: son los más fáciles de aprovechar.",
        "- Revisá que cada puerto y sitio web abierto sea intencional y esté monitoreado.",
        "- Si el reconocimiento quedó corto (timeout), volvé a correr el escaneo a mayor nivel.",
        "",
        f"_Explicación generada automáticamente por NEXUS ({len(findings)} hallazgos)._",
    ]
    return "\n".join(lines)
