# NEXUS — Cloudflare (gratuito)

## Links estables
- Frontend: https://nexus-f0u.pages.dev
- API: https://nexus-api.galeanojuan2577.workers.dev

## Demo (único usuario admin)
- `admin@nexus.local` / contraseña demo (compartida por canal privado)
- Registro (`POST /auth/register`) → **403 Registration disabled** si ya existe algún usuario
- Email `.local` soportado con validador propio en `backend/src/nexus/schemas/auth.py`

## Stack local (systemd)
- nexus-backend → uvicorn 127.0.0.1:8000 (CORS incluye pages.dev)
- nexus-tunnel → cloudflared quick tunnel → URL en /root/.nexus/tunnel.url
- docker compose: postgres + redis

## Sincronía del túnel
- systemd `nexus-tunnel` → `/root/.nexus/supervisor.sh` (loop cloudflared + escribe KV + `/root/.nexus/tunnel.url`)
- KV namespace `nexus-config` id `071a90892a8a4e478fc5e0ee710da257`, key `ORIGIN`
- Worker `resolveOrigin`: **KV primero** (`env.NEXUS_CONFIG`), fallback `env.ORIGIN` → al rotar URL basta con el PUT a KV, sin `wrangler deploy`
- `wrangler.toml` siempre incluye `[[kv_namespaces]] binding = "NEXUS_CONFIG"` (sin `[vars] ORIGIN`)
- cron: `* * * * * /root/.nexus/sync-tunnel-worker.sh` — reescribe el toml completo (binding incluido), PUT KV, solo hace deploy si cambió la URL vs `last_synced_url`
- Bug corregido 2026-09-24: el cron viejo borraba el binding KV y dejaba `env.ORIGIN` muerto con prioridad → Error 1033/1016

## Alta disponibilidad (HA) — 2026-09-24
- **KV inmediato**: supervisor y cron hacen `put_kv` apenas aparece la URL nueva en el log (sin esperar propagación del health) → rotación de túnel sincroniza en **<20 s** (antes hasta ~2.5 min)
- systemd `nexus-watchdog` → `/root/.nexus/watchdog.sh`, cada 30 s, checks de punta a punta:
  1. `GET /health` local ×3 fallos → `restart nexus-backend`
  2. `GET <tunnel>/health` ×3 fallos (solo si el origin local está vivo) → `restart nexus-tunnel`
  3. **E2E real** `POST /auth/login` vía worker ×3 → fuerza `put_kv` → ×6 `restart túnel` → ×9 `restart backend`
- **Alertas por email** (swaks → smtp.gmail.com:587, credenciales en `/root/.nexus/email.conf`, 600, fuera del repo):
  - `[NEXUS] CAIDA <fecha>` al abrir incidente (estado de toda la cadena + acción tomada)
  - `[NEXUS] RECUPERADO <fecha> (duracion X)` al cerrar — sin spam: solo transiciones open/close
- Bitácora: `/root/.nexus/incidents.log` (open/close, acciones, envíos de email)
- Tras reboot de la máquina: `nexus-backend`, `nexus-tunnel`, `nexus-watchdog` arrancan solos (`enabled`)
- Verificado 2026-09-24: caída simulada (stop backend90s) → auto-reinicio + 2 emails OK; kill de cloudflared → KV nuevo en17s, API recuperada sin email (<90s)

## Credenciales
- /root/Escritorio/Nexus2/.env.cloudflare (600, gitignored)

## Notas
- Sin zona CF → sin dominio propio; frontend Pages + API Worker son los links estables
- quick tunnel puede cambiar URL al reiniciar; supervisor actualiza KV automáticamente
- **Revocar tokens GitHub** usados antes (fine-grained + classic)

## Checks verificados (2026-09-24)
- smoke `/tmp/nexus_smoke.sh`: **ok=16 fail=0** (health/login/me/stats/devices/scans/alerts/webhooks 200, device+scan 201, register 403, bad login 401, pages 200, WS conecta+mensaje)
- UI logout→login con credenciales demo → Dashboard/Devices/Scans/Alerts/Webhooks con datos reales
- solo 1 usuario en DB: `admin@nexus.local|admin`; `count(*)=1`
- `ruff check src` 0, `mypy` 0 (49 files), `pytest` 157 passed, coverage 85.85%
- frontend `npm run lint` (tsc) 0 errores
