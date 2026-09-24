import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Monitor, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"
import { clsx } from "clsx"

const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  info: "bg-gray-500/15 text-gray-300 border-gray-500/30",
}

export default function Alerts() {
  const queryClient = useQueryClient()
  const [deviceFilter, setDeviceFilter] = useState<string>("")
  const [severityFilter, setSeverityFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("active")

  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: api.devices.list,
  })

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", deviceFilter, severityFilter, statusFilter],
    queryFn: () =>
      api.alerts.list({
        resolved: statusFilter === "active" ? false : statusFilter === "resolved" ? true : undefined,
        device_id: deviceFilter || undefined,
        severity: severityFilter || undefined,
      }),
    refetchInterval: 15000,
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.alerts.resolve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  })

  const grouped = (alerts ?? []).reduce<Record<string, typeof alerts>>((acc, a) => {
    const key = a.device_name || a.device_id
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {} as Record<string, typeof alerts>)

  const deviceKeys = Object.keys(grouped).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="mt-1 text-sm text-gray-400">
          Alertas activas filtradas por dispositivo y severidad
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Dispositivo
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            >
              <option value="">Todos</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Severidad
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            >
              <option value="">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="warning">Warning</option>
              <option value="low">Baja</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Estado
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            >
              <option value="active">Activas</option>
              <option value="resolved">Resueltas</option>
              <option value="all">Todas</option>
            </select>
          </label>
          {(deviceFilter || severityFilter || statusFilter !== "active") && (
            <button
              type="button"
              onClick={() => {
                setDeviceFilter("")
                setSeverityFilter("")
                setStatusFilter("active")
              }}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
        </div>
      ) : (alerts ?? []).length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-4 text-lg font-medium">Sin alertas</p>
          <p className="mt-1 text-sm">No hay alertas con los filtros actuales</p>
        </div>
      ) : (
        <div className="space-y-6">
          {deviceKeys.map((devKey) => {
            const list = grouped[devKey]!
            const device = list[0]
            return (
              <section key={devKey} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
                  <Monitor className="h-4 w-4 text-nexus-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                    {device?.device_name || devKey}
                  </h2>
                  {device?.device_host && (
                    <span className="font-mono text-xs text-gray-500">
                      {device.device_host}
                    </span>
                  )}
                  <span className="ml-auto rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {list.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((alert) => (
                    <article
                      key={alert.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className={clsx(
                            "mt-0.5 h-4 w-4 flex-shrink-0",
                            alert.severity === "critical" && "text-red-400",
                            alert.severity === "high" && "text-orange-400",
                            (alert.severity === "medium" ||
                              alert.severity === "warning") &&
                              "text-yellow-400",
                            alert.severity === "low" && "text-blue-400",
                            alert.severity === "info" && "text-gray-400"
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {alert.title}
                          </p>
                          {alert.message && (
                            <p className="mt-1 text-sm text-gray-400">
                              {alert.message}
                            </p>
                          )}
                          <p className="mt-1.5 text-xs text-gray-500">
                            {new Date(alert.created_at).toLocaleString()} ·{" "}
                            {alert.alert_type}
                            {alert.device_host && <> · {alert.device_host}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                            severityColors[alert.severity] ??
                              "border-gray-600 bg-gray-800 text-gray-300"
                          )}
                        >
                          {alert.severity}
                        </span>
                        {!alert.resolved && (
                          <button
                            type="button"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            className="rounded-lg bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30"
                          >
                            Resolver
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
