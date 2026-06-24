import { useEffect, useRef, useCallback } from "react"

type EventHandler = (data: any) => void

export function useWebSocket(
  clientId: string,
  handlers: Record<string, EventHandler>
) {
  const wsRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const url = `${protocol}//${host}/api/ws/${clientId}`

    const ws = new WebSocket(url)
    ws.onopen = () => console.log("WebSocket connected")
    ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data)
        handlers[eventName]?.(data)
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => {
      setTimeout(connect, 3000)
    }
    wsRef.current = ws
  }, [clientId, handlers])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}
