# Demo SOC — Nexus (script para entrevista)

**Audiencia:** Josseph Leiva (líder SOC/NDR) · **Rol:** SOC Analyst · **Duración:** ~10–12 min

## Pre-flight (5 min antes)

```bash
nexus          # stack + tunnel + URLs
nexus status   # verificar
```

Manual equivalente:

```bash
cd /root/Escritorio/Nexus2
docker compose up -d --build
curl -s http://localhost:8000/health
cloudflared tunnel --url http://127.0.0.1:5173
```

- Enviar link `https://<random>.trycloudflare.com`
- Fallback estable: https://nexus-frontend-got9.onrender.com

## Guion

### 1. Contexto (1 min)
- Nexus = plataforma unificada de ops + seguridad (scanner, alertas, dashboards, webhooks).
- Para el rol SOC añadí: **correlación de findings → MITRE ATT&CK**, **alertas de detección**, **reglas Sigma** y **runbook**.

### 2. Registro / login (1 min)
- Crear cuenta analyst → Dashboard con score de seguridad.

### 3. Scan autorizado (3 min)
- Devices → Add: `example.com` (target autorizado).
- Scans → full scan → esperar completado.
- Abrir detalle: cada finding crítico/alto muestra badge **T1190 / T1552 / T1557** + tactic.

### 4. Detección y triage (3 min)
- Alerts: alertas con prefijo `[Txxxx]` generadas por `detection.py`.
- Abrir runbook: `detections/RUNBOOK.md` (SLA, flujo, evidencia).
- Mostrar reglas portables: `detections/sigma/*.yml`.

### 5. Hardening / honestidad (2 min)
- Self-audit en README: Grafana anónimo off, `/metrics` con token, puertos en 127.0.0.1, CORS sin `*`.
- CI: ruff → mypy → pytest (cobertura) → tsc → docker build.

### 6. Cierre
- Preguntas del entrevistador; ofrecer repo + este runbook.

## Mensaje corto para Josseph

> Hola Josseph, soy Juan. Preparé una demo corta de Nexus con una capa de detección orientada a SOC (mapeo MITRE ATT&CK, alertas de triage, reglas Sigma y runbook). Link: **<TUNNEL_URL>** — credenciales de registro en la propia UI. Quedo atento a tu disponibilidad.
