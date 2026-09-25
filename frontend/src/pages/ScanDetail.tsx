import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  Hammer,
  Info,
  Shield,
  ShieldCheck,
  ShieldOff,
  Square,
  Terminal,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/api/client"
import { useWebSocket } from "@/hooks/useWebSocket"
import { clsx } from "clsx"
import {
  Button,
  EmptyState,
  PageSpinner,
  SEVERITY_LABEL,
  severityBar,
  severityPill,
} from "@/components/ui"
import {
  SCAN_STATUS_LABEL,
  SCAN_TYPE_LABEL,
  STAGE_LABELS,
} from "@/lib/labels"

const sevLabel: Record<string, string> = SEVERITY_LABEL

const sevOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

const isActive = (status: string) =>
  status === "pending" || status === "running"

function stageList(current?: string | null): { key: string; label: string }[] {
  const keys = [
    "queued",
    "init",
    "security_headers",
    "builtin_checks_done",
    "persist_findings",
    "detection",
    "interpretation",
    "completed",
  ]
  if (!current) return keys.map((k) => ({ key: k, label: STAGE_LABELS[k] ?? k }))
  if (current.startsWith("host_recon")) {
    return [
      { key: "queued", label: STAGE_LABELS.queued },
      { key: "init", label: STAGE_LABELS.init },
      { key: "security_headers", label: STAGE_LABELS.security_headers },
      { key: current, label: STAGE_LABELS[current] ?? current },
      { key: "persist_findings", label: STAGE_LABELS.persist_findings },
      { key: "detection", label: STAGE_LABELS.detection },
      { key: "interpretation", label: STAGE_LABELS.interpretation },
      { key: "completed", label: STAGE_LABELS.completed },
    ]
  }
  return keys.map((k) => ({ key: k, label: STAGE_LABELS[k] ?? k }))
}

function stageIndex(
  current: string | null | undefined,
  list: { key: string }[]
) {
  if (!current) return -1
  const exact = list.findIndex((s) => s.key === current)
  if (exact >= 0) return exact
  return list.findIndex((s) => current.startsWith(s.key))
}

function FindingCard({
  finding,
  index,
}: {
  finding: {
    id: string
    check_type: string
    severity: string
    title: string
    description: string | null
    remediation: string | null
    attack_technique: string | null
    attack_tactic: string | null
  }
  index: number
}) {
  const border =
    severityBar[finding.severity] ?? severityBar.info
  return (
    <article
      className={clsx(
        "rounded-xl border border-line border-l-4 bg-surface p-5",
        border
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={clsx(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            severityPill[finding.severity] ?? severityPill.info
          )}
        >
          {sevLabel[finding.severity] ?? finding.severity}
        </span>
        <h3 className="text-[15px] font-semibold text-ink">
          {finding.title}
        </h3>
        <span className="ml-auto rounded-full border border-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-dim">
          {finding.check_type}
        </span>
        {finding.attack_technique && (
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-300">
            {finding.attack_technique}
            {finding.attack_tactic ? ` · ${finding.attack_tactic}` : ""}
          </span>
        )}
      </header>
      <div className="mt-3 space-y-3">
        {finding.description && (
          <div className="rounded-lg border border-line bg-void/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-400">
              <Eye className="h-3.5 w-3.5" />
              Qué encontré
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-dim">
              {finding.description}
            </p>
          </div>
        )}
        {finding.remediation && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <Hammer className="h-3.5 w-3.5" />
              Qué hacer
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-dim">
              {finding.remediation}
            </p>
          </div>
        )}
      </div>
    </article>
  )
}

type ParsedInterp = {
  header: string
  intro: string[]
  recon: { label: string; value: string }[]
  items: {
    severity?: string
    title: string
    found?: string
    fix?: string
    bullets: string[]
  }[]
  recommendations: string[]
  footer: string[]
}

function stripBold(s: string): string {
  return s.replace(/\*\*/g, "").trim()
}

function parseInterpretation(text: string): ParsedInterp {
  const lines = text.split("\n")
  const out: ParsedInterp = {
    header: "",
    intro: [],
    recon: [],
    items: [],
    recommendations: [],
    footer: [],
  }
  let mode: "intro" | "recon" | "items" | "recs" | "footer" = "intro"
  let current: ParsedInterp["items"][number] | null = null

  const flush = () => {
    if (current) {
      out.items.push(current)
      current = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith("## ")) {
      flush()
      const h = stripBold(line.slice(3))
      if (/recomend/i.test(h)) mode = "recs"
      else if (/encontr/i.test(h) || /hallazgo/i.test(h)) mode = "intro"
      else if (/puntos|más importantes|importantes/i.test(h)) mode = "items"
      else if (/después|nota|pie/i.test(h)) mode = "footer"
      else if (!out.header) {
        out.header = h
        mode = "intro"
      }
      continue
    }
    if (line.startsWith("### ")) {
      flush()
      const h = stripBold(line.slice(4))
      if (/reconocimiento|recon/i.test(h)) mode = "recon"
      else if (/recomend/i.test(h)) mode = "recs"
      else if (/importante|encontr/i.test(h)) mode = "items"
      else out.header = out.header || h
      continue
    }
    if (mode === "recon") {
      const m =
        line.match(/^[-*]\s*\*?\*?(.+?)\*?\*?\s*[:：]\s*(.+)$/) ||
        line.match(/^[-*]\s*\*?\*?(.+?)\*?\*?\s+(.+)$/)
      if (m) {
        out.recon.push({ label: stripBold(m[1]), value: stripBold(m[2]) })
        continue
      }
    }
    if (mode === "items" || /^\d+\./.test(line)) {
      const numbered = line.match(/^(\d+)\.\s+(.*)$/)
      if (numbered) {
        flush()
        mode = "items"
        const rest = numbered[2]
        const sevMatch = rest.match(
          /^\[?(CRÍTICO|CRITICO|ALTO|MEDIO|BAJO|INFO)\]?\s*[-:—]?\s*(.*)$/i
        )
        const sevMap: Record<string, string> = {
          CRÍTICO: "critical",
          CRITICO: "critical",
          ALTO: "high",
          MEDIO: "medium",
          BAJO: "low",
          INFO: "info",
        }
        if (sevMatch) {
          current = {
            severity: sevMap[sevMatch[1].toUpperCase()],
            title: stripBold(sevMatch[2] || rest),
            bullets: [],
          }
        } else {
          current = { title: stripBold(rest), bullets: [] }
        }
        continue
      }
      if (current) {
        const found = line.match(
          /^[-*]?\s*\*?\*?Qué encontré\*?\*?[:：]?\s*(.*)$/i
        )
        const fix = line.match(
          /^[-*]?\s*\*?\*?Qué hacer\*?\*?[:：]?\s*(.*)$/i
        )
        if (found) {
          current.found = found[1].trim()
          continue
        }
        if (fix) {
          current.fix = fix[1].trim()
          continue
        }
        current.bullets.push(stripBold(line.replace(/^[-*]\s*/, "")))
        continue
      }
    }
    if (mode === "recs") {
      if (/^[-*]\s*/.test(line) || /^\d+\./.test(line)) {
        out.recommendations.push(
          stripBold(line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""))
        )
        continue
      }
      out.recommendations.push(stripBold(line))
      continue
    }
    if (mode === "footer") {
      out.footer.push(stripBold(line))
      continue
    }
    out.intro.push(stripBold(line))
  }
  flush()
  if (!out.header) out.header = "Explicación sencilla"
  return out
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const followRef = useRef(true)
  const [logLines, setLogLines] = useState<string[]>([])
  const [severityFilter, setSeverityFilter] = useState<string>("all")

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => api.scans.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data
      return s && isActive(s.status) ? 1500 : false
    },
  })

  const logOffsetRef = useRef(0)
  const requestedOffsetRef = useRef(0)

  const { data: logData } = useQuery({
    queryKey: ["scan-log", id],
    queryFn: () => {
      requestedOffsetRef.current = logOffsetRef.current
      return api.scans.log(id!, logOffsetRef.current)
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const scanning = scan && isActive(scan.status)
      return scanning || query.state.dataUpdatedAt === 0 ? 1500 : false
    },
  })

  useEffect(() => {
    if (!logData) return
    const start = requestedOffsetRef.current
    const end = logData.offset
    if (end <= logOffsetRef.current && logData.lines.length === 0) return
    const already = Math.max(0, logOffsetRef.current - start)
    const newLines = logData.lines.slice(already)
    logOffsetRef.current = Math.max(logOffsetRef.current, end)
    if (newLines.length === 0) return
    setLogLines((prev) => {
      const next = [...prev, ...newLines]
      return next.length >= 400 ? next.slice(-400) : next
    })
  }, [logData])

  const appendLog = useCallback((line: string) => {
    if (!line) return
    logOffsetRef.current += 1
    setLogLines((prev) => {
      const next = [...prev, line]
      return next.length >= 400 ? next.slice(-400) : next
    })
  }, [])

  useWebSocket("dashboard", {
    "scan.log": (data) => {
      if (data.scan_id === id) appendLog(data.line)
    },
    "scan.progress": (data) => {
      if (data.id !== id) return
      queryClient.setQueryData(["scan", id], (prev: any) =>
        prev
          ? {
              ...prev,
              status: data.status ?? prev.status,
              progress: data.progress ?? prev.progress,
              stage: data.stage ?? prev.stage,
              severity: data.severity ?? prev.severity,
              score: data.score ?? prev.score,
              summary: data.summary ?? prev.summary,
            }
          : prev
      )
    },
  })

  useEffect(() => {
    if (followRef.current && logEndRef.current) {
      logEndRef.current.scrollIntoView({ block: "end" })
    }
  }, [logLines])

  const cancelMutation = useMutation({
    mutationFn: () => api.scans.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scan", id] })
      queryClient.invalidateQueries({ queryKey: ["scans"] })
    },
  })

  const [downloading, setDownloading] = useState(false)
  const downloadReport = useCallback(async () => {
    if (!id) return
    setDownloading(true)
    try {
      const blob = await api.scans.report(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `scan_${id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }, [id])

  const findings = useMemo(() => {
    const list = scan?.findings ?? []
    const filtered =
      severityFilter === "all"
        ? list
        : list.filter((f) => f.severity === severityFilter)
    return [...filtered].sort(
      (a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9)
    )
  }, [scan, severityFilter])

  const interp = useMemo(
    () =>
      scan?.interpretation ? parseInterpretation(scan.interpretation) : null,
    [scan]
  )

  if (isLoading) {
    return <PageSpinner label="Cargando escaneo…" />
  }

  if (!scan) {
    return (
      <div className="py-20 text-center text-faint">
        <ShieldOff className="mx-auto h-12 w-12" />
        <p className="mt-4 text-lg font-medium">Escaneo no encontrado</p>
      </div>
    )
  }

  const active = isActive(scan.status)
  const stages = stageList(scan.stage)
  const idx = stageIndex(scan.stage, stages)
  const progress = scan.progress ?? 0
  const sevCounts = (scan.findings ?? []).reduce<Record<string, number>>(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/scans")}
        className="flex items-center gap-2 text-sm text-dim transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a escaneos
      </button>

      <header className="rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {scan.status === "completed" ? (
              <ShieldCheck className="mt-1 h-8 w-8 text-emerald-400" />
            ) : scan.status === "failed" ? (
              <ShieldOff className="mt-1 h-8 w-8 text-red-400" />
            ) : scan.status === "cancelled" ? (
              <ShieldOff className="mt-1 h-8 w-8 text-faint" />
            ) : (
              <Shield className="mt-1 h-8 w-8 animate-pulse text-yellow-400" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
                <span className="rounded border border-line bg-elevated px-2 py-0.5 font-mono">
                  {scan.level === 1
                    ? "RÁPIDO · L1"
                    : scan.level === 2
                      ? "NORMAL · L2"
                      : "PROFUNDO · L3"}
                </span>
                <span className="uppercase tracking-wider">
                  {SCAN_TYPE_LABEL[scan.scan_type] ?? scan.scan_type}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-ink">
                {scan.device_name ?? "Dispositivo"}
              </h1>
              <p className="font-mono text-sm text-dim">
                {scan.target ??
                  (scan.device_host
                    ? `${scan.device_host}:${scan.device_port ?? ""}`
                    : scan.device_id)}
              </p>
              <p className="mt-1 text-xs text-faint">
                estado:{" "}
                <span className="text-dim">
                  {SCAN_STATUS_LABEL[scan.status] ?? scan.status}
                </span>
                {scan.stage && (
                  <>
                    {" · etapa: "}
                    <span className="text-accent">
                      {STAGE_LABELS[scan.stage] ?? scan.stage}
                    </span>
                  </>
                )}
                {scan.started_at && (
                  <>
                    {" · inicio "}
                    {new Date(scan.started_at).toLocaleTimeString()}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {scan.score != null && (
              <div className="text-right">
                <div className="text-3xl font-extrabold tracking-tight text-ink">
                  {scan.score}
                </div>
                <div className="text-xs text-faint">/ 100 puntaje</div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span
                className={clsx(
                  "rounded-full border px-3 py-1 text-sm font-medium",
                  severityPill[scan.severity ?? "pass"] ??
                    severityPill.pass
                )}
              >
                {sevLabel[scan.severity ?? "pass"] ?? scan.severity ?? "unknown"}
              </span>
              {scan.status === "completed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => downloadReport()}
                  disabled={downloading}
                >
                  {downloading ? "Generando…" : "Descargar informe PDF"}
                </Button>
              )}
              {active && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Square className="h-4 w-4" />}
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  Interrumpir escaneo
                </Button>
              )}
            </div>
          </div>
        </div>

        {(active || scan.status === "cancelled" || scan.status === "failed") && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-dim">
              <span>Progreso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  scan.status === "failed"
                    ? "bg-red-500"
                    : scan.status === "cancelled"
                      ? "bg-gray-500"
                      : "bg-accent"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              {stages.map((s, i) => {
                const done = active
                  ? i < idx || progress >= 100
                  : scan.status === "completed"
                    ? true
                    : i < idx
                const current = active && i === idx
                return (
                  <li
                    key={s.key}
                    className={clsx(
                      "rounded-lg border px-2 py-1.5 text-xs",
                      current
                        ? "border-accent/50 bg-accent/10 text-ink"
                        : done
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                          : "border-line text-faint"
                    )}
                  >
                    {done && !current ? "✓ " : current ? "▸ " : ""}
                    {s.label}
                  </li>
                )
              })}
            </ol>
            {scan.error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                {scan.error}
              </p>
            )}
          </div>
        )}
      </header>

      {interp && (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-ink">
              {interp.header}
            </h2>
          </div>
          {interp.intro.map((p, i) => (
            <p
              key={`i${i}`}
              className="mb-3 text-sm leading-relaxed text-dim"
            >
              {p}
            </p>
          ))}
          {interp.recon.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {interp.recon.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-line bg-void/50 px-3 py-2"
                >
                  <div className="text-[11px] uppercase tracking-wide text-faint">
                    {r.label}
                  </div>
                  <div className="text-sm font-semibold text-ink">
                    {r.value}
                  </div>
                </div>
              ))}
            </div>
          )}
          {interp.items.length > 0 && (
            <ol className="space-y-3">
              {interp.items.map((item, i) => (
                <li
                  key={i}
                  className={clsx(
                    "rounded-lg border border-line border-l-4 bg-void/40 p-4",
                    severityBar[item.severity ?? "info"] ?? severityBar.info
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.severity && (
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                          severityPill[item.severity] ?? severityPill.info
                        )}
                      >
                        {sevLabel[item.severity] ?? item.severity}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-ink">
                      {item.title}
                    </span>
                  </div>
                  {item.found && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        Qué encontré
                      </div>
                      <p className="mt-1 text-sm text-dim">{item.found}</p>
                    </div>
                  )}
                  {item.fix && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Qué hacer
                      </div>
                      <p className="mt-1 text-sm text-dim">{item.fix}</p>
                    </div>
                  )}
                  {item.bullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-faint">
                      {item.bullets.map((b, bi) => (
                        <li key={bi}>{b}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {interp.recommendations.length > 0 && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Recomendaciones
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-dim">
                {interp.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {interp.footer.map((f, i) => (
            <p key={`f${i}`} className="mt-3 text-xs text-faint">
              {f}
            </p>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-dim" />
            <h2 className="text-lg font-semibold text-ink">
              Hallazgos{" "}
              <span className="text-sm font-normal text-faint">
                ({(scan.findings ?? []).length})
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["all", "critical", "high", "medium", "low", "info"].map(
              (sev) => {
                const count =
                  sev === "all"
                    ? (scan.findings ?? []).length
                    : (sevCounts[sev] ?? 0)
                if (sev !== "all" && count === 0) return null
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      severityFilter === sev
                        ? "border-accent/60 bg-accent/10 text-ink"
                        : "border-line text-dim hover:bg-elevated"
                    )}
                  >
                    {sev === "all" ? "Todos" : (sevLabel[sev] ?? sev)}
                    <span className="ml-1.5 text-faint">{count}</span>
                  </button>
                )
              }
            )}
          </div>
        </div>

        {(scan.findings ?? []).length === 0 ? (
          <EmptyState
            tone="success"
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="Sin hallazgos"
            description={
              active
                ? "Los resultados aparecen a medida que avanza el escaneo."
                : "El escaneo no detectó problemas de seguridad."
            }
          />
        ) : findings.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-faint">
            Ningún hallazgo con el filtro seleccionado.
          </div>
        ) : (
          <div className="space-y-4">
            {findings.map((f, i) => (
              <FindingCard key={f.id} finding={f} index={i} />
            ))}
          </div>
        )}
      </section>

      {active && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
                Consola en vivo
              </h2>
              <span className="ml-2 flex items-center gap-1 text-xs text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                en vivo
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5 text-faint">
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => {
                    followRef.current = e.target.checked
                  }}
                  className="nx-check h-3 w-3"
                />
                Seguir salida
              </label>
              <button
                type="button"
                onClick={() => {
                  setLogLines([])
                  logOffsetRef.current = 0
                }}
                className="rounded border border-line px-2 py-0.5 text-dim hover:bg-elevated hover:text-ink"
              >
                Limpiar
              </button>
            </div>
          </div>
          <div
            className="h-56 overflow-y-auto rounded-lg border border-line bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-dim"
            onScroll={(e) => {
              const el = e.currentTarget
              const atBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 40
              followRef.current = atBottom
            }}
          >
            {logLines.length === 0 ? (
              <p className="text-faint">Esperando salida del escaneo…</p>
            ) : (
              logLines.map((line, i) => (
                <div
                  key={`${i}-${line.slice(0, 24)}`}
                  className={
                    line.startsWith("[✗]") || line.startsWith("[!]")
                      ? "text-red-400"
                      : line.startsWith("[✓]")
                        ? "text-emerald-400"
                        : line.startsWith("[")
                          ? "text-accent"
                          : line.startsWith("$")
                            ? "text-yellow-400"
                            : "text-dim"
                  }
                >
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
