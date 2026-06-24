import { Activity } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
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
      setError(err.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Activity className="mx-auto h-10 w-10 text-nexus-500" />
          <h1 className="mt-4 text-2xl font-bold text-white">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Join NEXUS platform
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-nexus-500 focus:outline-none focus:ring-1 focus:ring-nexus-500"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-nexus-500 focus:outline-none focus:ring-1 focus:ring-nexus-500"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-nexus-500 focus:outline-none focus:ring-1 focus:ring-nexus-500"
              placeholder="Minimum 6 characters"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-nexus-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-nexus-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-nexus-400 hover:text-nexus-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
