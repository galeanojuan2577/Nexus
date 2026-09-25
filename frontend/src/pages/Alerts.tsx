import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Monitor, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"
import { clsx } from "clsx"
import { EmptyState, PageHeader, PageSpinner, SeverityBadge } from "@/components/ui"
import { ALERT_SEVERITY_LABEL } from "@/lib/labels"

const alertIconTone: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  warning: "text-yellow-400",
  low: "text-emerald-400",
  info: "text-faint",
}

const badgeSeverity = (severity: string) =>
  severity === "warning" ? "medium" : severity

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
      <PageHeader
        title="Alertas"
        description="Alertas filtradas por dispositivo, severidad y estado."
      />

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-faint">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dim">
            Dispositivo
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="nx-select w-auto"
            >
              <option value="">Todos</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-dim">
            Severidad
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="nx-select w-auto"
            >
              <option value="">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="warning">Aviso</option>
              <option value="low">Baja</option>
              <option value="info">Informativa</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-dim">
            Estado
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="nx-select w-auto"
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
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim transition-colors hover:bg-elevated hover:text-ink"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <PageSpinner label="Cargando alertas…" />
      ) : (alerts ?? []).length === 0 ? (
        <EmptyState
          tone="success"
          icon={<CheckCircle2 className="h-12 w-12" />}
          title="Sin alertas"
          description="No hay alertas con los filtros actuales."
        />
      ) : (
        <div className="space-y-6">
          {deviceKeys.map((devKey) => {
            const list = grouped[devKey]!
            const device = list[0]
            return (
              <section key={devKey} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-line pb-2">
                  <Monitor className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
                    {device?.device_name || devKey}
                  </h2>
                  {device?.device_host && (
                    <span className="font-mono text-xs text-faint">
                      {device.device_host}
                    </span>
                  )}
                  <span className="ml-auto rounded-full border border-line bg-elevated px-2 py-0.5 text-xs text-dim">
                    {list.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((alert) => (
                    <article
                      key={alert.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <AlertTriangle
                          className={clsx(
                            "mt-0.5 h-4 w-4 shrink-0",
                            alertIconTone[alert.severity] ?? "text-faint"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {alert.title}
                          </p>
                          {alert.message && (
                            <p className="mt-1 text-sm text-dim">
                              {alert.message}
                            </p>
                          )}
                          <p className="mt-1.5 text-xs text-faint">
                            {new Date(alert.created_at).toLocaleString()} ·{" "}
                            {alert.alert_type}
                            {alert.device_host && <> · {alert.device_host}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SeverityBadge
                          severity={badgeSeverity(alert.severity)}
                          label={
                            ALERT_SEVERITY_LABEL[alert.severity] ??
                            alert.severity
                          }
                          size="xs"
                        />
                        {!alert.resolved && (
                          <button
                            type="button"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
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
