import { lazy, Suspense, useEffect } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/stores/auth"
import Layout from "@/components/Layout"

const Login = lazy(() => import("@/pages/Login"))
const Register = lazy(() => import("@/pages/Register"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Devices = lazy(() => import("@/pages/Devices"))
const Scans = lazy(() => import("@/pages/Scans"))
const ScanDetail = lazy(() => import("@/pages/ScanDetail"))
const Alerts = lazy(() => import("@/pages/Alerts"))
const AIChat = lazy(() => import("@/pages/AIChat"))
const Webhooks = lazy(() => import("@/pages/Webhooks"))

function Spinner() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { loadUser, loading } = useAuth()

  useEffect(() => {
    loadUser()
  }, [loadUser])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="devices" element={<Devices />} />
          <Route path="scans" element={<Scans />} />
          <Route path="scans/:id" element={<ScanDetail />} />
          <Route path="ai" element={<AIChat />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="webhooks" element={<Webhooks />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
