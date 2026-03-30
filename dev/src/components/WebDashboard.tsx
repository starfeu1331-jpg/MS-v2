import { Globe, TrendingUp, Users, Package, ShoppingCart, ArrowRight } from 'lucide-react'

interface WebDashboardProps {
  data: any
}

export default function WebDashboard({ data }: WebDashboardProps) {
  if (!data || !data.webStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Globe className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Aucune donnée web</h2>
          <p className="text-zinc-400">Chargez un fichier CSV web pour voir les statistiques</p>
        </div>
      </div>
    )
  }

  const { ca = 0, volume = 0, ticketsUniques = 0 } = data.webStats
  const panierMoyen = ticketsUniques > 0 ? ca / ticketsUniques : 0

  // Top produits web
  const topProduitsWeb = Object.entries(data.produitsWeb || {})
    .map(([code, stats]: [string, any]) => ({
      code,
      nom: stats.nom || code,
      ca: stats.ca || 0,
      volume: stats.volume || 0
    }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)

  // Top clients web
  let debugCount = 0
  const topClientsWeb = Array.from(data.allClients.entries() as any)
    .filter(([_, client]: any) => {
      return client.achats?.some((a: any) => a.magasin === 'WEB')
    })
    .map(([carte, client]: any) => {
      const achatsWeb = client.achats.filter((a: any) => a.magasin === 'WEB')
      const caWeb = achatsWeb.reduce((sum: number, a: any) => sum + (a.ca || 0), 0)
      
      // Debug premiers clients
      if (debugCount < 3) {
        console.log(`🔍 Client web #${debugCount + 1}:`, {
          carte,
          achatsWeb: achatsWeb.length,
          premierAchat: achatsWeb[0],
          caWeb,
          ville: client.ville
        })
        debugCount++
      }
      
      return {
        carte,
        nom: client.nom || carte,
        ville: client.ville || '-',
        ca: caWeb,
        nbCommandes: achatsWeb.length
      }
    })
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)

  const formatEuro = (val: number) => {
    if (!val || isNaN(val)) return '0€'
    return `${Math.round(val).toLocaleString('fr-FR')}€`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">E-Commerce</h2>
            <p className="text-zinc-400">Vue d'ensemble des ventes en ligne</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-cyan-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Web</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatEuro(ca)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Commandes</p>
            </div>
            <p className="text-2xl font-bold text-white">{ticketsUniques.toLocaleString('fr-FR')}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Panier Moyen</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatEuro(panierMoyen)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Articles</p>
            </div>
            <p className="text-2xl font-bold text-white">{volume.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {/* Top 10 Produits Web */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Package className="w-5 h-5 text-cyan-500" />
          Top 10 Produits Web
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Produit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Quantité</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA</th>
              </tr>
            </thead>
            <tbody>
              {topProduitsWeb.map((produit, idx) => (
                <tr key={produit.code} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-cyan-400">{produit.code}</td>
                  <td className="px-4 py-3 text-sm text-white">{produit.nom}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">{produit.volume}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-white">{formatEuro(produit.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Clients Web */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Top 10 Clients Web
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Carte</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Ville</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Commandes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA</th>
              </tr>
            </thead>
            <tbody>
              {topClientsWeb.map((client, idx) => (
                <tr key={client.carte} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-400">{client.carte}</td>
                  <td className="px-4 py-3 text-sm text-white">{client.nom}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{client.ville}</td>
                  <td className="px-4 py-3 text-sm text-center text-purple-400">{client.nbCommandes}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-white">{formatEuro(client.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparaison Magasin vs Web */}
      {data.allTickets && (
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-emerald-500" />
            Magasin vs Web
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-orange-500/10 rounded-2xl border border-orange-500/20">
              <p className="text-sm text-orange-400 font-semibold uppercase mb-2">Magasins</p>
              <p className="text-3xl font-bold text-white mb-1">
                {formatEuro(data.allTickets.filter((t: any) => t.magasin !== 'WEB')
                  .reduce((sum: number, t: any) => sum + (t.ca_ttc || 0), 0))}
              </p>
              <p className="text-xs text-zinc-500">
                {data.allTickets.filter((t: any) => t.magasin !== 'WEB').length} tickets
              </p>
            </div>
            <div className="text-center p-6 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
              <p className="text-sm text-cyan-400 font-semibold uppercase mb-2">Web</p>
              <p className="text-3xl font-bold text-white mb-1">{formatEuro(ca)}</p>
              <p className="text-xs text-zinc-500">{ticketsUniques} commandes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
