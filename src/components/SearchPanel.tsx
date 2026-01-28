import { useState } from 'react'
import { Search, Ticket, User, Package, Store, Calendar, Euro } from 'lucide-react'

interface SearchPanelProps {
  data?: any
  initialSearch?: string
}

interface Transaction {
  id: number
  facture: string
  date: string
  ca: number
  quantite: number
  produit: string
  depot: string
  carte: string
  client?: {
    carte: string
    ville: string
    cp: string
  }
  produitRef?: {
    id: string
    famille: string
    sous_famille: string
  }
  magasin?: {
    code: string
    nom: string
  }
}

interface ClientResult {
  carte: string
  ville: string
  cp: string
  transactions: Transaction[]
  totalCA: number
  nbAchats: number
}

export default function SearchPanel({ initialSearch }: SearchPanelProps) {
  const [mode, setMode] = useState<'ticket' | 'client'>('client')
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')
  const [loading, setLoading] = useState(false)
  const [ticketResults, setTicketResults] = useState<Transaction[]>([])
  const [clientResult, setClientResult] = useState<ClientResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formatEuro = (value: number) =>
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setLoading(true)
    setError(null)
    setTicketResults([])
    setClientResult(null)

    try {
      if (mode === 'ticket') {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        const response = await fetch(`${API_URL}/api/tickets/${searchTerm.trim()}`)
        if (!response.ok) throw new Error('Ticket non trouvé')
        
        const data = await response.json()
        setTicketResults(data)
        
        if (data.length === 0) {
          setError('Aucun ticket trouvé avec ce numéro')
        }
      } else {
        const response = await fetch(`${API_URL}/api/clients/${searchTerm.trim()}`)
        if (!response.ok) throw new Error('Client non trouvé')
        
        const data = await response.json()
        
        if (!data || !data.transactions) {
          setError('Client non trouvé')
          return
        }

        const totalCA = data.transactions.reduce((sum: number, t: Transaction) => sum + Number(t.ca), 0)
        const nbAchats = data.transactions.length

        setClientResult({
          carte: data.carte,
          ville: data.ville,
          cp: data.cp,
          transactions: data.transactions,
          totalCA,
          nbAchats
        })
      }
    } catch (err) {
      console.error('Erreur recherche:', err)
      setError(mode === 'ticket' ? 'Ticket non trouvé' : 'Client non trouvé')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-8 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float"></div>
      </div>

      <div className="glass rounded-2xl p-2 inline-flex gap-2 shadow-lg border border-zinc-800">
        <button
          onClick={() => {
            setMode('ticket')
            setSearchTerm('')
            setTicketResults([])
            setClientResult(null)
            setError(null)
          }}
          className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all ${
            mode === 'ticket'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
        >
          <Ticket className="w-5 h-5" />
          Recherche Ticket
        </button>
        <button
          onClick={() => {
            setMode('client')
            setSearchTerm('')
            setTicketResults([])
            setClientResult(null)
            setError(null)
          }}
          className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all ${
            mode === 'client'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
        >
          <User className="w-5 h-5" />
          Recherche Client
        </button>
      </div>

      <div className="glass rounded-2xl p-6 shadow-2xl border border-zinc-800">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                mode === 'ticket' ? '🎫 Entrez un numéro de ticket...' : '👤 Entrez un numéro de carte...'
              }
              className="w-full px-6 py-4 bg-zinc-900/50 border-2 border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-lg font-medium transition-all text-white placeholder-zinc-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black rounded-xl hover:shadow-2xl hover:shadow-blue-500/20 transition-all shadow-lg group transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="glass rounded-2xl p-12 text-center shadow-xl border border-zinc-800">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-zinc-400 mt-4">Recherche en cours...</p>
        </div>
      )}

      {error && !loading && (
        <div className="glass rounded-3xl p-12 text-center shadow-xl border border-red-500/20">
          <div className="inline-flex p-6 bg-red-500/10 rounded-full mb-6">
            <Search className="w-16 h-16 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">{error}</p>
          <p className="text-sm text-zinc-500 mt-2">Essayez avec un autre numéro</p>
        </div>
      )}

      {mode === 'ticket' && ticketResults.length > 0 && !loading && (
        <div>
          <div className="glass rounded-2xl p-4 mb-6 inline-flex items-center gap-3 shadow-lg border border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-black">
              {ticketResults.length}
            </div>
            <p className="text-sm font-bold text-zinc-300">
              transaction{ticketResults.length > 1 ? 's' : ''} trouvée{ticketResults.length > 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="space-y-4">
            {ticketResults.map((transaction, idx) => (
              <div
                key={idx}
                className="glass rounded-2xl shadow-xl p-6 card-hover border-l-4 border-blue-500 group border border-zinc-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl">
                      <Ticket className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-gradient">Ticket #{transaction.facture}</p>
                      <p className="text-sm text-zinc-400 font-medium flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-bold uppercase">Montant</p>
                    <p className="text-3xl font-black text-gradient">{formatEuro(transaction.ca)}</p>
                  </div>
                </div>

                {transaction.produitRef && (
                  <div className="mb-4 bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Package className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">
                          {transaction.produitRef.famille} - {transaction.produitRef.sous_famille}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                          <span className="text-zinc-400">
                            Code: <span className="text-blue-400 font-bold">{transaction.produit}</span>
                          </span>
                          <span className="text-zinc-400">
                            Quantité: <span className="text-emerald-400 font-bold">{transaction.quantite}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                    <span className="text-xs text-zinc-500 font-bold uppercase">Client</span>
                    <p className="font-bold text-white mt-1">{transaction.carte}</p>
                  </div>
                  {transaction.client && (
                    <>
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Ville</span>
                        <p className="font-bold text-white mt-1">{transaction.client.ville}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">CP</span>
                        <p className="font-bold text-white mt-1">{transaction.client.cp}</p>
                      </div>
                    </>
                  )}
                  {transaction.magasin && (
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                      <span className="text-xs text-zinc-500 font-bold uppercase flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        Magasin
                      </span>
                      <p className="font-bold text-white mt-1">{transaction.magasin.nom}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'client' && clientResult && !loading && (
        <div className="glass rounded-3xl shadow-2xl p-8 border border-zinc-800">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-gradient">Carte: {clientResult.carte}</h3>
              <p className="text-sm text-zinc-400 font-medium mt-1">
                📍 {clientResult.ville} - {clientResult.cp}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
              <p className="text-sm text-zinc-400 font-bold uppercase mb-2 flex items-center gap-2">
                <Euro className="w-4 h-4" />
                CA Total
              </p>
              <p className="text-3xl font-black text-gradient">
                {formatEuro(clientResult.totalCA)}
              </p>
            </div>
            <div className="bg-cyan-500/10 rounded-2xl p-6 border border-cyan-500/20">
              <p className="text-sm text-zinc-400 font-bold uppercase mb-2">🛒 Nb Transactions</p>
              <p className="text-3xl font-black text-gradient">{clientResult.nbAchats}</p>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
              Historique des transactions
            </h4>
            <div className="max-h-96 overflow-y-auto rounded-xl">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Produit</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Magasin</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {clientResult.transactions.map((transaction, idx) => (
                    <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">{formatDate(transaction.date)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">{transaction.facture}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">
                        {transaction.produitRef ? (
                          <div className="text-xs">
                            <div className="text-white font-bold">{transaction.produitRef.famille}</div>
                            <div className="text-zinc-500">{transaction.produitRef.sous_famille}</div>
                          </div>
                        ) : (
                          transaction.produit
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">
                        {transaction.magasin?.nom || transaction.depot}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-blue-400">
                        {formatEuro(transaction.ca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
