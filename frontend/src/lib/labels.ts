export const STAGE_LABELS: Record<string, string> = {
  queued: "En cola",
  init: "Inicializando",
  security_headers: "Security headers",
  builtin_checks: "Checks HTTP locales",
  builtin_checks_done: "Checks HTTP listos",
  host_recon_l1: "Host recon · nivel 1",
  host_recon_l2: "Host recon · nivel 2",
  host_recon_l3: "Host recon · nivel 3",
  host_recon_parse: "Parseando resultados recon",
  host_recon_timeout: "Recon con timeout",
  host_recon_skipped: "Recon omitido",
  persist_findings: "Guardando findings",
  detection: "Detección ATT&CK",
  interpretation: "Interpretando resultados",
  completed: "Completado",
  cancelled: "Cancelado",
  failed: "Fallido",
  timeout: "Timeout",
}

export const SCAN_STATUS_LABEL: Record<string, string> = {
  completed: "completado",
  running: "en ejecución",
  pending: "en cola",
  failed: "fallido",
  cancelled: "cancelado",
  timeout: "expirado",
}

export const SCAN_TYPE_LABEL: Record<string, string> = {
  quick: "rápido",
  normal: "normal",
  deep: "profundo",
  full: "completo",
  headers: "cabeceras",
  ssl: "TLS/SSL",
}

export const ALERT_SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  warning: "Aviso",
  low: "Baja",
  info: "Informativa",
}
