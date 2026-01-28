import { Crown } from 'lucide-react'

export default function KingQuentin() {
  // Module désactivé : nécessite fichier catalogue_web.csv non disponible en base
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <Crown className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">King Quentin 👑</h2>
        <p className="text-zinc-400 mb-4">Module non disponible</p>
        <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 text-left">
          <p className="text-sm text-zinc-400">
            Ce module nécessite le fichier <code className="text-emerald-400">catalogue_web.csv</code> qui contient
            les produits disponibles sur le site web.
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Pour activer ce module, importez d'abord le catalogue web dans la base de données.
          </p>
        </div>
      </div>
    </div>
  )
}


  // Créer un Set des codes articles disponibles sur le web
  const produitsWebSet = new Set(
    Object.keys(data.catalogueWeb).map(code => code.toLowerCase().trim())
  )

  // Analyser les produits magasin qui ne sont PAS sur le web
  const recommandations = Object.entries(data.produitsMag)
    .map(([code, stats]: [string, any]) => {
      const codeNormalized = code.toLowerCase().trim()
      const surWeb = produitsWebSet.has(codeNormalized)
      
      return {
        code,
        nom: stats.nom || code,
        famille: stats.famille || '-',
        sousFamille: stats.sousFamille || '-',
        ca: stats.ca || 0,
        volume: stats.volume || 0,
        surWeb,
        score: stats.ca // Score basé sur le CA magasin
      }
    })
    .filter(p => !p.surWeb && p.ca > 0) // Seulement ceux PAS sur le web et avec des ventes
    .sort((a, b) => b.score - a.score) // Trier par CA décroissant

  const top100 = recommandations.slice(0, 100)
  const top1000 = recommandations.slice(0, 1000)

  const formatEuro = (val: number) => {
    if (!val || isNaN(val)) return '0€'
    return `${Math.round(val).toLocaleString('fr-FR')}€`
  }

  const exportCSV = () => {
    const headers = ['Rang', 'Code Article', 'Nom', 'Famille', 'Sous-Famille', 'CA Magasin', 'Volume Magasin', 'Score Recommandation']
    const rows = top1000.map((p, idx) => [
      idx + 1,
      p.code,
      p.nom,
      p.famille,
      p.sousFamille,
      p.ca.toFixed(2),
      p.volume,
      p.score.toFixed(2)
    ])

    // BOM UTF-8 pour Excel + point-virgule comme séparateur
    const BOM = '\uFEFF'
    const csvContent = BOM + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `recommandations_web_top1000_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const totalCA = recommandations.reduce((sum, p) => sum + p.ca, 0)
  const totalVolume = recommandations.reduce((sum, p) => sum + p.volume, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">King Quentin 👑</h2>
              <p className="text-zinc-400">Produits à ajouter en priorité sur le e-commerce</p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
          >
            <Download className="w-5 h-5" />
            Exporter Top 1000
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Produits à Ajouter</p>
            </div>
            <p className="text-2xl font-bold text-white">{recommandations.length.toLocaleString('fr-FR')}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Potentiel</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatEuro(totalCA)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Volume Mag</p>
            </div>
            <p className="text-2xl font-bold text-white">{totalVolume.toLocaleString('fr-FR')}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Catalogue Web</p>
            </div>
            <p className="text-2xl font-bold text-white">{produitsWebSet.size.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {/* Top 100 Recommandations */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">🏆 Top 100 Produits Recommandés</h3>
        <p className="text-sm text-zinc-400 mb-6">
          Ces produits se vendent bien en magasin mais ne sont pas encore disponibles sur le site web
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Famille</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA Mag</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Volume</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Priorité</th>
              </tr>
            </thead>
            <tbody>
              {top100.map((produit, idx) => (
                <tr key={produit.code} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      idx < 10 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-400">{produit.code}</td>
                  <td className="px-4 py-3 text-sm text-white max-w-xs truncate">{produit.nom}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{produit.famille}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatEuro(produit.ca)}</td>
                  <td className="px-4 py-3 text-center text-sm text-zinc-300">{produit.volume}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                      idx < 20 ? 'bg-red-500/20 text-red-400' :
                      idx < 50 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {idx < 20 ? 'URGENT' : idx < 50 ? 'HAUTE' : 'MOYENNE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
