# NEXUS — SOC Analyst Runbook

Audience: L1/L2 SOC analysts triaging NEXUS scan detections during the demo.

## Severity → SLA

| Severity | First response | Escalation |
|----------|----------------|------------|
| critical | 15 min | L2 + incident channel immediately |
| high | 1 h | L2 if exploitability confirmed |
| medium | 4 h | Ticket only |
| low / info | next business day | Batch |

## Triage flow

1. **Validate scope** — confirm the asset is authorized (owned lab / customer in SoW).
2. **Open finding** — Scans → finding detail; note `check_type`, evidence (`raw_data`), ATT&CK badge.
3. **Contextualize**
   - `T1190` (SQLi / CVE): confirm reachability of the endpoint; check for WAF logs.
   - `T1552.001` (`.env`, `/config`): treat as potential credential exposure — rotate secrets if real.
   - `T1557` (missing HSTS): verify HTTPS redirect; prioritize if session cookies lack `Secure`.
   - `T1595` / `T1592` (tech/info): inventory drift, not an incident by itself.
4. **Correlate** — Alerts tab: detection alerts carry `[Txxxx]` prefix; check sibling findings on same device.
5. **Contain / remediate** — apply finding remediation text; for exposed secrets: rotate → purge caches → re-scan.
6. **Close** — Resolve alert with note: technique, action taken, re-scan ID (green score preferred).

## Evidence to capture

- Scan ID + finding ID
- ATT&CK technique + tactic
- HTTP evidence path/status from `raw_data`
- Before/after security score

## Do / Don't

- DO re-scan after fix and attach the clean scan to the ticket.
- DON'T scan hosts outside authorization (use `example.com` or lab targets in demo).
- DON'T resolve alerts without remediation evidence.
