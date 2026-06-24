import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Shield, ShieldCheck, ShieldOff } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "@/api/client"

const severityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-green-400 bg-green-500/10",
  pass: "text-blue-400 bg-blue-500/10",
}

export default function Scans() {
  const queryClient = useQueryClient()
  const { data: devices } = useQuery({
    queryKey: ["devices"],
    queryFn: api.devices.list,
  })
  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: api.scans.list,
    refetchInterval: 10000,
  })

  const navigate = useNavigate()
  const scanMutation = useMutation({
    mutationFn: ({
      device_id,
      scan_type,
    }: {
      device_id: string
      scan_type: string
    }) => api.scans.create(device_id, scan_type),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["scans"] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Scans</h1>
        <p className="mt-1 text-sm text-gray-400">
          Security scan history and results
        </p>
      </div>

      {devices && devices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(devices ?? []).map((device) => (
            <button
              key={device.id}
              onClick={() =>
                scanMutation.mutate({
                  device_id: device.id,
                  scan_type: "quick",
                })
              }
              disabled={scanMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              Scan {device.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {(scans ?? []).length === 0 && (
            <div className="py-20 text-center text-gray-500">
              <ShieldCheck className="mx-auto h-12 w-12" />
              <p className="mt-4 text-lg font-medium">No scans yet</p>
              <p className="mt-1 text-sm">
                Run a scan on a device to get started
              </p>
            </div>
          )}
          {(scans ?? []).map((scan) => (
            <div
              key={scan.id}
              onClick={() => navigate(`/scans/${scan.id}`)}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-center gap-4">
                <div
                  className={
                    scan.status === "completed"
                      ? "text-green-400"
                      : scan.status === "failed"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }
                >
                  {scan.status === "completed" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : scan.status === "failed" ? (
                    <ShieldOff className="h-5 w-5" />
                  ) : (
                    <Shield className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {scan.scan_type} scan
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(scan.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {scan.severity && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      severityColor[scan.severity] || ""
                    }`}
                  >
                    {scan.severity}
                  </span>
                )}
                {scan.score !== null && (
                  <span className="text-sm font-bold text-white">
                    {scan.score}/100
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    scan.status === "completed"
                      ? "bg-green-500/10 text-green-400"
                      : scan.status === "running"
                        ? "bg-blue-500/10 text-blue-400"
                        : scan.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {scan.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
