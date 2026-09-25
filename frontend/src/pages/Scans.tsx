import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Square,
  XCircle,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "@/api/client"
import { clsx } from "clsx"
import { EmptyState, PageHeader, PageSpinner, SEVERITY_LABEL } from "@/components/ui"
import { severityPill } from "@/components/ui/Badge"
import {
  SCAN_STATUS_LABEL,
  SCAN_TYPE_LABEL,
  STAGE_LABELS,
} from "@/lib/labels"

const LEVEL_OPTIONS = [
  { value: "quick", level: 1, label: "Rápido", hint: "L1 · 5–15 min" },
  { value: "normal", level: 2, label: "Normal", hint: "L2 · 15–45 min" },
  { value: "deep", level: 3, label: "Profundo", hint: "L3 · más profundo" },
] as const

const LEVEL_TOOLS: Record<number, string[]> = {
  1: [
    "whois",
    "dig (DNS/AXFR)",
    "subfinder",
    "fierce",
    "crt.sh",
    "httpx",
    "wafw00f",
    "whatweb",
    "sslscan",
    "masscan (1–10000)",
    "nmap -sS top-1000",
  ],
  2: [
    "whois/dig",
    "subfinder",
    "amass (passive)",
    "theHarvester",
    "dnsx",
    "dnsrecon",
    "dnsenum",
    "crt.sh",
    "httpx",
    "wafw00f",
    "whatweb",
    "sslscan",
    "testssl.sh",
    "masscan",
    "nmap -sV -sC",
    "gobuster",
    "ffuf",
    "arjun",
    "katana",
    "waybackurls / gau",
    "nikto",
    "nuclei",
    "CORS / headers checks",
  ],
  3: [
    "whois/dig",
    "subfinder",
    "amass -active -brute",
    "theHarvester",
    "dnsx / dnsenum",
    "httpx / wafw00f / whatweb",
    "sslscan / testssl.sh",
    "masscan",
    "nmap --script vuln,exploit,auth",
    "gobuster (dir + dns)",
    "ffuf / wfuzz",
    "arjun / katana / gau",
    "JS secrets extraction",
    "nikto",
    "nuclei",
    "sqlmap",
    "CORS / headers / open-redirect",
    "shodan",
    "recon-ng",
    "Wayback / email harvesting",
  ],
}

const statusPill: Record<string, string> = {
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  running: "border-accent/30 bg-accent/10 text-accent",
  failed: "border-red-500/30 bg-red-500/10 text-red-400",
  cancelled: "border-line-strong bg-elevated text-faint",
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
}

const isActive = (status: string) =>
  status === "pending" || status === "running"

export default function Scans() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [scanType, setScanType] = useState<string>("quick")
  const [level, setLevel] = useState<number>(1)

  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: api.devices.list,
  })
  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: () => api.scans.list(),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.some((s) => isActive(s.status))) return 3000
      return 10000
    },
  })

  const scanMutation = useMutation({
    mutationFn: ({
      device_id,
      scan_type,
      level,
    }: {
      device_id: string
      scan_type: string
      level: number
    }) =>
      api.scans.create(device_id, scan_type, level) as Promise<{
        id?: string
      }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scans"] })
      if (data?.id) navigate(`/scans/${data.id}`)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.scans.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scans"] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escaneos"
        description="Historial de escaneos, progreso en vivo e interpretación SOC."
      />

      <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-faint">
            Nivel de escaneo
          </span>
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setScanType(opt.value)
                setLevel(opt.level)
              }}
              className={clsx(
                "rounded-lg border px-3 py-2 text-sm transition-colors",
                scanType === opt.value
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-line bg-void text-dim hover:border-line-strong"
              )}
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="ml-2 text-xs opacity-70">{opt.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Autorización requerida.</span>{" "}
            Escanea solo objetivos que te pertenecen o para los que tengas
            permiso escrito explícito. Eres responsable del uso de estas
            herramientas contra cada objetivo.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-void/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">
            Herramientas que se ejecutarán ·{" "}
            {LEVEL_OPTIONS.find((o) => o.level === level)?.label} (L{level})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEVEL_TOOLS[level].map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-line bg-elevated px-2 py-0.5 text-xs text-dim"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {devices && devices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {devices.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() =>
                  scanMutation.mutate({
                    device_id: device.id,
                    scan_type: scanType,
                    level,
                  })
                }
                disabled={scanMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-line bg-void px-3 py-2 text-sm text-dim transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                <Shield className="h-4 w-4" />
                Escanear {device.name} (
                {SCAN_TYPE_LABEL[scanType] ?? scanType} · L{level})
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <PageSpinner label="Cargando escaneos…" />
      ) : (
        <div className="space-y-3">
          {(scans ?? []).length === 0 && (
            <EmptyState
              icon={<ShieldCheck className="h-12 w-12" />}
              title="Aún no hay escaneos"
              description="Elige un nivel y ejecuta un escaneo sobre un dispositivo."
            />
          )}
          {(scans ?? []).map((scan) => (
            <div
              key={scan.id}
              onClick={() => navigate(`/scans/${scan.id}`)}
              className="cursor-pointer rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={clsx(
                      "shrink-0",
                      scan.status === "completed"
                        ? "text-emerald-400"
                        : scan.status === "failed"
                          ? "text-red-400"
                          : scan.status === "cancelled"
                            ? "text-faint"
                            : "text-yellow-400"
                    )}
                  >
                    {scan.status === "completed" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : scan.status === "failed" ? (
                      <ShieldOff className="h-5 w-5" />
                    ) : isActive(scan.status) ? (
                      <Shield className="h-5 w-5 animate-pulse" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <span className="truncate">
                        {scan.device_name ?? "Dispositivo"}
                      </span>
                      {scan.target && (
                        <span className="font-mono text-xs font-normal text-faint">
                          {scan.target}
                        </span>
                      )}
                      <span className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        {scan.level === 1
                          ? "Rápido · L1"
                          : scan.level === 2
                            ? "Normal · L2"
                            : "Profundo · L3"}
                      </span>
                      <span className="text-xs font-normal text-faint">
                        {SCAN_TYPE_LABEL[scan.scan_type] ?? scan.scan_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {new Date(scan.created_at).toLocaleString()}
                    </p>
                    {isActive(scan.status) && scan.stage && (
                      <p className="text-xs text-accent">
                        etapa: {STAGE_LABELS[scan.stage] ?? scan.stage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isActive(scan.status) && (
                    <div className="flex min-w-[120px] flex-col items-end gap-1">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${scan.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-dim">
                        {scan.progress ?? 0}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          cancelMutation.mutate(scan.id)
                        }}
                        className="flex items-center gap-1 rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10"
                      >
                        <Square className="h-3 w-3" />
                        Cancelar
                      </button>
                    </div>
                  )}
                  {scan.severity && (
                    <span
                      className={clsx(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        severityPill[scan.severity] ??
                          "border-line-strong bg-elevated text-faint"
                      )}
                    >
                      {SEVERITY_LABEL[scan.severity] ?? scan.severity}
                    </span>
                  )}
                  {scan.score !== null && (
                    <span className="text-sm font-bold text-ink">
                      {scan.score}/100
                    </span>
                  )}
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-xs",
                      statusPill[scan.status] ?? statusPill.pending
                    )}
                  >
                    {SCAN_STATUS_LABEL[scan.status] ?? scan.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
