import { useQuery } from "@tanstack/react-query"
import { Bot, Send, Loader2, MessageSquare } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { api } from "@/api/client"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm Nexus AI, your security operations assistant. Ask me anything about your infrastructure, scan results, or security posture.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: scans } = useQuery({
    queryKey: ["scans"],
    queryFn: api.scans.list,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("nexus_token")}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          scan_id: selectedScanId,
        }),
      })
      const data = await response.json()
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process your request. Please try again.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      <div className="flex flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
          <Bot className="h-6 w-6 text-nexus-400" />
          <div>
            <h2 className="font-semibold text-white">Ask Nexus</h2>
            <p className="text-xs text-gray-500">
              AI-powered security analysis
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nexus-600/20">
                  <Bot className="h-4 w-4 text-nexus-400" />
                </div>
              )}
              <div
                className={`max-w-2xl rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-nexus-600 text-white"
                    : "bg-gray-800 text-gray-200"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nexus-600">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nexus-600/20">
                <Bot className="h-4 w-4 text-nexus-400" />
              </div>
              <div className="rounded-xl bg-gray-800 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-t border-gray-800 px-6 py-4"
        >
          <select
            value={selectedScanId ?? ""}
            onChange={(e) =>
              setSelectedScanId(e.target.value || null)
            }
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
          >
            <option value="">General chat</option>
            {(scans ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.scan_type} scan ({s.severity || "pending"})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about security, findings, or remediation..."
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-nexus-500 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
