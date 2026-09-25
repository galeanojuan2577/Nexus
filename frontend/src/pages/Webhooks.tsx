import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"
import { Button, EmptyState, PageHeader, PageSpinner, StatusBadge } from "@/components/ui"

type Webhook = {
  id: string
  name: string
  provider: string
  url: string
  events: string
  enabled: boolean
  created_at: string
}

export default function Webhooks() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [provider, setProvider] = useState("slack")
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState("downtime")

  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ["webhooks"],
    queryFn: api.webhooks.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      provider: string
      url: string
      events: string
    }) => api.webhooks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] })
      setShowForm(false)
      setName("")
      setUrl("")
      setProvider("slack")
      setEvents("downtime")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ name, provider, url, events })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Envía alertas a Slack, Telegram o correo."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            Agregar webhook
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-line bg-surface p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wh-name" className="nx-label">
                Nombre
              </label>
              <input
                id="wh-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="nx-input"
                placeholder="Dev Slack"
                required
              />
            </div>
            <div>
              <label htmlFor="wh-provider" className="nx-label">
                Proveedor
              </label>
              <select
                id="wh-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="nx-select"
              >
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="email">Correo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="wh-url" className="nx-label">
                URL del webhook
              </label>
              <input
                id="wh-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="nx-input"
                placeholder={
                  provider === "slack"
                    ? "https://hooks.slack.com/services/..."
                    : provider === "telegram"
                      ? "https://api.telegram.org/bot<token>/sendMessage"
                      : "https://mail.example.com/send"
                }
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="wh-events" className="nx-label">
                Eventos (separados por coma)
              </label>
              <input
                id="wh-events"
                type="text"
                value={events}
                onChange={(e) => setEvents(e.target.value)}
                className="nx-input"
                placeholder="downtime, critical finding"
              />
              <p className="mt-1 text-xs text-faint">
                Eventos disponibles: downtime, critical finding, warning finding
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creando…" : "Crear webhook"}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <PageSpinner label="Cargando webhooks…" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(webhooks ?? []).map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-accent">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-ink">
                      {webhook.name}
                    </h3>
                    <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {webhook.provider}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar webhook"
                  onClick={() => deleteMutation.mutate(webhook.id)}
                  className="rounded-lg p-1.5 text-faint hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 text-sm text-dim">
                <p className="truncate font-mono text-xs">{webhook.url}</p>
                <p className="mt-1.5 text-xs text-faint">
                  Eventos: {webhook.events}
                </p>
              </div>
              <div className="mt-3">
                <StatusBadge
                  status={webhook.enabled ? "online" : "unknown"}
                  label={webhook.enabled ? "Habilitado" : "Deshabilitado"}
                />
              </div>
            </div>
          ))}
          {(webhooks ?? []).length === 0 && (
            <EmptyState
              className="col-span-full"
              icon={<Bell className="h-12 w-12" />}
              title="Aún no hay webhooks"
              description="Configura webhooks para recibir notificaciones de alertas."
            />
          )}
        </div>
      )}
    </div>
  )
}
