import { Crown, Mail, Phone, MapPin, Euro, ShoppingBag, Calendar, TrendingUp, Award, Users, Download } from 'lucide-react'
import { useState, useEffect } from 'react'

interface VIPClient {
  carte: string
  nom?: string | null
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  sexe?: string | null
  ville?: string | null
  cp?: string | null
  monetary: number
  frequency: number
  recency: number
  lastDate: string
  segment: string
  R: number
  F: number
  M: number
}

export default function KingQuentin() {
  const [vipClients, setVipClients] = useState<VIPClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVIPClients = async () => {
      try {
        setLoading(true)
        // Charger les segments RFM et filtrer les VIP (Ultra Champions + Champions)
        const response = await fetch('/api/rfm?magasin=TOUS')
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des données')
        }
        
        const data = await response.json()
        
        // Filtrer uniquement les VIP (Ultra Champions et Champions)
        const vips = data.clients.filter((c: VIPClient) => 
          c.segment === 'Ultra Champions' || c.segment === 'Champions'
        ).sort((a: VIPClient, b: VIPClient) => b.monetary - a.monetary)
        
        setVipClients(vips)
      } catch (err: any) {
        console.error('Erreur King Quentin:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVIPClients()
  }, [])

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  const exportVIPToCSV = () => {
    const headers = ['Rang', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Sexe', 'Ville', 'CP', 'Carte', 'Segment', 'CA Total', 'Nb Achats', 'Dernier Achat']
    const rows = vipClients.map((client, idx) => [
      idx + 1,
      client.nom || '',
      client.prenom || '',
      client.email || '',
      client.telephone || '',
      client.sexe || '',
      client.ville || '',
      client.cp || '',
      client.carte,
      client.segment,
      Math.round(client.monetary),
      client.frequency,
      client.lastDate
    ])
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `king_quentin_vip_clients_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Chargement des clients VIP...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Crown className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  const totalCA = vipClients.reduce((sum, c) => sum + c.monetary, 0)
  const avgCA = totalCA / vipClients.length
  const clientsAvecEmail = vipClients.filter(c => c.email).length
  const clientsAvecTel = vipClients.filter(c => c.telephone).length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                King Quentin 👑
                <span className="text-lg text-amber-400">VIP Zone</span>
              </h2>
              <p className="text-zinc-400">Vos clients les plus précieux - Champions & Ultra Champions</p>
            </div>
          </div>
          <button
            onClick={exportVIPToCSV}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
          >
            <Download className="w-5 h-5" />
            Export VIP CSV
          </button>
        </div>

        {/* KPIs VIP */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-amber-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Clients VIP</p>
            </div>
            <p className="text-3xl font-bold text-white">{vipClients.length}</p>
            <p className="text-xs text-amber-400 mt-1">Champions exclusifs</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Euro className="w-5 h-5 text-emerald-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total VIP</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(totalCA)}</p>
            <p className="text-xs text-emerald-400 mt-1">{formatEuro(avgCA)} / client</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-blue-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Emails disponibles</p>
            </div>
            <p className="text-3xl font-bold text-white">{clientsAvecEmail}</p>
            <p className="text-xs text-blue-400 mt-1">{((clientsAvecEmail / vipClients.length) * 100).toFixed(1)}% des VIP</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-cyan-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Téléphones</p>
            </div>
            <p className="text-3xl font-bold text-white">{clientsAvecTel}</p>
            <p className="text-xs text-cyan-400 mt-1">{((clientsAvecTel / vipClients.length) * 100).toFixed(1)}% des VIP</p>
          </div>
        </div>
      </div>

      {/* Liste VIP */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-2xl font-bold text-white mb-6">🏆 Top {vipClients.length} Clients VIP</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Identité</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Localisation</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Achats</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Dernier Achat</th>
              </tr>
            </thead>
            <tbody>
              {vipClients.map((client, idx) => (
                <tr key={client.carte} className="border-b border-zinc-800 hover:bg-amber-500/5 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {idx < 3 && <Award className="w-5 h-5 text-amber-500" />}
                      <span className="text-sm font-bold text-amber-400">#{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                      client.segment === 'Ultra Champions' 
                        ? 'bg-purple-500/20 text-purple-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {client.segment === 'Ultra Champions' ? '👑💎 Ultra' : '👑 Champion'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {client.nom && client.prenom ? (
                      <div>
                        <p className="text-sm font-bold text-white">{client.prenom} {client.nom}</p>
                        <p className="text-xs text-zinc-500">Carte {client.carte}</p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-white">Carte {client.carte}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs space-y-1">
                      {client.email ? (
                        <p className="text-green-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </p>
                      ) : (
                        <p className="text-zinc-600">No email</p>
                      )}
                      {client.telephone ? (
                        <p className="text-cyan-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.telephone}
                        </p>
                      ) : (
                        <p className="text-zinc-600">No phone</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <MapPin className="w-3 h-3" />
                      <span>{client.ville || '-'} {client.cp && `(${client.cp})`}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-bold text-emerald-400">{formatEuro(client.monetary)}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-medium text-white">{client.frequency}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="text-xs">
                      <p className="text-zinc-400">{new Date(client.lastDate).toLocaleDateString('fr-FR')}</p>
                      <p className="text-orange-400">Il y a {client.recency}j</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action recommandée */}
      <div className="glass rounded-3xl p-8 border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
        <div className="flex items-start gap-4">
          <TrendingUp className="w-8 h-8 text-amber-500 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-white mb-2">💡 Actions recommandées pour vos VIP</h3>
            <div className="space-y-2 text-zinc-300">
              <p>✅ <strong>Campagne email exclusive</strong> : {clientsAvecEmail} clients VIP avec email disponible</p>
              <p>✅ <strong>Relance téléphonique</strong> : {clientsAvecTel} VIP avec numéro de téléphone</p>
              <p>✅ <strong>Programme ambassadeur</strong> : Récompensez vos Ultra Champions ({vipClients.filter(c => c.segment === 'Ultra Champions').length} clients)</p>
              <p>✅ <strong>Offres personnalisées</strong> : CA moyen VIP de {formatEuro(avgCA)}, optimisez l'upsell</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
