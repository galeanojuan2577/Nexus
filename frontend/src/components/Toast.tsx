import { AlertTriangle, WifiOff, X } from "lucide-react"
import { useEffect, useState } from "react"

type Toast = {
  id: string
  title: string
  severity: string
  device_name: string
}

const colors: Record<string, string> = {
  critical: "border-red-500/60 bg-[#1a1114]",
  high: "border-orange-500/60 bg-[#1a1410]",
  medium: "border-yellow-500/60 bg-[#1a1810]",
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL
    const base = apiUrl
      ? apiUrl.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
    const ws = new WebSocket(`${base}/ws/dashboard`)

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
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border-l-4 p-4 shadow-2xl shadow-black/40 backdrop-blur ${
            colors[t.severity] ?? "border-line-strong bg-elevated"
          }`}
        >
          {t.severity === "critical" ? (
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t.title}</p>
            <p className="truncate text-xs text-dim">{t.device_name}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="shrink-0 text-faint hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
