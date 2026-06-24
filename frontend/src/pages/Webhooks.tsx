import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { api } from "@/api/client"

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-400">
            Send alerts to Slack, Telegram, or email
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-700"
        >
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-800 bg-gray-900 p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                placeholder="Dev Slack"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
              >
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300">
                Webhook URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
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
              <label className="block text-sm font-medium text-gray-300">
                Events (comma-separated)
              </label>
              <input
                type="text"
                value={events}
                onChange={(e) => setEvents(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                placeholder="downtime, critical finding"
              />
              <p className="mt-1 text-xs text-gray-500">
                Events: downtime, critical finding, warning finding
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
          {(webhooks ?? []).map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-nexus-400" />
                  <div>
                    <h3 className="font-medium text-white">{webhook.name}</h3>
                    <span className="inline-block rounded-full bg-nexus-500/10 px-2 py-0.5 text-xs font-medium text-nexus-400">
                      {webhook.provider}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(webhook.id)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 text-sm text-gray-400">
                <p className="truncate">{webhook.url}</p>
                <p className="mt-1">Events: {webhook.events}</p>
              </div>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    webhook.enabled
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {webhook.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
          {(webhooks ?? []).length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500">
              <Bell className="mx-auto h-12 w-12" />
              <p className="mt-4 text-lg font-medium">No webhooks yet</p>
              <p className="mt-1 text-sm">
                Configure webhooks to get notified of alerts
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
