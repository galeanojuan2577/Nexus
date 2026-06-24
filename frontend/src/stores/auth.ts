import { create } from "zustand"
import { api } from "@/api/client"

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    name: string,
    password: string,
    role: string
  ) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("nexus_token"),
  loading: true,
  login: async (email, password) => {
    const result = await api.auth.login(email, password)
    localStorage.setItem("nexus_token", result.access_token)
    set({ token: result.access_token })
    const user = await api.auth.me()
    set({ user })
  },
  register: async (email, name, password, role) => {
    const result = await api.auth.register(email, name, password, role)
    localStorage.setItem("nexus_token", result.access_token)
    set({ token: result.access_token })
    const user = await api.auth.me()
    set({ user })
  },
  logout: () => {
    localStorage.removeItem("nexus_token")
    set({ user: null, token: null })
  },
  loadUser: async () => {
    const token = localStorage.getItem("nexus_token")
    if (!token) {
      set({ loading: false })
      return
    }
    try {
      const user = await api.auth.me()
      set({ user, loading: false })
    } catch {
      localStorage.removeItem("nexus_token")
      set({ user: null, token: null, loading: false })
    }
  },
}))
