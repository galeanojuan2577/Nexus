import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  LayoutDashboard,
  LogOut,
  Monitor,
  Shield,
} from "lucide-react"
import { Link, Outlet, useLocation } from "react-router-dom"
import ToastContainer from "@/components/Toast"
import { clsx } from "clsx"
import { useAuth } from "@/stores/auth"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/devices", icon: Monitor, label: "Devices" },
  { to: "/scans", icon: Shield, label: "Scans" },
  { to: "/ai", icon: Bot, label: "AI Chat" },
  { to: "/alerts", icon: AlertTriangle, label: "Alerts" },
  { to: "/webhooks", icon: Bell, label: "Webhooks" },
]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-5">
          <Activity className="h-7 w-7 text-nexus-500" />
          <span className="text-lg font-bold text-white">NEXUS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-nexus-600/20 text-nexus-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-200">
                {user?.name}
              </p>
              <p className="truncate text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-6">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
