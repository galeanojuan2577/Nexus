import { AlertTriangle, WifiOff, X } from "lucide-react"
import { useEffect, useState } from "react"

type Toast = {
  id: string
  title: string
  severity: string
  device_name: string
}

const colors: Record<string, string> = {
  critical: "border-red-500 bg-red-500/10",
  high: "border-orange-500 bg-orange-500/10",
  medium: "border-yellow-500 bg-yellow-500/10",
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/dashboard`)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === "alert.new") {
          const toast: Toast = {
            id: msg.data.id,
            title: msg.data.title,
            severity: msg.data.severity,
            device_name: msg.data.device_name,
          }
          setToasts((prev) => [toast, ...prev].slice(0, 5))
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id))
          }, 6000)
        }
      } catch {}
    }

    return () => ws.close()
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm ${
            colors[t.severity] || "border-gray-700 bg-gray-900"
          }`}
        >
          {t.severity === "critical" ? (
            <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{t.title}</p>
            <p className="text-xs text-gray-400">{t.device_name}</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
