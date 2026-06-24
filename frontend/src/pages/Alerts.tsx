import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle, Info } from "lucide-react"
import { api } from "@/api/client"

const severityIcon = (severity: string) => {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-400" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-400" />
    default:
      return <Info className="h-5 w-5 text-blue-400" />
  }
}

export default function Alerts() {
  const queryClient = useQueryClient()

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.alerts.list(false),
    refetchInterval: 15000,
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.alerts.resolve(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="mt-1 text-sm text-gray-400">
          Active alerts requiring attention
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {(alerts ?? []).length === 0 && (
            <div className="py-20 text-center text-gray-500">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p className="mt-4 text-lg font-medium">All clear</p>
              <p className="mt-1 text-sm">No active alerts</p>
            </div>
          )}
          {(alerts ?? []).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="flex items-start gap-4">
                {severityIcon(alert.severity)}
                <div>
                  <p className="font-medium text-white">{alert.title}</p>
                  {alert.message && (
                    <p className="mt-1 text-sm text-gray-400">
                      {alert.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString()}
                    {" · "}
                    {alert.alert_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    alert.severity === "critical"
                      ? "bg-red-500/10 text-red-400"
                      : alert.severity === "warning"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {alert.severity}
                </span>
                <button
                  onClick={() => resolveMutation.mutate(alert.id)}
                  className="rounded-lg bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
