import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'VIEWER'

export interface AuthUser {
  id: string
  email: string
  nom: string
  prenom: string
  role: UserRole
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
  canAccess: (module: string) => boolean
}

const PERMISSIONS: Record<string, UserRole[]> = {
  dashboard:    ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'],
  search:       ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  rfm:          ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  subFamilies:  ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  crossSelling: ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  cohortes:     ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  abc:          ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  kingquentin:  ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  zones:        ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  stores:       ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'],
  forecast:     ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  social:       ['SUPER_ADMIN', 'ADMIN', 'ANALYST'],
  exports:      ['SUPER_ADMIN', 'ADMIN'],
  settings:     ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'],
  admin:        ['SUPER_ADMIN'],
}

const TOKEN_KEY = 'magic_token'

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.id) setUser(data)
        else localStorage.removeItem(TOKEN_KEY)
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error || 'Erreur de connexion' }
      localStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      return {}
    } catch {
      return { error: 'Impossible de se connecter au serveur' }
    }
  }

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {})
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const canAccess = (module: string): boolean => {
    if (!user) return false
    return (PERMISSIONS[module] || []).includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}
