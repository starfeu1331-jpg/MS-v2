import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Users, ShoppingCart, Euro, ArrowRight, AlertCircle, TrendingDown, Package, Target, Sparkles, Award, Store } from 'lucide-react'

interface DashboardProps {
  data: any
  onNavigate?: (tab: any) => void
}

export default function Dashboard({ data, onNavigate }: DashboardProps) {
  // Vérification de sécurité
  if (!data || !data.familles || !data.allClients) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-flex p-6 bg-zinc-800 rounded-full mb-4">
            <div className="w-12 h-12 border-4 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-zinc-400">Chargement des données...</p>
        </div>
      </div>
    )
  }
  
  // KPIs séparés Magasin et Web
  const totalCAMagasin = Object.values(data.famillesMag || data.familles || {}).reduce((sum: number, f: any) => sum + (f?.ca || 0), 0)
  const totalCAWeb = data.webStats?.ca || 0
  const totalCA = totalCAMagasin + totalCAWeb
  
  // Transactions magasin uniquement (pas web)
  const ticketsMagasin = (data.allTickets || []).filter((t: any) => t.magasin !== 'WEB')
  const uniqueTicketsMag = new Set(ticketsMagasin.map((t: any) => t.ticket))
  const totalTransactionsMag = uniqueTicketsMag.size
  
  // Transactions web uniquement
  const totalTransactionsWeb = data.webStats?.tickets?.size || 0
  
  const panierMoyenMag = totalTransactionsMag > 0 ? totalCAMagasin / totalTransactionsMag : 0
  const panierMoyenWeb = totalTransactionsWeb > 0 ? totalCAWeb / totalTransactionsWeb : 0
  const nbClients = data.allClients?.size || 0
  
  // Calcul RFM exact identique à RFMAnalysis
  const calculateQuickRFM = () => {
    const segments = {
      ultraChampions: 0,
      champions: 0,
      loyaux: 0,
      nouveaux: 0,
      occasionnels: 0,
      risque: 0,
      perdus: 0
    }
    
    if (!data.allClients || data.allClients.size === 0) return segments
    
    const today = new Date()
    const clients: any[] = []
    
    const parseDate = (dateStr: string) => {
      if (!dateStr) return null
      const [day, month, year] = dateStr.split('/')
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    
    // Collecter tous les clients avec données brutes
    data.allClients.forEach((client: any) => {
      if (!client.achats || client.achats.length === 0) return
      
      let lastDate: Date | null = null
      
      for (const achat of client.achats) {
        const d = parseDate(achat.date)
        if (d && (!lastDate || d > lastDate)) lastDate = d
      }
      
      const recency = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 9999
      const frequency = client.achats.length
      const monetary = client.ca_total || 0
      
      if (monetary <= 0) return
      
      clients.push({ recency, frequency, monetary })
    })
    
    if (clients.length === 0) return segments
    
    // Calculer les quintiles
    const recencyValues = clients.map(c => c.recency).sort((a, b) => a - b)
    const frequencyValues = clients.map(c => c.frequency).sort((a, b) => b - a)
    const monetaryValues = clients.map(c => c.monetary).sort((a, b) => b - a)
    
    const getQuintileThresholds = (sortedValues: number[]) => {
      const len = sortedValues.length
      return [
        sortedValues[Math.floor(len * 0.2)],
        sortedValues[Math.floor(len * 0.4)],
        sortedValues[Math.floor(len * 0.6)],
        sortedValues[Math.floor(len * 0.8)]
      ]
    }
    
    const recencyThresholds = getQuintileThresholds(recencyValues)
    const frequencyThresholds = getQuintileThresholds(frequencyValues)
    const monetaryThresholds = getQuintileThresholds(monetaryValues)
    
    const getQuintile = (value: number, thresholds: number[], reverse = false) => {
      if (!reverse) {
        if (value >= thresholds[0]) return 5
        if (value >= thresholds[1]) return 4
        if (value >= thresholds[2]) return 3
        if (value >= thresholds[3]) return 2
        return 1
      } else {
        if (value <= thresholds[0]) return 5
        if (value <= thresholds[1]) return 4
        if (value <= thresholds[2]) return 3
        if (value <= thresholds[3]) return 2
        return 1
      }
    }
    
    // Assigner scores et segments
    clients.forEach(client => {
      const R = getQuintile(client.recency, recencyThresholds, true)
      const F = getQuintile(client.frequency, frequencyThresholds)
      const M = getQuintile(client.monetary, monetaryThresholds)
      
      // Segmentation identique à RFMAnalysis
      if (R === 5 && F === 5 && M === 5) segments.ultraChampions++
      else if (R >= 4 && F >= 4 && M >= 4) segments.champions++
      else if (R >= 4 && F === 3) segments.nouveaux++
      else if (R === 3 && F === 3) segments.occasionnels++
      else if (R >= 3 && F >= 3 && M >= 3) segments.loyaux++
      else if (F >= 3 && R <= 2) segments.risque++
      else segments.perdus++
    })
    
    return segments
  }
  
  const rfmSegments = calculateQuickRFM()

  // Top Sous-familles (analyse de rentabilité)
  const analyzeSubFamilies = () => {
    const subFams: any = {}
    
    if (!data.allTickets || data.allTickets.length === 0) return []
    
    data.allTickets.forEach((ticket: any) => {
      const key = `${ticket.famille}|${ticket.sousFamille}`
      if (!subFams[key]) {
        subFams[key] = {
          famille: ticket.famille,
          sousFamille: ticket.sousFamille,
          ca: 0,
          volume: 0,
          passages: new Set()
        }
      }
      subFams[key].ca += ticket.ca || 0
      subFams[key].volume += ticket.quantite || 0
      if (ticket.ticket) subFams[key].passages.add(ticket.ticket)
    })
    
    return Object.values(subFams)
      .map((sf: any) => ({
        ...sf,
        panierMoyen: sf.passages.size > 0 ? sf.ca / sf.passages.size : 0
      }))
      .sort((a: any, b: any) => b.ca - a.ca)
  }
  
  const topSubFamilies = analyzeSubFamilies().slice(0, 5)
  
  // Produits de Folie (intersection web/magasin)
  const getProduitsFollie = () => {
    if (!data.produitsWeb || !data.produitsMag) return []
    
    // Convertir les objets en tableaux avec le code produit
    const webArray = Object.entries(data.produitsWeb).map(([code, stats]: [string, any]) => ({
      code,
      nom: stats.nom || code,
      ca: stats.ca,
      volume: stats.volume,
      famille: stats.famille,
      sousFamille: stats.sousFamille
    }))
    
    const magArray = Object.entries(data.produitsMag).map(([code, stats]: [string, any]) => ({
      code,
      nom: stats.nom || code,
      ca: stats.ca,
      volume: stats.volume,
      famille: stats.famille,
      sousFamille: stats.sousFamille
    }))
    
    // Top 20 de chaque canal
    const topWebCodes = webArray.sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.code)
    const topMagCodes = magArray.sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.code)
    
    // Intersection
    return webArray
      .filter(p => topWebCodes.includes(p.code) && topMagCodes.includes(p.code))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 3)
  }
  
  const produitsFollie = getProduitsFollie()

  // Top Magasins
  const topMagasins = data.geo?.magasins 
    ? Object.entries(data.geo.magasins)
        .map(([mag, stats]: [string, any]) => ({ mag, ca: stats.ca || 0, volume: stats.volume || 0 }))
        .filter(m => !m.mag.startsWith('M41') && !m.mag.startsWith('M42')) // Exclure dépôts web
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5)
    : []

  // Évolution mensuelle
  const saisonData = data.saison 
    ? Object.entries(data.saison)
        .map(([month, familles]: [string, any]) => {
          const total = Object.values(familles).reduce((sum: number, ca: any) => sum + (ca || 0), 0)
          return { month, ca: total }
        })
        .sort((a, b) => a.month.localeCompare(b.month))
    : []
  
  // Calcul de la tendance (3 derniers mois)
  const recentMonths = saisonData.slice(-3)
  const avgRecent = recentMonths.length > 0 ? recentMonths.reduce((sum, m) => sum + m.ca, 0) / recentMonths.length : 0
  const previousMonths = saisonData.slice(-6, -3)
  const avgPrevious = previousMonths.length > 0 ? previousMonths.reduce((sum, m) => sum + m.ca, 0) / previousMonths.length : avgRecent
  const tendance = avgPrevious > 0 ? ((avgRecent - avgPrevious) / avgPrevious) * 100 : 0

  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`

  return (
    <div className="space-y-6">
      {/* En-tête avec titre */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Vue d'Ensemble</h1>
            <p className="text-zinc-400">Tableau de bord global de votre activité</p>
          </div>
          <div className="flex items-center gap-2">
            {tendance >= 0 ? (
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-400" />
            )}
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                {tendance >= 0 ? '+' : ''}{tendance.toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500">Tendance 3 mois</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Principaux - Magasin */}
      <div className="glass rounded-3xl p-6 border border-zinc-800 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-400" />
          Magasins Physiques
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">CA Magasins</p>
                <p className="text-3xl font-semibold text-white">{formatEuro(totalCAMagasin)}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  {((totalCAMagasin / totalCA) * 100).toFixed(1)}% du total
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Euro className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Transactions</p>
                <p className="text-3xl font-semibold text-white">{totalTransactionsMag.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  {Math.round(totalTransactionsMag / nbClients * 10) / 10} par client
                </p>
              </div>
              <div className="p-3 bg-cyan-500/20 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Panier Moyen</p>
                <p className="text-3xl font-semibold text-white">{formatEuro(panierMoyenMag)}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  Par transaction
                </p>
              </div>
              <div className="p-3 bg-teal-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </div>
          
          <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Magasins</p>
                <p className="text-3xl font-semibold text-white">{topMagasins.length}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  Points de vente
                </p>
              </div>
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Store className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* KPIs Web */}
      {totalCAWeb > 0 && (
        <div className="glass rounded-3xl p-6 border border-zinc-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            E-Commerce
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">CA Web</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(totalCAWeb)}</p>
                  <p className="text-xs text-cyan-400 mt-2 font-semibold">
                    {((totalCAWeb / totalCA) * 100).toFixed(1)}% du total
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <Euro className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Commandes</p>
                  <p className="text-3xl font-semibold text-white">{totalTransactionsWeb.toLocaleString('fr-FR')}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    En ligne
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <ShoppingCart className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Panier Moyen</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(panierMoyenWeb)}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    Par commande
                  </p>
                </div>
                <div className="p-3 bg-teal-500/20 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-teal-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Résumé Global */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">CA Total Global</p>
              <p className="text-3xl font-semibold text-white">{formatEuro(totalCA)}</p>
              <p className="text-xs text-zinc-400 mt-2">
                Magasins + Web
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Euro className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Clients Uniques</p>
              <p className="text-3xl font-semibold text-white">{nbClients.toLocaleString('fr-FR')}</p>
              <p className="text-xs text-purple-400 mt-2 font-semibold">
                {rfmSegments.ultraChampions + rfmSegments.champions} Top Clients ⭐
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Segmentation RFM Rapide */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-2xl">
              <Users className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-white">Segmentation Clientèle</h3>
              <p className="text-sm text-zinc-500">Répartition par comportement d'achat</p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('rfm')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition-all font-medium"
            >
              Voir détails <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-2xl p-5 border border-yellow-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">👑 Ultra Champions</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.ultraChampions}</p>
            <p className="text-xs text-yellow-400 mt-1">Perfection 555</p>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-5 border border-emerald-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">🏆 Champions</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.champions}</p>
            <p className="text-xs text-emerald-400 mt-1">Meilleurs</p>
          </div>
          <div className="bg-blue-500/10 rounded-2xl p-5 border border-blue-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">💙 Loyaux</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.loyaux}</p>
            <p className="text-xs text-blue-400 mt-1">Fidèles</p>
          </div>
          <div className="bg-cyan-500/10 rounded-2xl p-5 border border-cyan-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">✨ Nouveaux</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.nouveaux}</p>
            <p className="text-xs text-cyan-400 mt-1">1er achat</p>
          </div>
          <div className="bg-zinc-500/10 rounded-2xl p-5 border border-zinc-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">🔄 Occasionnels</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.occasionnels}</p>
            <p className="text-xs text-zinc-400 mt-1">Irréguliers</p>
          </div>
          <div className="bg-orange-500/10 rounded-2xl p-5 border border-orange-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">⚠️ À Risque</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.risque}</p>
            <p className="text-xs text-orange-400 mt-1">À réactiver</p>
          </div>
          <div className="bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">❌ Perdus</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.perdus}</p>
            <p className="text-xs text-red-400 mt-1">Inactifs</p>
          </div>
        </div>
      </div>

      {/* Insights & Produits de Folie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sous-familles */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <Package className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Top Sous-familles</h3>
                <p className="text-sm text-zinc-500">Les plus performantes</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('subFamilies')}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-xl transition-all text-sm font-medium"
              >
                Analyse <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {topSubFamilies.map((sf: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white text-sm">{sf.famille}</p>
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full font-bold">
                    #{idx + 1}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-2">{sf.sousFamille}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{formatEuro(sf.ca)}</span>
                  <span className="text-xs text-zinc-400">PM: {formatEuro(sf.panierMoyen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Produits de Folie */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Produits de Folie</h3>
                <p className="text-sm text-zinc-500">Stars Web & Magasin</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('social')}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl transition-all text-sm font-medium"
              >
                Voir tous <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {produitsFollie.length > 0 ? (
            <div className="space-y-3">
              {produitsFollie.map((p: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <p className="font-bold text-white">{p.nom}</p>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">Code: {p.code}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{formatEuro(p.ca)}</span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-bold">
                      {p.volume} ventes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Aucun produit commun trouvé</p>
              <p className="text-zinc-600 text-xs mt-1">Importez plus de données</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Magasins */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-2xl">
              <Store className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-white">Performance Magasins</h3>
              <p className="text-sm text-zinc-500">Top 5 des points de vente</p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('stores')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-all font-medium"
            >
              Analyse complète <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topMagasins.map((mag: any, idx: number) => (
            <div key={idx} className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-green-400">#{idx + 1}</span>
                <Target className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="font-bold text-white mb-2">{mag.mag}</p>
              <p className="text-lg font-semibold text-white mb-1">{formatEuro(mag.ca)}</p>
              <p className="text-xs text-zinc-500">{mag.volume.toLocaleString()} articles</p>
            </div>
          ))}
        </div>
      </div>

      {/* Évolution du CA */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold text-white">Évolution du Chiffre d'Affaires</h3>
            <p className="text-sm text-zinc-500">Tendance sur la période</p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('forecast')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all font-medium"
            >
              Prévisions <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={saisonData}>
            <defs>
              <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis 
              dataKey="month" 
              angle={-45} 
              textAnchor="end" 
              height={90} 
              fontSize={10} 
              stroke="#71717a" 
            />
            <YAxis tickFormatter={formatEuro} stroke="#71717a" />
            <Tooltip 
              formatter={(value: any) => formatEuro(value)}
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                color: '#ffffff'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="ca" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#colorCA)"
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6, fill: '#06b6d4' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alertes & Recommandations */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-amber-500/20 rounded-2xl">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white">Insights & Actions</h3>
            <p className="text-sm text-zinc-500">Recommandations basées sur vos données</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfmSegments.risque > 0 && (
            <div className="bg-orange-500/10 rounded-xl p-5 border border-orange-500/20">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <p className="font-bold text-white">Clients à risque</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                {rfmSegments.risque} clients risquent de partir. Lancez une campagne de réactivation.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('rfm')}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Voir la segmentation →
                </button>
              )}
            </div>
          )}
          
          {rfmSegments.nouveaux > 10 && (
            <div className="bg-cyan-500/10 rounded-xl p-5 border border-cyan-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <p className="font-bold text-white">Nouveaux clients</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                {rfmSegments.nouveaux} nouveaux clients ! Créez une offre de bienvenue pour les fidéliser.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('cohortes')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Analyser les cohortes →
                </button>
              )}
            </div>
          )}
          
          {tendance < -5 && (
            <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <p className="font-bold text-white">Baisse d'activité</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                Le CA a baissé de {Math.abs(tendance).toFixed(1)}% ces 3 derniers mois. Analysez les causes.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('forecast')}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Voir les prévisions →
                </button>
              )}
            </div>
          )}
          
          <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/20">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <p className="font-bold text-white">Opportunités cross-sell</p>
            </div>
            <p className="text-sm text-zinc-400 mb-3">
              Découvrez quels produits sont souvent achetés ensemble pour optimiser vos recommandations.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('crossSelling')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                Analyser le cross-selling →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
