import { TrendingUp, Calendar, Target } from 'lucide-react'
import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache global
let cohortCache: { data: any; timestamp: number } | null = null

export default function CohortAnalysis() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier le cache
        const now = Date.now()
        if (cohortCache && (now - cohortCache.timestamp < CACHE_DURATION)) {
          console.log('🔍 Cohortes: Utilisation cache')
          setData(cohortCache.data)
          setLoading(false)
          return
        }

        console.log('🔄 Cohortes: Chargement depuis API')
        setLoading(true)
        
        const response = await fetch(`${API_URL}/api/cohortes`)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        
        const result = await response.json()
        
        // Mettre en cache
        cohortCache = { data: result, timestamp: Date.now() }
        
        setData(result)
        console.log('✅ Cohortes: Données chargées')
      } catch (err: any) {
        console.error('❌ Erreur chargement Cohortes:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-red-400">Erreur: {error}</div></div>
  }
  
  if (!data || !data.cohortes) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée</div></div>
  }
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  
  // Préparer les données de cohortes
  const cohortes = Object.entries(data.cohortes)
    .map(([month, stats]: [string, any]) => ({
      month,
      clients: stats.clients.size,
      ca: stats.ca,
      volume: stats.volume,
      caPerClient: stats.ca / stats.clients.size,
      volumePerClient: stats.volume / stats.clients.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
  
  const totalClients = cohortes.reduce((sum, c) => sum + c.clients, 0)
  const totalCA = cohortes.reduce((sum, c) => sum + c.ca, 0)
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Analyse de Cohortes</h2>
            <p className="text-zinc-400">Clients groupés par mois de première visite</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Cohortes</p>
            <p className="text-2xl font-bold text-white mt-1">{cohortes.length}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Total Clients</p>
            <p className="text-2xl font-bold text-white mt-1">{totalClients.toLocaleString('fr-FR')}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCA)}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Moyen / Client</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCA / totalClients)}</p>
          </div>
        </div>
      </div>
      
      {/* Tableau des cohortes */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">📊 Performance par Cohorte</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Cohorte (Mois)</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Clients</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">% Total</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">CA Total</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">CA / Client</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Achats Totaux</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Achats / Client</th>
              </tr>
            </thead>
            <tbody>
              {cohortes.map((cohort, idx) => (
                <tr key={cohort.month} className={`border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${idx === 0 ? 'bg-indigo-500/10' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">{cohort.month}</span>
                      {idx === 0 && <span className="text-xs px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-400">Nouvelle</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">{cohort.clients.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{((cohort.clients / totalClients) * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatEuro(cohort.ca)}</td>
                  <td className="px-4 py-3 text-right text-sm text-cyan-400">{formatEuro(cohort.caPerClient)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-zinc-300">{cohort.volume.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{cohort.volumePerClient.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-bold text-white">Meilleure Cohorte (CA/Client)</h3>
          </div>
          {(() => {
            const best = [...cohortes].sort((a, b) => b.caPerClient - a.caPerClient)[0]
            return (
              <div className="bg-green-500/10 rounded-2xl p-5 border border-green-500/20">
                <div className="text-2xl font-black text-green-400 mb-2">{best.month}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">CA / Client:</span>
                    <span className="font-bold text-white">{formatEuro(best.caPerClient)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Clients:</span>
                    <span className="font-bold text-white">{best.clients.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
        
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Plus Grande Cohorte</h3>
          </div>
          {(() => {
            const largest = [...cohortes].sort((a, b) => b.clients - a.clients)[0]
            return (
              <div className="bg-blue-500/10 rounded-2xl p-5 border border-blue-500/20">
                <div className="text-2xl font-black text-blue-400 mb-2">{largest.month}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Clients:</span>
                    <span className="font-bold text-white">{largest.clients.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">CA Total:</span>
                    <span className="font-bold text-white">{formatEuro(largest.ca)}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
