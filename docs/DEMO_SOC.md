# Demo SOC — Nexus (script para entrevista)

**Audiencia:** entrevistador (líder SOC/NDR) · **Rol:** SOC Analyst · **Duración:** ~10–12 min

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

- Enviar link estable: **https://nexus-f0u.pages.dev**
- Alternativa local: `cloudflared tunnel --url http://127.0.0.1:5173` → `https://<random>.trycloudflare.com`

## Guion

### 1. Contexto (1 min)
- Nexus = plataforma unificada de ops + seguridad (scanner, alertas, dashboards, webhooks).
- Para el rol SOC añadí: **correlación de findings → MITRE ATT&CK**, **alertas de detección**, **reglas Sigma** y **runbook**.

### 2. Login (1 min)
- Login con la cuenta admin (registro deshabilitado en la demo) → Dashboard con score de seguridad.

### 3. Scan autorizado (3 min)
- Devices → `example.com` (target autorizado, ya escaneado) → abrir el último scan.
- Opcional en vivo: Scans → full scan → esperar completado.
- Abrir detalle: cada finding muestra su badge **T1557 / T1592 / T1595** + tactic.
- Dispositivo local `localhost:8080` (nginx de laboratorio): scan rápido → finding CVE con badge **T1190**.

### 4. Detección y triage (3 min)
- Alerts: alertas con prefijo `[Txxxx]` generadas por `detection.py`.
- Abrir runbook: `detections/RUNBOOK.md` (SLA, flujo, evidencia).
- Mostrar reglas portables: `detections/sigma/*.yml`.

### 5. Hardening / honestidad (2 min)
- Self-audit en README: Grafana anónimo off, `/metrics` con token, puertos en 127.0.0.1, CORS sin `*`.
- CI: ruff → mypy → pytest (cobertura) → tsc → docker build.

### 6. Cierre
- Preguntas del entrevistador; ofrecer repo + este runbook.

## Mensaje corto para el entrevistador

> Hola, soy Juan. Preparé una demo corta de Nexus con una capa de detección orientada a SOC (mapeo MITRE ATT&CK, alertas de triage, reglas Sigma y runbook). Link: **https://nexus-f0u.pages.dev** — acceso admin en la propia UI. Quedo atento a tu disponibilidad.
