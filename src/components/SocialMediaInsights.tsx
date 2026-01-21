import { useState } from 'react'
import { Instagram, Facebook, TrendingUp, MapPin, Target, Megaphone, ShoppingBag, Store } from 'lucide-react'

interface SocialMediaInsightsProps {
  data: any
}

export default function SocialMediaInsights({ data }: SocialMediaInsightsProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  if (!data || !data.allClients) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  // Analyser les ventes par mois
  const analyzeMonthlyData = () => {
    const monthlyData: Record<string, {
      ca_web: number
      ca_magasin: number
      produits_web: Record<string, { ca: number, volume: number, famille: string, sousFamille: string }>
      produits_magasin: Record<string, { ca: number, volume: number, famille: string, sousFamille: string }>
      zones: Record<string, number>
      nouveaux_clients: Set<string>
      total_clients: Set<string>
    }> = {}
    
    // Le CA web TOTAL est dans data.webStats.ca (calculé pendant l'import)
    // Les achats avec fidélité n'incluent QUE les achats de clients avec carte
    // Les achats web sont soit sans carte, soit combinés différemment
    // On distribue le CA web proportionnellement au volume de transactions
    
    const webCATotal = data.webStats?.ca || 0
    
    data.allClients.forEach((client: any) => {
      if (client.achats) {
        client.achats.forEach((achat: any) => {
          if (achat.date && achat.date !== 'N/A') {
            const [, month, year] = achat.date.split('/')
            const monthKey = `${year}-${month.padStart(2, '0')}`
            
            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = {
                ca_web: 0,
                ca_magasin: 0,
                produits_web: {},
                produits_magasin: {},
                zones: {},
                nouveaux_clients: new Set(),
                total_clients: new Set()
              }
            }

            // TOUS les achats clients avec fidélité sont des magasins (pas de web)
            // car web purchases ne sont pas associés à une carte de fidélité
            const ca = achat.ca || 0
            monthlyData[monthKey].ca_magasin += ca

            // Produits - tous vont dans produits_magasin car web n'a pas de clients fidélité
            if (achat.produits && Array.isArray(achat.produits)) {
              achat.produits.forEach((p: any) => {
                const produitCode = p.produit || 'Non défini'
                const produits = monthlyData[monthKey].produits_magasin
                
                if (!produits[produitCode]) {
                  produits[produitCode] = { 
                    ca: 0, 
                    volume: 0,
                    famille: p.famille || achat.famille || 'Non défini',
                    sousFamille: p.sousFamille || achat.sousFamille || 'Non défini'
                  }
                }
                produits[produitCode].ca += p.ca || 0
                produits[produitCode].volume++
              })
            }

            // Zones géographiques
            if (client.cp && client.cp !== '-' && client.cp !== 'N/A') {
              const dept = client.cp.substring(0, 2)
              monthlyData[monthKey].zones[dept] = (monthlyData[monthKey].zones[dept] || 0) + ca
            }

            // Clients
            monthlyData[monthKey].total_clients.add(client.carte)
            if (client.firstPurchaseDate === achat.date) {
              monthlyData[monthKey].nouveaux_clients.add(client.carte)
            }
          }
        })
      }
    })
    
    // AJOUTER le CA Web TOTAL directement (depuis data.webStats qui l'a calculé pendant l'import)
    // Les achats avec fidélité ne contiennent PAS les achats web (M41, M42)
    // On distribute le web CA sur TOUS les mois proportionnellement
    if (webCATotal > 0) {
      const totalMonths = Object.keys(monthlyData).length
      if (totalMonths > 0) {
        const webCAPerMonth = webCATotal / totalMonths
        Object.keys(monthlyData).forEach(monthKey => {
          monthlyData[monthKey].ca_web = webCAPerMonth
        })
      }
    }
    
    console.log('💰 CA WebStats total:', webCATotal)
    console.log('📊 CA Calculé après ajout web:', Object.values(monthlyData).reduce((sum, m) => ({ web: sum.web + m.ca_web, mag: sum.mag + m.ca_magasin }), { web: 0, mag: 0 }))

    return monthlyData
  }

  const monthlyData = analyzeMonthlyData()
  
  const months = Object.keys(monthlyData).sort().reverse().slice(0, 12)

  if (!selectedMonth && months.length > 0) {
    setSelectedMonth(months[0])
  }

  const currentMonthData = selectedMonth ? monthlyData[selectedMonth] : null

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

  const getTopZones = (zones: Record<string, number>, limit = 5) => {
    return Object.entries(zones)
      .map(([dept, ca]) => ({ dept, ca }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, limit)
  }

  const getSocialMediaRecommendations = (monthData: any) => {
    const caTotal = monthData.ca_web + monthData.ca_magasin
    
    // Utiliser data.produitsWeb (pré-calculé depuis l'import) pour les produits web
    // et monthData.produits_magasin pour les produits magasin
    const topProduitsWeb = getTopProducts(data.produitsWeb || {}, 3)
    const topProduitsStore = getTopProducts(monthData.produits_magasin, 3)
    const topZones = getTopZones(monthData.zones, 3)

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
    const budgetSuggere = Math.max(500, Math.round(monthData.ca_web * 0.08)) // 8% du CA web
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

    return recommendations
  }

  if (!currentMonthData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-zinc-400">Aucune donnée disponible</div>
      </div>
    )
  }

  const caTotal = currentMonthData.ca_web + currentMonthData.ca_magasin
  const recommendations = getSocialMediaRecommendations(currentMonthData)
  const topProduitsStore = getTopProducts(currentMonthData.produits_magasin, 10)

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
            <p className="text-3xl font-bold text-white">{formatEuro(currentMonthData.ca_web)}</p>
            <p className="text-sm text-blue-400 mt-1">
              {((currentMonthData.ca_web / caTotal) * 100).toFixed(1)}% du total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Store className="w-5 h-5 text-orange-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Magasin</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(currentMonthData.ca_magasin)}</p>
            <p className="text-sm text-orange-400 mt-1">
              {((currentMonthData.ca_magasin / caTotal) * 100).toFixed(1)}% du total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Nouveaux Clients</p>
            </div>
            <p className="text-3xl font-bold text-white">{currentMonthData.nouveaux_clients.size}</p>
            <p className="text-sm text-purple-400 mt-1">
              sur {currentMonthData.total_clients.size} total
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
                {getTopProducts(data.produitsWeb || {}, 10).map((p, idx) => (
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
                  const topWeb = getTopProducts(data.produitsWeb || {}, 10)
                  const topMag = getTopProducts(data.produitsMag || {}, 10)
                  const webCodes = new Set(topWeb.map(p => p.code))
                  const folie = topMag.filter(p => webCodes.has(p.code))
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
          {getTopZones(currentMonthData.zones, 10).map((zone) => (
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
    </div>
  )
}
