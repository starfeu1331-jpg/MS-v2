import { useState, useEffect } from 'react'
import { Instagram, Facebook, TrendingUp, MapPin, Target, Megaphone, ShoppingBag, Store, Mail, Download, Users } from 'lucide-react'

interface SocialMediaInsightsProps {
  data?: any
}

interface ClientAvecEmail {
  carte: string
  nom?: string | null
  prenom?: string | null
  email: string
  telephone?: string | null
  sexe?: string | null
  ville?: string | null
  cp?: string | null
  ca_total: number
  nb_achats: number
  dernier_achat: string
}

const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache global
let marketingCache: { data: any; timestamp: number } | null = null

export default function SocialMediaInsights({ data }: SocialMediaInsightsProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [loadedData, setLoadedData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les données depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier le cache
        const now = Date.now()
        if (marketingCache && (now - marketingCache.timestamp < CACHE_DURATION)) {
          console.log('🔍 Marketing: Utilisation cache')
          setLoadedData(marketingCache.data)
          setLoading(false)
          return
        }

        console.log('🔄 Marketing: Chargement depuis API')
        setLoading(true)
        
        const response = await fetch(`${API_URL}/api/marketing`)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        
        const result = await response.json()
        
        // Mettre en cache
        marketingCache = { data: result, timestamp: Date.now() }
        
        setLoadedData(result)
        console.log('✅ Marketing: Données chargées')
      } catch (err: any) {
        console.error('❌ Erreur chargement Marketing:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-red-400">Erreur: {error}</div></div>
  }

  if (!loadedData || !loadedData.monthlyStats) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée</div></div>
  }

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  const months = loadedData.monthlyStats.map((m: any) => m.month).slice(0, 12)

  if (!selectedMonth && months.length > 0) {
    setSelectedMonth(months[0])
  }

  const currentMonthData = loadedData.monthlyStats.find((m: any) => m.month === selectedMonth)
  if (!currentMonthData) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée pour ce mois</div></div>
  }

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  const getTopProducts = (produits: Record<string, any>, limit = 5) => {
    return Object.entries(produits)
      .map(([code, stats]) => ({ code, ...stats }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, limit)
  }

  const getTopZones = (zones: Record<string, any>, limit = 5) => {
    return Object.entries(zones)
      .map(([dept, stats]: [string, any]) => ({ dept, ca: stats.ca, clients: stats.clients }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, limit)
  }

  const getSocialMediaRecommendations = (monthData: any) => {
    const caTotal = (loadedData.webStats?.ca || 0) + monthData.ca
    const caWeb = loadedData.webStats?.ca || 0
    
    const topProduitsWeb = getTopProducts(loadedData?.produitsWeb || {}, 3)
    const topProduitsStore = getTopProducts(loadedData?.produitsMagasin?.[selectedMonth] || {}, 3)
    const topZones = getTopZones(loadedData?.zones || {}, 3)

    const recommendations = []

    // Instagram - visuels produits
    if (topProduitsWeb.length > 0) {
      recommendations.push({
        platform: 'Instagram',
        icon: Instagram,
        color: 'pink',
        gradient: 'from-pink-500 to-purple-500',
        actions: [
          {
            type: 'Post Produit',
            content: `Mettre en avant ${topProduitsWeb[0].famille} - ${topProduitsWeb[0].sousFamille}`,
            reason: `Top vente web: ${formatEuro(topProduitsWeb[0].ca)}`,
            priority: 'high'
          },
          {
            type: 'Story',
            content: 'Montrer 3 produits phares du moment en carousel',
            reason: `${topProduitsWeb.length} produits génèrent ${formatEuro(topProduitsWeb.reduce((s, p) => s + p.ca, 0))}`,
            priority: 'medium'
          }
        ]
      })
    } else if (topProduitsStore.length > 0) {
      // Fallback sur produits magasin si pas de web
      recommendations.push({
        platform: 'Instagram',
        icon: Instagram,
        color: 'pink',
        gradient: 'from-pink-500 to-purple-500',
        actions: [
          {
            type: 'Post Produit',
            content: `Mettre en avant ${topProduitsStore[0].famille} - ${topProduitsStore[0].sousFamille}`,
            reason: `Top vente magasin: ${formatEuro(topProduitsStore[0].ca)}`,
            priority: 'high'
          },
          {
            type: 'Story',
            content: 'Montrer les nouveautés en magasin',
            reason: `${monthData.clients} clients ce mois-ci`,
            priority: 'medium'
          }
        ]
      })
    }

    // Facebook - ciblage local
    if (topZones.length > 0) {
      recommendations.push({
        platform: 'Facebook Ads',
        icon: Facebook,
        color: 'blue',
        gradient: 'from-blue-500 to-cyan-500',
        actions: [
          {
            type: 'Publicité Locale',
            content: `Cibler les départements ${topZones.map(z => z.dept).join(', ')}`,
            reason: `${formatEuro(topZones.reduce((s, z) => s + z.ca, 0))} de CA concentré`,
            priority: 'high'
          },
          {
            type: 'Post Magasin',
            content: 'Promouvoir les produits populaires en magasin',
            reason: `${((monthData.ca_magasin / caTotal) * 100).toFixed(0)}% du CA en magasin`,
            priority: topProduitsStore.length > 0 ? 'high' : 'low'
          }
        ]
      })
    }

    // Google Ads - produits web
    const budgetSuggere = Math.max(500, Math.round(caWeb * 0.08)) // 8% du CA web
    
    if (topProduitsWeb.length > 0) {
      recommendations.push({
        platform: 'Google Ads',
        icon: Target,
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-500',
        actions: [
          {
            type: 'Shopping Ads',
            content: `Campagne sur ${topProduitsWeb[0]?.famille || 'Top produits'}`,
            reason: `Budget suggéré: ${formatEuro(budgetSuggere)}`,
            priority: 'high'
          },
          {
            type: 'Search Ads',
            content: `Mots-clés: ${topProduitsWeb.slice(0, 2).map(p => p.sousFamille).join(', ')}`,
            reason: `${formatEuro(topProduitsWeb.slice(0, 2).reduce((s, p) => s + p.ca, 0))} de potentiel`,
            priority: 'medium'
          }
        ]
      })
    } else if (topProduitsStore.length > 0) {
      // Fallback sur produits magasin
      recommendations.push({
        platform: 'Google Ads',
        icon: Target,
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-500',
        actions: [
          {
            type: 'Shopping Ads',
            content: `Campagne sur ${topProduitsStore[0]?.famille || 'Top produits'}`,
            reason: `Budget suggéré: ${formatEuro(budgetSuggere)}`,
            priority: 'high'
          },
          {
            type: 'Search Ads',
            content: `Mots-clés magasin: ${topProduitsStore.slice(0, 2).map(p => p.sousFamille).join(', ')}`,
            reason: `${formatEuro(topProduitsStore.slice(0, 2).reduce((s, p) => s + p.ca, 0))} de CA`,
            priority: 'medium'
          }
        ]
      })
    }

    return recommendations
  }

  const caWeb = loadedData.webStats?.ca || 0
  const caTotal = caWeb + currentMonthData.ca

  const recommendations = getSocialMediaRecommendations(currentMonthData)
  const topProduitsStore = getTopProducts(loadedData?.produitsMagasin?.[selectedMonth] || {}, 10)
  
  // Export clients avec email pour campagnes
  const exportClientsEmail = () => {
    if (!loadedData?.clientsAvecEmail || loadedData.clientsAvecEmail.length === 0) {
      alert('Aucun client avec email disponible')
      return
    }
    
    const headers = ['Nom', 'Prénom', 'Email', 'Téléphone', 'Sexe', 'Ville', 'CP', 'Carte', 'CA Total', 'Nb Achats', 'Dernier Achat']
    const rows = loadedData.clientsAvecEmail.map((client: ClientAvecEmail) => [
      client.nom || '',
      client.prenom || '',
      client.email,
      client.telephone || '',
      client.sexe || '',
      client.ville || '',
      client.cp || '',
      client.carte,
      Math.round(client.ca_total),
      client.nb_achats,
      new Date(client.dernier_achat).toLocaleDateString('fr-FR')
    ])
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clients_email_marketing_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-pink-500 to-purple-500 rounded-2xl">
            <Megaphone className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Stratégie Réseaux Sociaux</h2>
            <p className="text-zinc-400">Insights mensuels pour votre calendrier éditorial et investissements publicitaires</p>
          </div>
        </div>

        {/* Sélecteur de mois */}
        <div className="flex gap-2 flex-wrap">
          {months.map(month => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                selectedMonth === month
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {getMonthName(month)}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs du mois */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">📊 Performance {getMonthName(selectedMonth)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(caTotal)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Web</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(caWeb)}</p>
            <p className="text-sm text-blue-400 mt-1">
              {((caWeb / caTotal) * 100).toFixed(1)}% du total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Store className="w-5 h-5 text-orange-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Magasin</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(currentMonthData.ca)}</p>
            <p className="text-sm text-orange-400 mt-1">
              {((currentMonthData.ca / caTotal) * 100).toFixed(1)}% du total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Nouveaux Clients</p>
            </div>
            <p className="text-3xl font-bold text-white">{currentMonthData.nouveauxClients}</p>
            <p className="text-sm text-purple-400 mt-1">
              sur {currentMonthData.clients} total
            </p>
          </div>
        </div>
      </div>

      {/* Recommandations par plateforme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="glass rounded-3xl p-6 border border-zinc-800">
            <div className={`flex items-center gap-3 mb-4 p-4 rounded-2xl bg-gradient-to-r ${rec.gradient}`}>
              <rec.icon className="w-6 h-6 text-white" />
              <h3 className="text-xl font-bold text-white">{rec.platform}</h3>
            </div>

            <div className="space-y-4">
              {rec.actions.map((action, actionIdx) => (
                <div key={actionIdx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      action.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      action.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-zinc-700 text-zinc-400'
                    }`}>
                      {action.priority === 'high' ? '🔥 Prioritaire' :
                       action.priority === 'medium' ? '⚡ Important' : '💡 Optionnel'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mb-1">{action.type}</p>
                  <p className="text-sm text-zinc-300 mb-2">{action.content}</p>
                  <p className="text-xs text-zinc-500">💡 {action.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Top produits web vs magasin */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produits Web */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingBag className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Top 10 Produits Web</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Famille</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">CA</th>
                </tr>
              </thead>
              <tbody>
                {getTopProducts(loadedData?.produitsWeb || {}, 10).map((p, idx) => (
                  <tr key={p.code} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="px-3 py-2 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-mono text-zinc-300">{p.code}</td>
                    <td className="px-3 py-2 text-sm text-white">{p.famille}</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-emerald-400">
                      {formatEuro(p.ca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Produits de Folie (dans les deux canaux) */}
        <div className="glass rounded-3xl p-8 border border-yellow-600/50 bg-yellow-950/20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🔥</span>
            <h3 className="text-xl font-bold text-yellow-300">Produits de Folie</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Famille</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">CA</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const topWeb = getTopProducts(loadedData?.produitsWeb || {}, 10)
                  const topMag = getTopProducts(loadedData?.produitsMagasin?.[selectedMonth] || {}, 10)
                  const webCodes = new Set(topWeb.map(p => p.code))
                  const folie = topMag.filter(p => webCodes.has(p.code))
                  if (folie.length === 0) {
                    return <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">Aucun produit commun ce mois</td></tr>
                  }
                  return folie.map((p, idx) => (
                    <tr key={p.code} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="px-3 py-2 text-sm font-bold text-yellow-400">#{idx + 1}</td>
                      <td className="px-3 py-2 text-sm font-mono text-zinc-300">{p.code}</td>
                      <td className="px-3 py-2 text-sm text-white">{p.famille}</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-yellow-400">
                        {formatEuro(p.ca)}
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Produits Magasin */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <Store className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-bold text-white">Top 10 Produits Magasin</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Famille</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">CA</th>
                </tr>
              </thead>
              <tbody>
                {topProduitsStore.map((p, idx) => (
                  <tr key={p.code} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="px-3 py-2 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-mono text-zinc-300">{p.code}</td>
                    <td className="px-3 py-2 text-sm text-white">{p.famille}</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-emerald-400">
                      {formatEuro(p.ca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Zones géographiques prioritaires */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Zones Géographiques à Cibler</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {getTopZones(loadedData?.zones || {}, 10).map((zone) => (
            <div key={zone.dept} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400 mb-1">{zone.dept}</p>
                <p className="text-xs text-zinc-500 mb-2">Département</p>
                <p className="text-sm font-bold text-white">{formatEuro(zone.ca)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campagnes Email */}
      {loadedData?.clientsAvecEmail && loadedData.clientsAvecEmail.length > 0 && (
        <div className="glass rounded-3xl p-8 border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-xl font-bold text-white">📧 Campagnes Email Marketing</h3>
                <p className="text-sm text-zinc-400">{loadedData.clientsAvecEmail.length} clients contactables avec email</p>
              </div>
            </div>
            <button
              onClick={exportClientsEmail}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Stats clients avec email */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-400" />
                <p className="text-xs text-zinc-500 font-semibold uppercase">Clients Email</p>
              </div>
              <p className="text-2xl font-bold text-white">{loadedData.clientsAvecEmail.length}</p>
              <p className="text-xs text-blue-400 mt-1">Base emailing prête</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatEuro(loadedData.clientsAvecEmail.reduce((sum: number, c: ClientAvecEmail) => sum + c.ca_total, 0))}
              </p>
              <p className="text-xs text-green-400 mt-1">Potentiel emailing</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-4 border border-pink-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-pink-400" />
                <p className="text-xs text-zinc-500 font-semibold uppercase">Femmes</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {loadedData.clientsAvecEmail.filter((c: ClientAvecEmail) => c.sexe === 'F').length}
              </p>
              <p className="text-xs text-pink-400 mt-1">
                {((loadedData.clientsAvecEmail.filter((c: ClientAvecEmail) => c.sexe === 'F').length / loadedData.clientsAvecEmail.length) * 100).toFixed(1)}% de la base
              </p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <p className="text-xs text-zinc-500 font-semibold uppercase">Hommes</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {loadedData.clientsAvecEmail.filter((c: ClientAvecEmail) => c.sexe === 'H').length}
              </p>
              <p className="text-xs text-cyan-400 mt-1">
                {((loadedData.clientsAvecEmail.filter((c: ClientAvecEmail) => c.sexe === 'H').length / loadedData.clientsAvecEmail.length) * 100).toFixed(1)}% de la base
              </p>
            </div>
          </div>

          {/* Recommandations campagnes */}
          <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-500/20">
            <h4 className="text-lg font-bold text-white mb-4">💡 Suggestions de campagnes</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-white font-semibold">Newsletter mensuelle personnalisée</p>
                  <p className="text-xs text-zinc-400">Segmentez par sexe pour offres ciblées (H/F)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-white font-semibold">Relance clients inactifs</p>
                  <p className="text-xs text-zinc-400">Filtrez sur dernier_achat &gt; 6 mois avec code promo</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-white font-semibold">Programme VIP exclusif</p>
                  <p className="text-xs text-zinc-400">Top 100 clients CA avec invitation événement privé</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-white font-semibold">Campagne saisonnière géolocalisée</p>
                  <p className="text-xs text-zinc-400">Utilisez CP pour cibler promotions régionales</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
