import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Database, RefreshCw, Trash2, Download, Save, CheckCircle, AlertCircle, Eye, EyeOff, Server, Clock, HardDrive } from 'lucide-react'

export default function Settings() {
  const [dbStats, setDbStats] = useState<any>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [showApiUrl, setShowApiUrl] = useState(false)
  
  const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'

  useEffect(() => {
    loadDbStats()
  }, [])

  const loadDbStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export`)
      const data = await response.json()
      console.log('📊 Stats chargées:', data.stats)
      setDbStats({
        totalCA: data.stats?.ca_total || 0,
        totalTransactions: data.stats?.nb_transactions || 0,
        totalClients: data.stats?.nb_clients || 0,
        lastUpdate: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Erreur chargement stats DB:', error)
    }
  }

  const clearAllCaches = () => {
    // Vider tous les caches du localStorage
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.includes('Cache') || key.includes('cache')) {
        localStorage.removeItem(key)
      }
    })
    
    // Recharger la page pour réinitialiser les caches en mémoire
    setCacheCleared(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num)
  }

  const formatEuro = (value: number) => {
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-gradient-to-br from-zinc-500 to-zinc-700 rounded-2xl">
            <SettingsIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Paramètres</h2>
            <p className="text-zinc-400">Configuration et maintenance de l'application</p>
          </div>
        </div>
      </div>

      {cacheCleared && (
        <div className="glass rounded-2xl p-4 border border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-semibold">Cache vidé avec succès !</p>
              <p className="text-sm text-zinc-400">Rechargement de la page...</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques Base de Données */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Base de Données</h3>
        </div>

        {dbStats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Chiffre d'Affaires</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatEuro(dbStats.totalCA)}</p>
              <p className="text-sm text-zinc-400 mt-1">Année 2025</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Transactions</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(dbStats.totalTransactions)}</p>
              <p className="text-sm text-zinc-400 mt-1">Total enregistré</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Clients</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(dbStats.totalClients)}</p>
              <p className="text-sm text-zinc-400 mt-1">Clients uniques</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">Prisma ORM</p>
                <p className="text-xs text-zinc-500">+ Neon PostgreSQL</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              Connecté
            </div>
          </div>
        </div>
      </div>

      {/* Configuration API */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Server className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Configuration API</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
            <label className="block text-sm font-semibold text-zinc-300 mb-3">URL de l'API</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type={showApiUrl ? 'text' : 'password'}
                  value={API_URL}
                  readOnly
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono text-sm"
                />
              </div>
              <button
                onClick={() => setShowApiUrl(!showApiUrl)}
                className="p-3 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                {showApiUrl ? <EyeOff className="w-5 h-5 text-zinc-400" /> : <Eye className="w-5 h-5 text-zinc-400" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Variable d'environnement: VITE_API_URL</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <p className="text-sm font-semibold text-white">Cache Duration</p>
              </div>
              <p className="text-2xl font-bold text-yellow-400">5 min</p>
              <p className="text-xs text-zinc-500 mt-1">Durée de mise en cache des données</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <p className="text-sm font-semibold text-white">APIs Actives</p>
              </div>
              <p className="text-2xl font-bold text-cyan-400">10</p>
              <p className="text-xs text-zinc-500 mt-1">Dashboard, RFM, Search, Stores, etc.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gestion du Cache */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <RefreshCw className="w-6 h-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Gestion du Cache</h3>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-300 mb-1">À propos du cache</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Les données sont mises en cache pendant 5 minutes pour améliorer les performances. 
                Si vous constatez des données obsolètes, utilisez ce bouton pour forcer le rechargement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={clearAllCaches}
            disabled={cacheCleared}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            Vider tous les caches
          </button>

          <button
            onClick={loadDbStats}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-zinc-800 border border-zinc-700 text-white font-semibold rounded-xl hover:bg-zinc-700 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Rafraîchir les stats
          </button>
        </div>
      </div>

      {/* Modules Disponibles */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">Modules Disponibles</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Dashboard', status: 'active', color: 'blue' },
            { name: 'Recherche', status: 'active', color: 'purple' },
            { name: 'RFM Analysis', status: 'active', color: 'pink' },
            { name: 'Sous-familles', status: 'active', color: 'cyan' },
            { name: 'Cross-Selling', status: 'active', color: 'emerald' },
            { name: 'Cohortes', status: 'active', color: 'orange' },
            { name: 'ABC Analysis', status: 'active', color: 'yellow' },
            { name: 'Performance Magasins', status: 'active', color: 'blue' },
            { name: 'Prévisions', status: 'active', color: 'purple' },
            { name: 'Réseaux Sociaux', status: 'active', color: 'pink' },
            { name: 'Exports', status: 'active', color: 'green' },
            { name: 'King Quentin', status: 'disabled', color: 'zinc' }
          ].map((module) => (
            <div
              key={module.name}
              className={`bg-zinc-900/50 rounded-xl p-4 border ${
                module.status === 'active' ? 'border-zinc-800' : 'border-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    module.status === 'active' ? `bg-${module.color}-400 animate-pulse` : 'bg-zinc-700'
                  }`}></div>
                  <p className={`text-sm font-semibold ${
                    module.status === 'active' ? 'text-white' : 'text-zinc-600'
                  }`}>
                    {module.name}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  module.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {module.status === 'active' ? 'Actif' : 'Désactivé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Version & Info */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="text-center space-y-2">
          <p className="text-zinc-500 text-sm">Decor Analytics v2.0</p>
          <p className="text-zinc-600 text-xs">Propulsé par Prisma + Neon PostgreSQL + Vercel</p>
          <p className="text-zinc-700 text-xs">© 2025 - Tous droits réservés</p>
        </div>
      </div>
    </div>
  )
}
