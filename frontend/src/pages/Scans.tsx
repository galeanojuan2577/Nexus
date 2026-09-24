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

const severityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-green-400 bg-green-500/10",
  pass: "text-blue-400 bg-blue-500/10",
}

const LEVEL_OPTIONS = [
  { value: "quick", level: 1, label: "Quick", hint: "L1 · 5–15 min" },
  { value: "normal", level: 2, label: "Normal", hint: "L2 · 15–45 min" },
  { value: "deep", level: 3, label: "Deep", hint: "L3 · más profundo" },
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
      <div>
        <h1 className="text-2xl font-bold text-white">Scans</h1>
        <p className="mt-1 text-sm text-gray-400">
          Security scan history, live progress and SOC interpretation
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Scan level
          </span>
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setScanType(opt.value)
                setLevel(opt.level)
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                scanType === opt.value
                  ? "border-nexus-500 bg-nexus-600/20 text-white"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="ml-2 text-xs opacity-70">{opt.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Authorization required.</span> Only
            scan targets you own or have explicit written permission to test.
            You are responsible for how these tools are used against each
            target.
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Tools that will run · {LEVEL_OPTIONS.find((o) => o.level === level)?.label} (L{level})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEVEL_TOOLS[level].map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
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
                onClick={() =>
                  scanMutation.mutate({
                    device_id: device.id,
                    scan_type: scanType,
                    level,
                  })
                }
                disabled={scanMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                <Shield className="h-4 w-4" />
                Scan {device.name} ({scanType} · L{level})
              </button>
            ))}
          </div>
        )}
      </div>

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
                Pick a level and run a scan on a device
              </p>
            </div>
          )}
          {(scans ?? []).map((scan) => (
            <div
              key={scan.id}
              onClick={() => navigate(`/scans/${scan.id}`)}
              className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={
                      scan.status === "completed"
                        ? "text-green-400"
                        : scan.status === "failed"
                          ? "text-red-400"
                          : scan.status === "cancelled"
                            ? "text-gray-400"
                            : "text-yellow-400"
                    }
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
                    <p className="flex flex-wrap items-center gap-2 font-medium text-white">
                      <span className="truncate">
                        {scan.device_name ?? "Device"}
                      </span>
                      {scan.target && (
                        <span className="font-mono text-xs font-normal text-gray-500">
                          {scan.target}
                        </span>
                      )}
                      <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nexus-300">
                        {scan.level === 1
                          ? "Quick · L1"
                          : scan.level === 2
                            ? "Normal · L2"
                            : "Deep · L3"}
                      </span>
                      <span className="text-xs font-normal text-gray-500">
                        {scan.scan_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(scan.created_at).toLocaleString()}
                    </p>
                    {isActive(scan.status) && scan.stage && (
                      <p className="text-xs text-nexus-400">
                        stage: {scan.stage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isActive(scan.status) && (
                    <div className="flex flex-col items-end gap-1 min-w-[120px]">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full bg-nexus-500 transition-all"
                          style={{ width: `${scan.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
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
                        Cancel
                      </button>
                    </div>
                  )}
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
                            : scan.status === "cancelled"
                              ? "bg-gray-500/10 text-gray-400"
                              : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {scan.status}
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
