import { UserPlus } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { NexusLogo } from "@/components/ui"
import { useAuth } from "@/stores/auth"

export default function Register() {
  const { register, token } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await register(email, name, password, "viewer")
      navigate("/")
    } catch (err: any) {
      setError(err.message || "No se pudo crear la cuenta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-void lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-panel lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 30% 20%, #000 30%, transparent 75%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative px-12 pt-12">
          <div className="flex items-center gap-3">
            <NexusLogo size={40} />
            <span className="text-xl font-bold tracking-[0.3em] text-ink">
              NEXUS
            </span>
          </div>
          <h2 className="mt-14 max-w-md text-3xl font-bold leading-tight tracking-tight text-ink">
            Únete a la plataforma de operaciones de seguridad
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-dim">
            Crea tu cuenta para empezar a registrar dispositivos, lanzar
            escaneos y seguir alertas en tiempo real.
          </p>
        </div>

        <div className="relative px-12 pb-10 text-xs text-faint">
          Juan Diego Galeano Chica · Ingeniero en Telecomunicaciones
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <NexusLogo size={36} showWordmark />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Registro
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            Crear una cuenta
          </h1>
          <p className="mt-1 text-sm text-faint">
            Completa tus datos para registrarte en NEXUS.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="name" className="nx-label">
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="nx-input"
                placeholder="Tu nombre"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="nx-label">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="nx-input"
                placeholder="tu@correo.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="nx-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="nx-input"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-void transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-faint">
            ¿Ya tienes una cuenta?{" "}
            <Link
              to="/login"
              className="font-medium text-accent hover:text-accent-soft"
            >
              Inicia sesión
            </Link>
          </p>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-faint/70 lg:hidden">
            Juan Diego Galeano Chica · Ingeniero en Telecomunicaciones
          </p>
        </div>
      </div>
    </div>
  )
}
