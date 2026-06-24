import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Shield, ShieldCheck, ShieldOff } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/api/client"

const severityStyles: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  high: "border-orange-500/30 bg-orange-500/5",
  medium: "border-yellow-500/30 bg-yellow-500/5",
  low: "border-green-500/30 bg-green-500/5",
  pass: "border-blue-500/30 bg-blue-500/5",
}

const severityBadge: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-orange-500/10 text-orange-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  low: "bg-green-500/10 text-green-400",
  pass: "bg-blue-500/10 text-blue-400",
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => api.scans.get(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
      </div>
    )
  }

  if (!scan) {
    return (
      <div className="py-20 text-center text-gray-500">
        <ShieldOff className="mx-auto h-12 w-12" />
        <p className="mt-4 text-lg font-medium">Scan not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/scans")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to scans
      </button>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {scan.status === "completed" ? (
              <ShieldCheck className="h-8 w-8 text-green-400" />
            ) : scan.status === "failed" ? (
              <ShieldOff className="h-8 w-8 text-red-400" />
            ) : (
              <Shield className="h-8 w-8 text-yellow-400" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white">
                {scan.scan_type} Scan
              </h1>
              <p className="text-sm text-gray-400">{scan.id}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              severityBadge[scan.severity ?? "pass"] ?? ""
            }`}
          >
            {scan.severity ?? "unknown"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Findings ({scan.findings?.length ?? 0})
        </h2>
        {(scan.findings ?? []).length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-green-400" />
            <p className="mt-3 font-medium text-white">No issues found</p>
            <p className="mt-1 text-sm text-gray-500">
              This scan passed all checks
            </p>
          </div>
        )}
        {(scan.findings ?? []).map((finding) => (
          <div
            key={finding.id}
            className={`rounded-xl border p-5 ${
              severityStyles[finding.severity] ??
              "border-gray-800 bg-gray-900"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      severityBadge[finding.severity] ?? ""
                    }`}
                  >
                    {finding.severity}
                  </span>
                  <span className="text-xs text-gray-500">
                    {finding.check_type}
                  </span>
                </div>
                <h3 className="mt-2 font-medium text-white">
                  {finding.title}
                </h3>
                {finding.description && (
                  <p className="mt-1 text-sm text-gray-400">
                    {finding.description}
                  </p>
                )}
                {finding.remediation && (
                  <div className="mt-3 rounded-lg bg-nexus-600/10 border border-nexus-600/20 px-4 py-3">
                    <p className="text-xs font-medium text-nexus-400 uppercase tracking-wider">
                      Remediation
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      {finding.remediation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
