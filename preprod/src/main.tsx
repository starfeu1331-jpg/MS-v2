import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './output.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './context/AuthContext.tsx'
import LoginPage from './components/Shared/LoginPage.tsx'

function Root() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 skel-breath">
            <div className="w-12 h-12 bg-zinc-800 rounded-2xl" />
            <div className="h-7 w-48 bg-zinc-800 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-4 skel-breath skel-d1">
            {[0,1,2].map(i => <div key={i} className="h-24 bg-zinc-800/50 rounded-2xl border border-zinc-800" />)}
          </div>
          <div className="h-64 bg-zinc-800/30 rounded-2xl border border-zinc-800 skel-breath skel-d2" />
        </div>
      </div>
    )
  }
  if (!user) return <LoginPage />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
