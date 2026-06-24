const API_BASE = "/api"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("nexus_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      body.detail || `HTTP ${response.status}`
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (
      email: string,
      name: string,
      password: string,
      role: string
    ) =>
      request<{ access_token: string; token_type: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name, password, role }),
      }),
    me: () =>
      request<{
        id: string
        email: string
        name: string
        role: string
        created_at: string
      }>("/auth/me"),
  },
  devices: {
    list: () =>
      request<
        {
          id: string
          name: string
          host: string
          port: number
          device_type: string
          tags: string | null
          status: string
          last_check: string | null
          response_time_ms: number | null
          created_at: string
        }[]
      >("/devices/"),
    probe: (host: string) =>
      request<{
        host: string
        results: {
          port: number
          device_type: string
          label: string
          open: boolean
          http_status: number | null
          server: string | null
        }[]
      }>("/devices/probe", {
        method: "POST",
        body: JSON.stringify({ host }),
      }),
    create: (data: {
      name: string
      host: string
      port: number
      device_type: string
      tags?: string
    }) =>
      request("/devices/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/devices/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/devices/${id}`, { method: "DELETE" }),
  },
  scans: {
    list: () =>
      request<
        {
          id: string
          device_id: string
          scan_type: string
          status: string
          severity: string | null
          score: number | null
          summary: string | null
          created_at: string
        }[]
      >("/scans/"),
    create: (device_id: string, scan_type: string) =>
      request("/scans/", {
        method: "POST",
        body: JSON.stringify({ device_id, scan_type }),
      }),
    get: (id: string) =>
      request<{
        id: string
        device_id: string
        scan_type: string
        status: string
        severity: string | null
        score: number | null
        summary: string | null
        created_by_id: string
        created_at: string
        started_at: string | null
        completed_at: string | null
        findings: {
          id: string
          check_type: string
          severity: string
          title: string
          description: string | null
          remediation: string | null
          created_at: string
        }[]
      }>(`/scans/${id}`),
  },
  dashboard: {
    stats: () =>
      request<{
        total_devices: number
        online_devices: number
        offline_devices: number
        total_scans: number
        critical_findings: number
        active_alerts: number
        total_alerts: number
        security_score: number | null
        findings_breakdown: {
          critical: number
          high: number
          medium: number
          low: number
          info: number
        }
        recent_scans: {
          id: string
          device_name: string
          scan_type: string
          severity: string | null
          score: number | null
          status: string
          created_at: string
        }[]
        recent_alerts: {
          id: string
          device_name: string
          title: string
          severity: string
          alert_type: string
          created_at: string
        }[]
      }>("/dashboard/stats"),
  },
  ai: {
    analyze: (scan_id: string) =>
      request<{
        overall_risk: string
        priority_order: string[]
        top_remediation: string
        summary: string
      }>("/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ scan_id }),
      }),
    chat: (message: string, scan_id?: string | null) =>
      request<{ response: string }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, scan_id }),
      }),
  },
  alerts: {
    list: (resolved?: boolean) =>
      request<
        {
          id: string
          device_id: string
          alert_type: string
          severity: string
          title: string
          message: string | null
          resolved: boolean
          created_at: string
        }[]
      >(`/alerts/${resolved !== undefined ? `?resolved=${resolved}` : ""}`),
    resolve: (id: string) =>
      request(`/alerts/${id}/resolve`, { method: "PUT" }),
  },
  webhooks: {
    list: () =>
      request<
        {
          id: string
          name: string
          provider: string
          url: string
          events: string
          enabled: boolean
          created_at: string
        }[]
      >("/webhooks/"),
    create: (data: {
      name: string
      provider: string
      url: string
      events: string
    }) =>
      request("/webhooks/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/webhooks/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/webhooks/${id}`, { method: "DELETE" }),
  },
}
