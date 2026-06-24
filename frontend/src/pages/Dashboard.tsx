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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition hover:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={clsx("rounded-lg p-3", color)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400",
    high: "bg-orange-500/20 text-orange-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low: "bg-blue-500/20 text-blue-400",
    info: "bg-gray-500/20 text-gray-400",
    pass: "bg-green-500/20 text-green-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    running: "bg-cyan-500/20 text-cyan-400",
    pending: "bg-gray-500/20 text-gray-400",
  }
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        colors[severity ?? ""] || "bg-gray-500/20 text-gray-400"
      )}
    >
      {severity ?? "unknown"}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard.stats,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
      </div>
    )
  }

  const severityData = stats
    ? [
        { name: "Critical", value: stats.findings_breakdown.critical, color: "#ef4444" },
        { name: "High", value: stats.findings_breakdown.high, color: "#f97316" },
        { name: "Medium", value: stats.findings_breakdown.medium, color: "#eab308" },
        { name: "Low", value: stats.findings_breakdown.low, color: "#3b82f6" },
        { name: "Info", value: stats.findings_breakdown.info, color: "#6b7280" },
      ]
    : []

  const score = stats?.security_score ?? 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Centralized overview of your infrastructure
        </p>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Monitor}
          label="Total Devices"
          value={stats?.total_devices ?? 0}
          color="bg-nexus-600/20 text-nexus-400"
        />
        <StatCard
          icon={Wifi}
          label="Online"
          value={stats?.online_devices ?? 0}
          color="bg-green-600/20 text-green-400"
        />
        <StatCard
          icon={WifiOff}
          label="Offline"
          value={stats?.offline_devices ?? 0}
          color="bg-red-600/20 text-red-400"
        />
        <StatCard
          icon={Scan}
          label="Total Scans"
          value={stats?.total_scans ?? 0}
          color="bg-purple-600/20 text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={ShieldAlert}
          label="Critical Findings"
          value={stats?.critical_findings ?? 0}
          color="bg-red-600/20 text-red-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={stats?.active_alerts ?? 0}
          color="bg-orange-600/20 text-orange-400"
        />
        <StatCard
          icon={Percent}
          label="Security Score"
          value={score.toFixed(1)}
          color="bg-nexus-600/20 text-nexus-400"
        />
      </div>

      {/* Main grid: chart + findings breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Security Score Chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Radar className="h-5 w-5 text-nexus-400" />
            <h2 className="text-lg font-semibold text-white">
              Security Score Trend
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
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="label" stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#f3f4f6",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    fill="url(#scoreGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500">
              <p>Run a scan to see security score trends</p>
            </div>
          )}
        </div>

        {/* Findings breakdown */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-nexus-400" />
            <h2 className="text-lg font-semibold text-white">
              Findings by Severity
            </h2>
          </div>
          <div className="space-y-3">
            {severityData.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">{s.name}</span>
                  <span className="font-medium text-white">{s.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
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
              <p className="py-8 text-center text-sm text-gray-500">
                No findings yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-nexus-400" />
            <h2 className="text-lg font-semibold text-white">
              Recent Scans
            </h2>
          </div>
          <Link
            to="/scans"
            className="text-sm text-nexus-400 hover:text-nexus-300"
          >
            View all
          </Link>
        </div>
        {stats && stats.recent_scans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Device</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Severity</th>
                  <th className="pb-2 pr-4 font-medium">Score</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_scans.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                    <td className="py-3 pr-4">
                      <Link to={`/scans/${s.id}`} className="hover:text-white">
                        {s.device_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 capitalize">{s.scan_type}</td>
                    <td className="py-3 pr-4">
                      <SeverityBadge severity={s.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <SeverityBadge severity={s.severity} />
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {s.score != null ? s.score.toFixed(1) : "-"}
                    </td>
                    <td className="py-3 text-gray-500">{timeAgo(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Scan className="mr-2 h-5 w-5" />
            <p>No scans yet. Create one from the Scans page.</p>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-nexus-400" />
            <h2 className="text-lg font-semibold text-white">
              Recent Alerts
            </h2>
          </div>
          <Link
            to="/alerts"
            className="text-sm text-nexus-400 hover:text-nexus-300"
          >
            View all
          </Link>
        </div>
        {stats && stats.recent_alerts.length > 0 ? (
          <div className="space-y-2">
            {stats.recent_alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={clsx(
                      "h-4 w-4 flex-shrink-0",
                      a.severity === "critical" && "text-red-400",
                      a.severity === "high" && "text-orange-400",
                      a.severity === "medium" && "text-yellow-400",
                      a.severity !== "critical" &&
                        a.severity !== "high" &&
                        a.severity !== "medium" &&
                        "text-gray-400"
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      {a.device_name} &middot; {timeAgo(a.created_at)}
                    </p>
                  </div>
                </div>
                <SeverityBadge severity={a.severity} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Shield className="mr-2 h-5 w-5" />
            <p>No active alerts. Everything looks good.</p>
          </div>
        )}
      </div>
    </div>
  )
}
