import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ListChecks,
  Monitor,
  Percent,
  Radar,
  Scan,
  Shield,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { api } from "@/api/client"
import { clsx } from "clsx"
import { PageHeader, PageSpinner, SEVERITY_LABEL, SeverityBadge } from "@/components/ui"
import { severityPill } from "@/components/ui/Badge"
import { SCAN_STATUS_LABEL } from "@/lib/labels"

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-faint">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {value}
          </p>
        </div>
        <div
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function StateBadge({ value }: { value: string | null }) {
  const key = value ?? "unknown"
  const colors: Record<string, string> = {
    completed: severityPill.pass,
    failed: severityPill.critical,
    running: "border-accent/30 bg-accent/10 text-accent",
    pending: "border-line-strong bg-elevated text-faint",
    cancelled: "border-line-strong bg-elevated text-faint",
    critical: severityPill.critical,
    high: severityPill.high,
    medium: severityPill.medium,
    low: severityPill.low,
    info: severityPill.info,
    pass: severityPill.pass,
  }
  return (
    <span
      className={clsx(
        "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colors[key] ?? "border-line-strong bg-elevated text-faint"
      )}
    >
      {SCAN_STATUS_LABEL[key] ?? SEVERITY_LABEL[key] ?? key}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora mismo"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard.stats,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return <PageSpinner label="Cargando panel…" />
  }

  const severityData = stats
    ? [
        { name: "Crítico", value: stats.findings_breakdown.critical, color: "#f87171" },
        { name: "Alto", value: stats.findings_breakdown.high, color: "#fb923c" },
        { name: "Medio", value: stats.findings_breakdown.medium, color: "#facc15" },
        { name: "Bajo", value: stats.findings_breakdown.low, color: "#38bdf8" },
        { name: "Info", value: stats.findings_breakdown.info, color: "#71717a" },
      ]
    : []

  const score = stats?.security_score ?? 100

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel"
        description="Vista general de tu infraestructura y postura de seguridad."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Monitor}
          label="Dispositivos totales"
          value={stats?.total_devices ?? 0}
          color="bg-accent/10 text-accent"
        />
        <StatCard
          icon={Wifi}
          label="En línea"
          value={stats?.online_devices ?? 0}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={WifiOff}
          label="Fuera de línea"
          value={stats?.offline_devices ?? 0}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          icon={Scan}
          label="Escaneos totales"
          value={stats?.total_scans ?? 0}
          color="bg-violet-500/10 text-violet-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={ShieldAlert}
          label="Hallazgos críticos"
          value={stats?.critical_findings ?? 0}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Alertas activas"
          value={stats?.active_alerts ?? 0}
          color="bg-orange-500/10 text-orange-400"
        />
        <StatCard
          icon={Percent}
          label="Puntaje de seguridad"
          value={score.toFixed(1)}
          color="bg-accent/10 text-accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Radar className="h-4.5 w-4.5 text-accent" />
            <h2 className="text-base font-semibold text-ink">
              Tendencia del puntaje de seguridad
            </h2>
          </div>
          {stats && stats.total_scans > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[...stats.recent_scans].reverse().map((s) => ({
                    label: s.device_name.slice(0, 8),
                    score: s.score ?? 0,
                  }))}
                >
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="#71717a"
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#71717a"
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141419",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "8px",
                      color: "#fafafa",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#22d3ee"
                    fill="url(#scoreGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-faint">
              <p>Ejecuta un escaneo para ver la tendencia del puntaje.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-accent" />
            <h2 className="text-base font-semibold text-ink">
              Hallazgos por severidad
            </h2>
          </div>
          <div className="space-y-3">
            {severityData.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-dim">{s.name}</span>
                  <span className="font-medium text-ink">{s.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (s.value / Math.max(1, severityData.reduce((a, b) => a + b.value, 0))) * 100)}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {severityData.every((s) => s.value === 0) && (
              <p className="py-8 text-center text-sm text-faint">
                Aún no hay hallazgos registrados.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4.5 w-4.5 text-accent" />
            <h2 className="text-base font-semibold text-ink">
              Escaneos recientes
            </h2>
          </div>
          <Link
            to="/scans"
            className="text-sm text-accent hover:text-accent-soft"
          >
            Ver todos
          </Link>
        </div>
        {stats && stats.recent_scans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-faint">
                  <th className="pb-2 pr-4 font-medium">Objetivo</th>
                  <th className="pb-2 pr-4 font-medium">Profundidad</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Severidad</th>
                  <th className="pb-2 pr-4 font-medium">Puntaje</th>
                  <th className="pb-2 font-medium">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_scans.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-line/70 text-dim transition-colors hover:bg-elevated/60"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        to={`/scans/${s.id}`}
                        className="hover:text-accent"
                      >
                        <span className="block font-medium text-ink">
                          {s.device_name}
                        </span>
                        {s.target && (
                          <span className="block font-mono text-xs text-faint">
                            {s.target}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                        {s.level === 1
                          ? "Rápido · L1"
                          : s.level === 2
                            ? "Normal · L2"
                            : s.level === 3
                              ? "Profundo · L3"
                              : `L${s.level ?? "?"}`}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{s.scan_type}</td>
                    <td className="py-3 pr-4">
                      <StateBadge value={s.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <StateBadge value={s.severity} />
                    </td>
                    <td className="py-3 pr-4 font-mono text-ink">
                      {s.score != null ? s.score.toFixed(1) : "-"}
                    </td>
                    <td className="py-3 text-faint">{timeAgo(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-faint">
            <Scan className="h-5 w-5" />
            <p>
              Sin escaneos todavía. Crea uno desde la página de Escaneos.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-accent" />
            <h2 className="text-base font-semibold text-ink">
              Alertas recientes
            </h2>
            <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-xs text-dim">
              {stats?.recent_alerts.length ?? 0}
            </span>
          </div>
          <Link
            to="/alerts"
            className="text-sm text-accent hover:text-accent-soft"
          >
            Ver todas
          </Link>
        </div>
        {stats && stats.recent_alerts.length > 0 ? (
          (() => {
            const byDevice = stats.recent_alerts.reduce<
              Record<string, typeof stats.recent_alerts>
            >((acc, a) => {
              const key = a.device_name || "unknown"
              if (!acc[key]) acc[key] = []
              acc[key].push(a)
              return acc
            }, {})
            return (
              <div className="space-y-4">
                {Object.entries(byDevice).map(([dev, list]) => (
                  <div key={dev}>
                    <div className="mb-1.5 flex items-center gap-2 border-b border-line pb-1.5">
                      <Monitor className="h-3.5 w-3.5 text-accent" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-dim">
                        {dev}
                      </span>
                      <span className="rounded-full border border-line bg-elevated px-1.5 text-[10px] text-faint">
                        {list.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {list.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-void/60 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AlertTriangle
                              className={clsx(
                                "h-3.5 w-3.5 shrink-0",
                                a.severity === "critical" && "text-red-400",
                                a.severity === "high" && "text-orange-400",
                                a.severity === "medium" && "text-yellow-400",
                                a.severity !== "critical" &&
                                  a.severity !== "high" &&
                                  a.severity !== "medium" &&
                                  "text-faint"
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">
                                {a.title}
                              </p>
                              <p className="text-xs text-faint">
                                {a.message
                                  ? `${a.message.slice(0, 80)}${a.message.length > 80 ? "…" : ""} · `
                                  : ""}
                                {timeAgo(a.created_at)}
                              </p>
                            </div>
                          </div>
                          <SeverityBadge severity={a.severity} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-faint">
            <Shield className="h-5 w-5" />
            <p>Sin alertas activas. Todo está en orden.</p>
          </div>
        )}
      </div>
    </div>
  )
}
