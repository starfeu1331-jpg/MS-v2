import { Package, TrendingDown, TrendingUp, AlertTriangle, Globe, Store } from 'lucide-react'
import { useState } from 'react'

interface SubFamilyAnalysisProps {
  data: any
}

export default function SubFamilyAnalysis({ data }: SubFamilyAnalysisProps) {
  const [cacTotal, setCacTotal] = useState(25)
  const [isEditingCAC, setIsEditingCAC] = useState(false)
  const [showWeb, setShowWeb] = useState(false) // Toggle Web/Magasin

  if (!data || !data.allClients) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  // Coûts marketing 2025
  const MARKETING_COST_TOTAL = 971290

  const analyzeSubFamilies = (webOnly: boolean = false) => {
    const subFamilyStats: Record<string, {
      famille: string
      sousFamille: string
      ca: number
      volume: number
      tickets: Set<string>
    }> = {}

    // Filtrer les tickets selon le toggle
    const filteredTickets = data.allTickets.filter((t: any) => 
      webOnly ? t.magasin === 'WEB' : t.magasin !== 'WEB'
    )

    if (filteredTickets && filteredTickets.length > 0) {
      filteredTickets.forEach((ticket: any) => {
        const famille = ticket.famille || 'Non classé'
        const sousFamille = ticket.sousFamille || 'Non classé'
        const key = `${famille}|||${sousFamille}`

        if (!subFamilyStats[key]) {
          subFamilyStats[key] = {
            famille,
            sousFamille,
            ca: 0,
            volume: 0,
            tickets: new Set()
          }
        }

        const ca = ticket.ca || 0
        subFamilyStats[key].ca += ca
        subFamilyStats[key].volume += 1

        // Compter les tickets uniques (passages en magasin ou commandes web)
        if (ticket.ticket && ticket.ticket !== 'N/A') {
          subFamilyStats[key].tickets.add(ticket.ticket)
        }
      })
    }

    // Calculer le nombre total de tickets (passages)
    const allTicketsUniques = new Set(filteredTickets.map((t: any) => t.ticket).filter((t: string) => t && t !== 'N/A'))
    const totalTickets = allTicketsUniques.size

    // Convertir en tableau et calculer les métriques
    const results = Object.entries(subFamilyStats).map(([, stats]) => {
      const nbTickets = stats.tickets.size
      const panierMoyen = nbTickets > 0 ? stats.ca / nbTickets : 0
      const caParVolume = stats.volume > 0 ? stats.ca / stats.volume : 0
      
      // Comparer au CAC total
      const isRentable = panierMoyen >= cacTotal
      const ratioCAC = cacTotal > 0 ? (panierMoyen / cacTotal) * 100 : 0

      return {
        famille: stats.famille,
        sousFamille: stats.sousFamille,
        ca: stats.ca,
        volume: stats.volume,
        nbTickets,
        panierMoyen,
        caParVolume,
        isRentable,
        ratioCAC
      }
    })

    return {
      subFamilies: results.sort((a, b) => b.ca - a.ca),
      cacTotal,
      totalTickets
    }
  }

  const analysis = analyzeSubFamilies(showWeb)
  const { subFamilies, totalTickets } = analysis

  const totalCA = subFamilies.reduce((sum, sf) => sum + sf.ca, 0)
  const subFamiliesRentables = subFamilies.filter(sf => sf.isRentable).length
  const subFamiliesNonRentables = subFamilies.filter(sf => !sf.isRentable).length

  return (
    <div className="space-y-6">
      {/* En-tête avec KPIs CAC */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Analyse Sous-Familles</h2>
              <p className="text-zinc-400">Rentabilité par sous-famille vs Coût d'Acquisition Client (CAC)</p>
            </div>
          </div>
          
          {/* Toggle Web/Magasin */}
          <button
            onClick={() => setShowWeb(!showWeb)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all border-2 ${
              showWeb
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            }`}
          >
            {showWeb ? (
              <>
                <Globe className="w-5 h-5" />
                <span>E-Commerce</span>
              </>
            ) : (
              <>
                <Store className="w-5 h-5" />
                <span>Magasins</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-2xl p-4 border border-purple-600/30">
            <p className="text-xs text-purple-400 font-semibold uppercase mb-1">CAC Total</p>
            {isEditingCAC ? (
              <input
                type="number"
                value={cacTotal}
                onChange={(e) => setCacTotal(parseFloat(e.target.value) || 0)}
                onBlur={() => setIsEditingCAC(false)}
                autoFocus
                className="text-2xl font-bold text-white bg-transparent border-b border-purple-400 outline-none w-full"
              />
            ) : (
              <p 
                className="text-2xl font-bold text-white cursor-pointer hover:text-purple-300 transition-colors"
                onClick={() => setIsEditingCAC(true)}
                title="Cliquer pour modifier"
              >
                {formatEuro(cacTotal)}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-1">{MARKETING_COST_TOTAL.toLocaleString('fr-FR')}€ / {totalTickets.toLocaleString('fr-FR')} passages</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 rounded-2xl p-4 border border-emerald-600/30">
            <p className="text-xs text-emerald-400 font-semibold uppercase mb-1">✅ Rentables</p>
            <p className="text-2xl font-bold text-white">{subFamiliesRentables}</p>
            <p className="text-xs text-zinc-500 mt-1">Panier moyen &gt; CAC</p>
          </div>

          <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-2xl p-4 border border-red-600/30">
            <p className="text-xs text-red-400 font-semibold uppercase mb-1">❌ Non rentables</p>
            <p className="text-2xl font-bold text-white">{subFamiliesNonRentables}</p>
            <p className="text-xs text-zinc-500 mt-1">Panier moyen &lt; CAC</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase mb-1">CA Total</p>
            <p className="text-2xl font-bold text-white">{formatEuro(totalCA)}</p>
            <p className="text-xs text-zinc-500 mt-1">{subFamilies.length} sous-familles</p>
          </div>
        </div>
      </div>

      {/* Tableau des sous-familles */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">📊 Rentabilité par Sous-Famille</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-400">Rentable</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-zinc-400">Non rentable</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Famille</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Sous-Famille</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Passages</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Panier Moyen</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">vs CAC</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">État</th>
              </tr>
            </thead>
            <tbody>
              {subFamilies.map((sf, idx) => (
                <tr 
                  key={`${sf.famille}-${sf.sousFamille}`} 
                  className={`border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${
                    sf.isRentable ? 'bg-emerald-950/20' : 'bg-red-950/20'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{sf.famille}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{sf.sousFamille}</td>
                  <td className="px-4 py-3 text-center text-sm text-zinc-300">
                    {sf.nbTickets.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">
                    {formatEuro(sf.ca)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold">
                    <span className={sf.isRentable ? 'text-emerald-400' : 'text-red-400'}>
                      {formatEuro(sf.panierMoyen)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                      sf.ratioCAC >= 100 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sf.ratioCAC.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sf.isRentable ? (
                      <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avertissement sur les sous-familles non rentables */}
      {subFamiliesNonRentables > 0 && (
        <div className="glass rounded-3xl p-6 border border-orange-600/50 bg-orange-950/20">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-orange-300 mb-2">
                ⚠️ Attention : {subFamiliesNonRentables} sous-famille{subFamiliesNonRentables > 1 ? 's' : ''} non rentable{subFamiliesNonRentables > 1 ? 's' : ''}
              </h3>
              <p className="text-zinc-400 text-sm">
                Ces sous-familles ont un panier moyen par passage inférieur au CAC ({formatEuro(cacTotal)}). 
                Cela signifie qu'en moyenne, le coût pour ramener un client est supérieur au CA généré 
                par passage dans ces catégories. Considérez :
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                <li>• Augmenter les ventes croisées sur ces produits</li>
                <li>• Optimiser les coûts marketing pour ces segments</li>
                <li>• Revoir la stratégie de prix ou de promotion</li>
                <li>• Analyser si ces produits servent de produits d'appel</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
