import { useState, FormEvent } from 'react'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div style={{ width: '420px', maxWidth: '100%' }}>
        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-700">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/Logo%20Magic%20Système%20texte.png"
              alt="Magic Système"
              className="h-16 object-contain mb-6"
            />
            <h1 className="text-2xl font-black text-white">Connexion</h1>
            <p className="text-zinc-500 text-sm mt-1">Plateforme Analytics</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="prenom.nom@decor-discount.com"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(24,24,27)] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Mot de passe
              </label>
              <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl focus-within:border-blue-500 transition-colors">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="flex-1 px-4 py-3 bg-transparent text-white placeholder-zinc-600 focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(24,24,27)] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-center" style={{ marginTop: '2.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Se connecter
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Session active 8h · Données sécurisées
          </p>
        </div>
      </div>
    </div>
  )
}
