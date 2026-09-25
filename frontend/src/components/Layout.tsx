import {
  AlertTriangle,
  Bell,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Shield,
  X,
} from "lucide-react"
import { Link, Outlet, useLocation } from "react-router-dom"
import ToastContainer from "@/components/Toast"
import { clsx } from "clsx"
import { useEffect, useState } from "react"
import { NexusLogo } from "@/components/ui"
import { useAuth } from "@/stores/auth"

const navGroups = [
  {
    label: "Monitoreo",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Panel" },
      { to: "/devices", icon: Monitor, label: "Dispositivos" },
      { to: "/scans", icon: Shield, label: "Escaneos" },
    ],
  },
  {
    label: "Respuesta",
    items: [
      { to: "/alerts", icon: AlertTriangle, label: "Alertas" },
      { to: "/webhooks", icon: Bell, label: "Webhooks" },
    ],
  },
]

const routeLabel = (pathname: string): string => {
  if (pathname === "/") return "Panel"
  if (pathname.startsWith("/scans/")) return "Escaneos / Detalle"
  if (pathname.startsWith("/devices")) return "Dispositivos"
  if (pathname.startsWith("/scans")) return "Escaneos"
  if (pathname.startsWith("/alerts")) return "Alertas"
  if (pathname.startsWith("/webhooks")) return "Webhooks"
  return "NEXUS"
}

const initials = (name?: string | null): string => {
  if (!name) return "N"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "N"
}

function isActivePath(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to)
}

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-void text-ink">
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-panel transition-transform duration-200",
          "lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <NexusLogo size={26} />
            <span className="text-[15px] font-bold tracking-[0.22em] text-ink">
              NEXUS
            </span>
          </Link>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-faint hover:bg-elevated hover:text-ink lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActivePath(location.pathname, item.to)
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={clsx(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-dim hover:bg-elevated hover:text-ink"
                        )}
                      >
                        <item.icon
                          className={clsx(
                            "h-4 w-4",
                            active ? "text-accent" : "text-faint"
                          )}
                        />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs font-bold text-accent">
              {initials(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {user?.name}
              </p>
              <p className="truncate text-[11px] uppercase tracking-wide text-faint">
                {user?.role}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={logout}
              className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-2 text-[10px] leading-relaxed text-faint/70">
            Juan Diego Galeano Chica · Ing. Telecomunicaciones
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 lg:px-8">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-dim hover:bg-elevated hover:text-ink lg:hidden"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-faint sm:inline">NEXUS</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-faint sm:inline" />
            <span className="truncate font-medium text-ink">
              {routeLabel(location.pathname)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Operativo
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-[11px] font-bold text-accent">
              {initials(user?.name)}
            </span>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={logout}
              className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
