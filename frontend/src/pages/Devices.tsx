import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Globe, Loader2, Monitor, Plus, Trash2, Wifi, WifiOff } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"
import { clsx } from "clsx"

type ProbeResult = {
  port: number
  device_type: string
  label: string
  open: boolean
  http_status: number | null
  server: string | null
}

const statusIcon = (status: string) => {
  switch (status) {
    case "online":
      return <Wifi className="h-4 w-4 text-green-400" />
    case "offline":
      return <WifiOff className="h-4 w-4 text-red-400" />
    default:
      return <Monitor className="h-4 w-4 text-gray-500" />
  }
}

export default function Devices() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([])
  const [probeAttempted, setProbeAttempted] = useState(false)
  const [selectedPort, setSelectedPort] = useState<number | null>(null)

  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: api.devices.list,
    refetchInterval: 15000,
  })

  const probeMutation = useMutation({
    mutationFn: (host: string) => api.devices.probe(host),
    onSuccess: (data) => {
      setProbeResults(data.results)
      setProbeAttempted(true)
      if (data.results.length > 0) {
        setSelectedPort(data.results[0].port)
      }
    },
    onError: () => {
      setProbeAttempted(true)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      host: string
      port: number
      device_type: string
    }) => api.devices.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.devices.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["devices"] }),
  })

  const resetForm = () => {
    setShowForm(false)
    setName("")
    setUrl("")
    setProbeResults([])
    setProbeAttempted(false)
    setSelectedPort(null)
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setProbeResults([])
    setProbeAttempted(false)
    setSelectedPort(null)
  }

  const handleDetect = () => {
    if (!url.trim()) return
    probeMutation.mutate(url.trim())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return

    const port = selectedPort
    let host = url.trim()
    let deviceType = "http"

    if (port !== null) {
      const match = probeResults.find((r) => r.port === port)
      if (match) deviceType = match.device_type
    } else {
      const hasScheme = host.match(/^https?:\/\//)
      deviceType = hasScheme && hasScheme[0] === "https://" ? "https" : "http"
      if (host.includes(":")) {
        const parts = host.split(":")
        host = parts[0].replace(/^https?:\/\//, "")
      }
    }
    host = host.replace(/^https?:\/\//, "").split("/")[0]

    createMutation.mutate({
      name: name.trim(),
      host,
      port: port ?? (deviceType === "https" ? 443 : 80),
      device_type: deviceType,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="mt-1 text-sm text-gray-400">
            Monitor and manage your infrastructure
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-700"
        >
          <Plus className="h-4 w-4" />
          Add Device
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-800 bg-gray-900 p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
                placeholder="My Web Server"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                URL or IP Address
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="block flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="example.com"
                  required
                />
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={probeMutation.isPending || !url.trim()}
                  className="flex items-center gap-2 rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-700 disabled:opacity-50"
                >
                  {probeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  Detect
                </button>
              </div>
            </div>

            {probeResults.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Detected services — click to select
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {probeResults.map((r) => (
                    <button
                      type="button"
                      key={r.port}
                      onClick={() => setSelectedPort(r.port)}
                      className={clsx(
                        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                        selectedPort === r.port
                          ? "border-nexus-500 bg-nexus-500/10"
                          : "border-gray-700 bg-gray-800 hover:border-gray-600"
                      )}
                    >
                      <span className="text-sm font-medium text-white">
                        Port {r.port}
                      </span>
                      <span className="text-xs text-gray-400">{r.label}</span>
                      <div className="mt-1 flex gap-2 text-xs">
                        <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400">
                          {r.device_type}
                        </span>
                        {r.http_status && (
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                            HTTP {r.http_status}
                          </span>
                        )}
                        {r.server && (
                          <span className="rounded bg-gray-500/10 px-1.5 py-0.5 text-gray-400">
                            {r.server}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {probeAttempted && probeResults.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                <Globe className="h-4 w-4 flex-shrink-0" />
                No services detected on common ports. You can still add the device with a custom port.
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !url.trim()}
              className="rounded-lg bg-nexus-600 px-5 py-2 text-sm font-medium text-white hover:bg-nexus-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding..." : "Add Device"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(devices ?? []).map((device) => (
            <div
              key={device.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(device.status)}
                  <div>
                    <h3 className="font-medium text-white">{device.name}</h3>
                    <p className="text-sm text-gray-400">
                      {device.host}:{device.port}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(device.id)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 font-medium",
                    device.status === "online" &&
                      "bg-green-500/10 text-green-400",
                    device.status === "offline" &&
                      "bg-red-500/10 text-red-400",
                    device.status === "unknown" &&
                      "bg-gray-500/10 text-gray-400"
                  )}
                >
                  {device.status}
                </span>
                {device.response_time_ms && (
                  <span>{device.response_time_ms}ms</span>
                )}
                {device.device_type && (
                  <span className="uppercase">{device.device_type}</span>
                )}
              </div>
            </div>
          ))}
          {(devices ?? []).length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500">
              <Monitor className="mx-auto h-12 w-12" />
              <p className="mt-4 text-lg font-medium">No devices yet</p>
              <p className="mt-1 text-sm">
                Add your first device to start monitoring
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
