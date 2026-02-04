import { Users } from 'lucide-react'
import { useState, useEffect } from 'react'
import SegmentDetail from './SegmentDetail'

interface RFMAnalysisProps {
  data?: any
  onSearchClient?: (carte: string) => void
  showWebData?: boolean
}

interface RFMClient {
  carte: string
  nom?: string | null
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  sexe?: string | null
  ville: string
  cp: string
  recency: number
  frequency: number
  monetary: number
  daysSinceFirst: number
  firstDate: string
  lastDate: string
  R: number
  F: number
  M: number
  RFM: number
  segment: string
}

interface RFMData {
  clients: RFMClient[]
  stats: {
    totalClients: number
    totalCA: number
    segments: {
      [key: string]: {
        count: number
        ca: number
        clients: RFMClient[]
      }
    }
  }
  thresholds: {
    recency: number[]
    frequency: number[]
    monetary: number[]
  }
}

// Cache global pour éviter de recalculer
const rfmCache: Record<string, { data: RFMData; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache de l'état UI pour conserver la sélection
const rfmUIState: Record<string, { selectedSegment: string | null; showSegmentDetail: boolean }> = {}

export default function RFMAnalysis({ onSearchClient, showWebData }: RFMAnalysisProps) {
  const magasinFilter = showWebData ? 'WEB' : 'MAGASIN'
  const uiStateKey = `rfm_ui_${magasinFilter}`
  const cacheKey = `rfm_${magasinFilter}`
  
  // Restaurer l'état UI depuis le cache
  const savedUIState = rfmUIState[uiStateKey]
  const [selectedSegment, setSelectedSegment] = useState<string | null>(savedUIState?.selectedSegment || null)
  const [showSegmentDetail, setShowSegmentDetail] = useState(savedUIState?.showSegmentDetail || false)
  const [rfmData, setRfmData] = useState<RFMData | null>(null)
  
  // Initialiser loading à false si on a déjà des données en cache
  const cached = rfmCache[cacheKey]
  const hasValidCache = cached && (Date.now() - cached.timestamp) < CACHE_DURATION
  const [loading, setLoading] = useState(!hasValidCache)
  const [error, setError] = useState<string | null>(null)
  
  // Sauvegarder l'état UI à chaque changement
  useEffect(() => {
    rfmUIState[uiStateKey] = { selectedSegment, showSegmentDetail }
  }, [selectedSegment, showSegmentDetail, uiStateKey])

  useEffect(() => {
    const fetchRFMData = async () => {
      const magasinFilter = showWebData ? 'WEB' : 'MAGASIN'
      const cacheKey = `rfm_${magasinFilter}`
      
      // Vérifier si on a des données en cache valides
      const cached = rfmCache[cacheKey]
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('✅ RFM: Utilisation du cache', magasinFilter)
        setRfmData(cached.data)
        setLoading(false)
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        console.log('🔄 RFM: Chargement depuis API', magasinFilter)
        const response = await fetch(`/api/rfm?magasin=${magasinFilter}`)
        
        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Mettre en cache
        rfmCache[cacheKey] = {
          data,
          timestamp: Date.now()
        }
        
        setRfmData(data)
      } catch (err: any) {
        console.error('❌ Erreur chargement RFM:', err)
        setError(err.message || 'Erreur lors du chargement des données RFM')
      } finally {
        setLoading(false)
      }
    }

    fetchRFMData()
  }, [showWebData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Calcul de la segmentation RFM en cours...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!rfmData || rfmData.clients.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 border border-zinc-800 text-center">
        <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Aucun client trouvé</h2>
        <p className="text-zinc-400">Pas de données RFM disponibles pour cette période</p>
      </div>
    )
  }


  const clients = rfmData.clients
  const totalClients = rfmData.stats.totalClients
  const totalCA = rfmData.stats.totalCA
  const segmentStats = rfmData.stats.segments
  
  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  const segments = [
    {
      name: 'Ultra Champions',
      color: 'purple',
      icon: '👑💎',
      description: 'Excellence absolue: les meilleurs clients',
      criteria: 'R=5 ET F=5 ET M=5',
      action: 'VIP absolu ! Chouchouter, privilèges exclusifs, accès prioritaire'
    },
    {
      name: 'Champions',
      color: 'emerald',
      icon: '👑',
      description: 'Vos meilleurs clients : achètent récemment, fréquemment et dépensent beaucoup',
      criteria: 'R≥4 ET F≥4',
      action: 'Récompensez-les ! Offres VIP, programme ambassadeur'
    },
    {
      name: 'Loyaux',
      color: 'blue',
      icon: '💎',
      description: 'Clients fidèles avec bon potentiel, achètent régulièrement',
      criteria: 'R≥3 ET F≥3 (sauf Champions)',
      action: 'Montée en gamme : cross-sell, upsell, offres premium'
    },
    {
      name: 'À Risque',
      color: 'orange',
      icon: '⚠️',
      description: 'Anciens bons clients qui n\'ont pas acheté récemment',
      criteria: 'R≤2 ET F≥4',
      action: 'Réactivation urgente ! Offres de reconquête personnalisées'
    },
    {
      name: 'Perdus',
      color: 'red',
      icon: '💔',
      description: 'Clients inactifs depuis longtemps',
      criteria: 'R≤2 (pas À Risque)',
      action: 'Dernière chance : offre exceptionnelle ou laisser partir'
    },
    {
      name: 'Nouveaux',
      color: 'cyan',
      icon: '✨',
      description: 'Nouveaux clients avec un seul achat',
      criteria: 'F=1',
      action: 'Fidélisation ! Offre de bienvenue, communication régulière'
    },
    {
      name: 'Occasionnels',
      color: 'zinc',
      icon: '🎯',
      description: 'Clients occasionnels sans profil marqué',
      criteria: 'Tous les autres cas',
      action: 'Engagement : augmenter la fréquence via campagnes ciblées'
    }
  ]
  
  if (totalClients === 0) {
    return (
      <div className="glass rounded-3xl p-8 border border-zinc-800 text-center">
        <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Aucun client trouvé</h2>
      </div>
    )
  }

  // Si un segment est sélectionné, afficher la page de détail
  if (showSegmentDetail && selectedSegment && segmentStats[selectedSegment]) {
    return (
      <SegmentDetail
        segmentName={selectedSegment}
        segmentData={segmentStats[selectedSegment]}
        allData={null} // On n'utilise plus allData pour l'instant
        totalClients={totalClients}
        totalCA={totalCA}
        onBack={() => {
          setShowSegmentDetail(false)
          setSelectedSegment(null)
        }}
        onSearchClient={onSearchClient}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Analyse RFM</h2>
              <p className="text-zinc-400">Segmentation clients par Récence, Fréquence & Montant</p>
            </div>
          </div>
          <button
            onClick={() => {
              const magasinFilter = showWebData ? 'WEB' : 'MAGASIN'
              const cacheKey = `rfm_${magasinFilter}`
              delete rfmCache[cacheKey]
              window.location.reload()
            }}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-xl text-purple-400 text-sm font-medium transition-all"
          >
            🔄 Rafraîchir
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Analysés</p>
            <p className="text-2xl font-bold text-white mt-1">{totalClients.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-zinc-400 mt-1">Clients avec carte</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total RFM</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCA)}</p>
            <p className="text-xs text-amber-400 mt-1">⚠️ Hors achats anonymes</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Moyen</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCA / totalClients)}</p>
            <p className="text-xs text-zinc-400 mt-1">Par client fidélité</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Segments</p>
            <p className="text-2xl font-bold text-white mt-1">7</p>
            <p className="text-xs text-zinc-400 mt-1">Types de clients</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-400">
            ℹ️ <strong>Note importante :</strong> L'analyse RFM porte uniquement sur les clients avec carte de fidélité et CA positif. 
            Les achats sans carte ne sont pas segmentés.
          </p>
        </div>
      </div>

      {/* Compteurs cliquables par segment */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-2xl font-bold text-white mb-6">🎯 Répartition par Segments (cliquez pour voir le détail)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {segments.map((segment) => {
            const stats = segmentStats[segment.name] || { count: 0, ca: 0 }
            const percentClients = ((stats.count / totalClients) * 100).toFixed(1)
            const percentCA = ((stats.ca / totalCA) * 100).toFixed(1)
            
            return (
              <button
                key={segment.name}
                onClick={() => {
                  setSelectedSegment(segment.name)
                  setShowSegmentDetail(true)
                }}
                className={`text-left p-4 rounded-2xl border-2 transition-all transform hover:scale-105 bg-${segment.color}-500/5 border-${segment.color}-500/30 hover:border-${segment.color}-500/50`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{segment.icon}</span>
                  <span className={`text-sm font-bold text-${segment.color}-400`}>{segment.name}</span>
                </div>
                <p className={`text-3xl font-black text-${segment.color}-400`}>{stats.count.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-zinc-500 mt-1">{percentClients}% du total</p>
                <p className="text-xs text-zinc-400 mt-1">{formatEuro(stats.ca)}</p>
                <p className="text-xs text-emerald-400 mt-1 font-bold">{percentCA}% du CA</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Explication de la méthode RFM */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-2xl font-bold text-white mb-4">📊 Comment ça marche ?</h3>
        <div className="space-y-4 text-zinc-300">
          <p className="text-lg">
            L'analyse <strong className="text-purple-400">RFM</strong> attribue 3 scores de 1 à 5 à chaque client selon la méthode des <strong className="text-cyan-400">quintiles</strong> :
          </p>
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 mb-4">
            <h4 className="text-lg font-bold text-white mb-2">🎯 Principe des Quintiles</h4>
            <p className="text-sm text-zinc-300 mb-2">
              Les clients sont <strong>classés</strong> puis divisés en 5 groupes égaux de 20% chacun :
            </p>
            <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold mt-3">
              <div className="bg-red-500/20 text-red-400 py-2 rounded">Score 1<br/>20% pires</div>
              <div className="bg-orange-500/20 text-orange-400 py-2 rounded">Score 2<br/>20% suivants</div>
              <div className="bg-yellow-500/20 text-yellow-400 py-2 rounded">Score 3<br/>20% moyens</div>
              <div className="bg-lime-500/20 text-lime-400 py-2 rounded">Score 4<br/>20% bons</div>
              <div className="bg-emerald-500/20 text-emerald-400 py-2 rounded">Score 5<br/>20% meilleurs</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
              <h4 className="text-xl font-bold text-blue-400 mb-2">R - Récence</h4>
              <p className="text-sm mb-2">Depuis combien de jours le dernier achat ?</p>
              <div className="text-xs space-y-1 mt-3 font-mono">
                <div className="flex justify-between"><span className="text-emerald-400">Score 5:</span><span className="text-zinc-400">20% plus récents</span></div>
                <div className="flex justify-between"><span className="text-lime-400">Score 4:</span><span className="text-zinc-400">20% suivants</span></div>
                <div className="flex justify-between"><span className="text-yellow-400">Score 3:</span><span className="text-zinc-400">20% moyens</span></div>
                <div className="flex justify-between"><span className="text-orange-400">Score 2:</span><span className="text-zinc-400">20% anciens</span></div>
                <div className="flex justify-between"><span className="text-red-400">Score 1:</span><span className="text-zinc-400">20% plus anciens</span></div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 italic">Classement par récence croissante puis division en 5 groupes</p>
            </div>
            <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
              <h4 className="text-xl font-bold text-cyan-400 mb-2">F - Fréquence</h4>
              <p className="text-sm mb-2">Combien d'achats au total ?</p>
              <div className="text-xs space-y-1 mt-3 font-mono">
                <div className="flex justify-between"><span className="text-emerald-400">Score 5:</span><span className="text-zinc-400">20% plus fréquents</span></div>
                <div className="flex justify-between"><span className="text-lime-400">Score 4:</span><span className="text-zinc-400">20% suivants</span></div>
                <div className="flex justify-between"><span className="text-yellow-400">Score 3:</span><span className="text-zinc-400">20% moyens</span></div>
                <div className="flex justify-between"><span className="text-orange-400">Score 2:</span><span className="text-zinc-400">20% occasionnels</span></div>
                <div className="flex justify-between"><span className="text-red-400">Score 1:</span><span className="text-zinc-400">20% plus rares</span></div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 italic">Classement par nb achats décroissant puis division en 5 groupes</p>
            </div>
            <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/30">
              <h4 className="text-xl font-bold text-teal-400 mb-2">M - Montant</h4>
              <p className="text-sm mb-2">Chiffre d'affaires total généré ?</p>
              <div className="text-xs space-y-1 mt-3 font-mono">
                <div className="flex justify-between"><span className="text-emerald-400">Score 5:</span><span className="text-zinc-400">20% plus gros CA</span></div>
                <div className="flex justify-between"><span className="text-lime-400">Score 4:</span><span className="text-zinc-400">20% suivants</span></div>
                <div className="flex justify-between"><span className="text-yellow-400">Score 3:</span><span className="text-zinc-400">20% moyens</span></div>
                <div className="flex justify-between"><span className="text-orange-400">Score 2:</span><span className="text-zinc-400">20% petits CA</span></div>
                <div className="flex justify-between"><span className="text-red-400">Score 1:</span><span className="text-zinc-400">20% plus petits CA</span></div>
              </div>
              <p className="text-xs text-zinc-500 mt-3 italic">Classement par CA décroissant puis division en 5 groupes</p>
            </div>
          </div>
          <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30 mt-4">
            <p className="text-sm mb-2">
              <strong className="text-purple-400">Score RFM final :</strong> Combinaison R×100 + F×10 + M 
              <span className="text-zinc-400 ml-2">(ex: R=5, F=4, M=3 → Score 543)</span>
            </p>
            <p className="text-xs text-zinc-400">
              ⚡ <strong>Avantage des quintiles :</strong> Les scores s'ajustent automatiquement à VOS données réelles. 
              Que vous ayez des clients qui achètent tous les jours ou une fois par an, les 20% meilleurs auront toujours un score de 5.
            </p>
          </div>
        </div>
      </div>

      {/* Segments détaillés */}
      {segments.map((segment) => {
        const stats = segmentStats[segment.name] || { clients: [], ca: 0, count: 0 }
        if (stats.count === 0) return null
        
        const sortedClients = [...stats.clients].sort((a, b) => b.monetary - a.monetary)
        
        return (
          <div key={segment.name} className={`glass rounded-3xl p-8 border border-${segment.color}-500/30`}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{segment.icon}</span>
              <div className="flex-1">
                <h3 className={`text-2xl font-bold text-${segment.color}-400`}>{segment.name}</h3>
                <p className="text-zinc-300 text-sm">{segment.description}</p>
              </div>
            </div>
            
            <div className={`bg-${segment.color}-500/10 rounded-xl p-4 border border-${segment.color}-500/20 mb-4`}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">Critères de sélection</p>
                  <p className={`text-sm font-mono text-${segment.color}-400`}>{segment.criteria}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">Action recommandée</p>
                  <p className="text-sm text-white">{segment.action}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className={`bg-${segment.color}-500/10 rounded-xl p-3 border border-${segment.color}-500/20`}>
                <p className="text-xs text-zinc-400 font-semibold uppercase">Clients</p>
                <p className="text-xl font-bold text-white">{stats.count.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-zinc-500">{((stats.count / totalClients) * 100).toFixed(1)}% du total</p>
              </div>
              <div className={`bg-${segment.color}-500/10 rounded-xl p-3 border border-${segment.color}-500/20`}>
                <p className="text-xs text-zinc-400 font-semibold uppercase">CA Total</p>
                <p className="text-xl font-bold text-white">{formatEuro(stats.ca)}</p>
                <p className="text-xs text-zinc-500">{((stats.ca / totalCA) * 100).toFixed(1)}% du CA</p>
              </div>
              <div className={`bg-${segment.color}-500/10 rounded-xl p-3 border border-${segment.color}-500/20`}>
                <p className="text-xs text-zinc-400 font-semibold uppercase">CA Moyen</p>
                <p className="text-xl font-bold text-white">{formatEuro(stats.ca / stats.count)}</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`bg-gradient-to-r from-${segment.color}-600 to-${segment.color}-700 text-white`}>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Rang</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Carte</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase">Score</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase">R</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase">F</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase">M</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase">CA</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Récence (j)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.slice(0, 100).map((client, idx) => (
                    <tr key={client.carte} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="px-3 py-2 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-white">{client.carte}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full bg-${segment.color}-500/20 text-${segment.color}-400 font-bold text-xs`}>
                          {client.RFM}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-blue-400 font-bold text-sm">{client.R}</td>
                      <td className="px-3 py-2 text-center text-cyan-400 font-bold text-sm">{client.F}</td>
                      <td className="px-3 py-2 text-center text-teal-400 font-bold text-sm">{client.M}</td>
                      <td className="px-3 py-2 text-right text-white font-bold text-sm">{formatEuro(client.monetary)}</td>
                      <td className="px-3 py-2 text-right text-zinc-400 text-sm">{client.recency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedClients.length > 100 && (
                <p className="text-center text-zinc-500 text-sm mt-4">
                  + {sortedClients.length - 100} autres clients dans ce segment
                </p>
              )}
            </div>
          </div>
        )
      })}

      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">🏆 Top 20 Clients par CA (tous segments)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Carte</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Segment</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Score</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA</th>
              </tr>
            </thead>
            <tbody>
              {clients
                .sort((a, b) => b.monetary - a.monetary)
                .slice(0, 20)
                .map((client, idx) => (
                <tr key={client.carte} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{client.carte}</td>
                  <td className="px-4 py-3 text-sm text-cyan-400">{client.segment}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm">
                      {client.RFM}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-bold">{formatEuro(client.monetary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
