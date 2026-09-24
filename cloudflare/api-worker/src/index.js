const ALLOWED = new Set([
  "https://nexus-f0u.pages.dev",
  "https://nexus-frontend-got9.onrender.com",
  "https://nexus-frontend.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
]);

function corsHeaders(origin) {
  const allow = ALLOWED.has(origin) ? origin : "https://nexus-f0u.pages.dev";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Metrics-Token",
    "Access-Control-Expose-Headers": "Content-Disposition",
    Vary: "Origin",
  };
}

function isWebSocket(request) {
  return (request.headers.get("Upgrade") || "").toLowerCase() === "websocket";
}

async function resolveOrigin(env) {
  if (env.NEXUS_CONFIG) {
    try {
      const v = await env.NEXUS_CONFIG.get("ORIGIN");
      if (v && v.trim()) return v.trim();
    } catch {}
  }
  if (env.ORIGIN) return env.ORIGIN;
  return null;
}

function pipeWs(a, b) {
  a.addEventListener("message", (event) => {
    try {
      b.send(event.data);
    } catch {}
  });
  a.addEventListener("close", (event) => {
    try {
      b.close(event.code, event.reason);
    } catch {}
  });
  a.addEventListener("error", () => {
    try {
      b.close(1011, "ws error");
    } catch {}
  });
}

async function proxyWebSocket(request, originUrl) {
  const url = new URL(request.url);
  const base = originUrl.endsWith("/") ? originUrl.slice(0, -1) : originUrl;
  const target = base.replace(/^http/, "ws") + url.pathname + url.search;

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  const upstream = new WebSocket(target);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("upstream open timeout")), 12000);
    upstream.addEventListener("open", () => { clearTimeout(t); resolve(undefined); }, { once: true });
    upstream.addEventListener("error", () => { clearTimeout(t); reject(new Error("upstream ws error")); }, { once: true });
  });

  pipeWs(server, upstream);
  pipeWs(upstream, server);
  return new Response(null, { status: 101, webSocket: client });
}

async function proxyHttp(request, originUrl) {
  const url = new URL(request.url);
  const base = originUrl.endsWith("/") ? originUrl.slice(0, -1) : originUrl;
  const target = base + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const res = await fetch(target, init);
  const out = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(request.headers.get("Origin") || ""))) {
    out.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const base = await resolveOrigin(env);
    if (!base) {
      return new Response(JSON.stringify({ detail: "ORIGIN not configured" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
    try {
      if (isWebSocket(request)) return await proxyWebSocket(request, base);
      return await proxyHttp(request, base);
    } catch (e) {
      return new Response(
        JSON.stringify({ detail: "Upstream error", error: String((e && e.message) || e) }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }
  },
};
