import { useEffect, useRef, useCallback } from "react"

type EventHandler = (data: any) => void

export function useWebSocket(
  clientId: string | null | undefined,
  handlers: Record<string, EventHandler>
) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const closedRef = useRef(false)

  const connect = useCallback(() => {
    if (!clientId) return
    const apiUrl = import.meta.env.VITE_API_URL
    const base = apiUrl
      ? apiUrl.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
    const url = `${base}/ws/${clientId}`

    const ws = new WebSocket(url)
    ws.onopen = () => console.log("WebSocket connected", clientId)
    ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data)
        handlersRef.current[eventName]?.(data)
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => {
      if (closedRef.current) return
      setTimeout(connect, 3000)
    }
    wsRef.current = ws
  }, [clientId])

  useEffect(() => {
    closedRef.current = false
    connect()
    return () => {
      closedRef.current = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return wsRef
}
