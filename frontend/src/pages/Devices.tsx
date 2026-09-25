import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Globe, Loader2, Monitor, Plus, Trash2, Wifi, WifiOff } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"
import { clsx } from "clsx"
import { Button, EmptyState, PageHeader, PageSpinner } from "@/components/ui"

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
      return <Wifi className="h-4 w-4 text-emerald-400" />
    case "offline":
      return <WifiOff className="h-4 w-4 text-red-400" />
    default:
      return <Monitor className="h-4 w-4 text-faint" />
  }
}

const statusLabel = (status: string) => {
  switch (status) {
    case "online":
      return "en línea"
    case "offline":
      return "fuera de línea"
    default:
      return "desconocido"
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
      <PageHeader
        title="Dispositivos"
        description="Monitorea y administra tu infraestructura."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            Agregar dispositivo
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-line bg-surface p-6"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="device-name" className="nx-label">
                Nombre
              </label>
              <input
                id="device-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="nx-input"
                placeholder="Mi servidor web"
                required
              />
            </div>
            <div>
              <label htmlFor="device-url" className="nx-label">
                URL o dirección IP
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="device-url"
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="nx-input flex-1"
                  placeholder="example.com"
                  required
                />
                <Button
                  variant="secondary"
                  onClick={handleDetect}
                  disabled={probeMutation.isPending || !url.trim()}
                >
                  {probeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  Detectar
                </Button>
              </div>
            </div>

            {probeResults.length > 0 && (
              <div>
                <span className="nx-label">
                  Servicios detectados — haz clic para seleccionar
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {probeResults.map((r) => (
                    <button
                      type="button"
                      key={r.port}
                      onClick={() => setSelectedPort(r.port)}
                      className={clsx(
                        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                        selectedPort === r.port
                          ? "border-accent/60 bg-accent/10"
                          : "border-line bg-void hover:border-line-strong"
                      )}
                    >
                      <span className="text-sm font-medium text-ink">
                        Puerto {r.port}
                      </span>
                      <span className="text-xs text-dim">{r.label}</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
                          {r.device_type}
                        </span>
                        {r.http_status && (
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-400">
                            HTTP {r.http_status}
                          </span>
                        )}
                        {r.server && (
                          <span className="rounded bg-elevated px-1.5 py-0.5 text-faint">
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
              <div className="flex items-center gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                <Globe className="h-4 w-4 shrink-0" />
                No se detectaron servicios en los puertos comunes. Aún puedes
                agregar el dispositivo con un puerto personalizado.
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !url.trim()}
            >
              {createMutation.isPending ? "Agregando…" : "Agregar dispositivo"}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <PageSpinner label="Cargando dispositivos…" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(devices ?? []).map((device) => (
            <div
              key={device.id}
              className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated">
                    {statusIcon(device.status)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-ink">
                      {device.name}
                    </h3>
                    <p className="truncate font-mono text-sm text-faint">
                      {device.host}:{device.port}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar dispositivo"
                  onClick={() => deleteMutation.mutate(device.id)}
                  className="rounded-lg p-1.5 text-faint hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-faint">
                <span
                  className={clsx(
                    "rounded-full border px-2 py-0.5 font-medium",
                    device.status === "online" &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    device.status === "offline" &&
                      "border-red-500/30 bg-red-500/10 text-red-400",
                    device.status === "unknown" &&
                      "border-line-strong bg-elevated text-faint"
                  )}
                >
                  {statusLabel(device.status)}
                </span>
                {device.response_time_ms && (
                  <span>{device.response_time_ms} ms</span>
                )}
                {device.device_type && (
                  <span className="uppercase">{device.device_type}</span>
                )}
              </div>
            </div>
          ))}
          {(devices ?? []).length === 0 && (
            <EmptyState
              className="col-span-full"
              icon={<Monitor className="h-12 w-12" />}
              title="Aún no hay dispositivos"
              description="Agrega tu primer dispositivo para empezar a monitorear."
              action={
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowForm(true)}
                >
                  Agregar dispositivo
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
