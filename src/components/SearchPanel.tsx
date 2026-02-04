import { useState, useEffect } from 'react'
import { Search, Ticket, User, Package, Store, Calendar, Euro } from 'lucide-react'

interface SearchPanelProps {
  data?: any
  initialSearch?: string
}

interface Transaction {
  id?: number
  facture: string
  date: string
  ca: number
  quantite: number
  produit: string
  depot: string
  carte: string
  ville?: string
  famille?: string
  sous_famille?: string
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
    ville?: string
  }
}

interface ClientResult {
  carte: string
  ville: string
  cp: string
  nom?: string | null
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  civilite?: string | null
  sexe?: string | null
  date_naissance?: string | null
  date_creation?: string | null
  transactions: Transaction[]
  totalCA: number
  nbAchats: number
}

// Cache pour les recherches
const searchCache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache de l'état UI pour conserver la recherche
interface SearchUIState {
  mode: 'ticket' | 'client' | 'produit'
  searchTerm: string
  ticketResults?: Transaction[]
  ticketInfo?: any
  clientResult?: ClientResult | null
  produitResult?: any
}
let searchUIState: SearchUIState | null = null

export default function SearchPanel({ initialSearch }: SearchPanelProps) {
  // Restaurer l'état UI depuis le cache
  const [mode, setMode] = useState<'ticket' | 'client' | 'produit'>(searchUIState?.mode || 'client')
  const [searchTerm, setSearchTerm] = useState(searchUIState?.searchTerm || initialSearch || '')
  const [loading, setLoading] = useState(false)
  const [ticketResults, setTicketResults] = useState<Transaction[]>(searchUIState?.ticketResults || [])
  const [ticketInfo, setTicketInfo] = useState<any>(searchUIState?.ticketInfo || null)
  const [clientResult, setClientResult] = useState<ClientResult | null>(searchUIState?.clientResult || null)
  const [produitResult, setProduitResult] = useState<any>(searchUIState?.produitResult || null)
  const [error, setError] = useState<string | null>(null)
  
  // Sauvegarder l'état UI à chaque changement
  useEffect(() => {
    searchUIState = {
      mode,
      searchTerm,
      ticketResults,
      ticketInfo,
      clientResult,
      produitResult
    }
  }, [mode, searchTerm, ticketResults, ticketInfo, clientResult, produitResult])

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

    const cacheKey = `${mode}_${searchTerm.trim()}`
    
    // Vérifier le cache
    const cached = searchCache[cacheKey]
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('✅ Recherche: Utilisation du cache', cacheKey)
      
      if (mode === 'ticket') {
        setTicketResults(cached.data.transactions)
        setTicketInfo(cached.data.info)
      } else if (mode === 'client') {
        setClientResult(cached.data)
      } else if (mode === 'produit') {
        setProduitResult(cached.data)
      }
      
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setTicketResults([])
    setTicketInfo(null)
    setClientResult(null)
    setProduitResult(null)

    try {
      const response = await fetch(`/api/search?type=${mode}&query=${encodeURIComponent(searchTerm.trim())}`)
      if (!response.ok) throw new Error(`${mode} non trouvé`)
      
      const data = await response.json()
      
      if (mode === 'ticket') {
        setTicketResults(data.results || [])
        if (data.results && data.results.length > 0) {
          const first = data.results[0]
          setTicketInfo({ 
            facture: first.facture, 
            client: { carte: first.carte, ville: first.ville }, 
            magasin: { code: first.depot, nom: `Magasin ${first.depot}`, ville: first.ville }
          })
        }
        
        // Mettre en cache
        searchCache[cacheKey] = {
          data: {
            transactions: data.results,
            info: {
              facture: data.results[0]?.facture,
              client: { carte: data.results[0]?.carte, ville: data.results[0]?.ville },
              magasin: { code: data.results[0]?.depot, nom: `Magasin ${data.results[0]?.depot}`, ville: data.results[0]?.ville }
            }
          },
          timestamp: Date.now()
        }
        
        if (!data.results || data.results.length === 0) {
          setError('Aucun ticket trouvé avec ce numéro')
        }
      } else if (mode === 'client') {
        if (!data.results || data.results.length === 0) {
          setError('Client non trouvé')
          return
        }

        const totalCA = data.results.reduce((sum: number, t: any) => sum + Number(t.ca || 0), 0)
        const nbAchats = data.results.length

        const clientData = {
          carte: searchTerm.trim(),
          ville: data.results[0]?.ville || '-',
          cp: '-',
          nom: data.clientInfo?.nom || null,
          prenom: data.clientInfo?.prenom || null,
          email: data.clientInfo?.email || null,
          telephone: data.clientInfo?.telephone || null,
          civilite: data.clientInfo?.civilite || null,
          sexe: data.clientInfo?.sexe || null,
          date_naissance: data.clientInfo?.date_naissance || null,
          date_creation: data.clientInfo?.date_creation || null,
          transactions: data.results,
          totalCA,
          nbAchats
        }
        
        setClientResult(clientData)
        
        // Mettre en cache
        searchCache[cacheKey] = {
          data: clientData,
          timestamp: Date.now()
        }
      } else {
        // Mode produit
        setProduitResult({
          produit: searchTerm.trim(),
          transactions: data.results
        })
        
        // Mettre en cache
        searchCache[cacheKey] = {
          data: {
            produit: searchTerm.trim(),
            transactions: data.results
          },
          timestamp: Date.now()
        }
        
        if (!data.results || data.results.length === 0) {
          setError('Produit non trouvé')
        }
      }
    } catch (err) {
      console.error('Erreur recherche:', err)
      setError(mode === 'ticket' ? 'Ticket non trouvé' : mode === 'client' ? 'Client non trouvé' : 'Produit non trouvé')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const switchToClientSearch = (carte: string) => {
    setMode('client')
    setSearchTerm(carte)
    setTimeout(() => {
      setLoading(true)
      setError(null)
      setTicketResults([])
      setTicketInfo(null)
      setClientResult(null)
      
      fetch(`/api/clients?carte=${carte}`)
        .then(res => res.json())
        .then(data => {
          if (!data || !data.client) {
            setError('Client non trouvé')
            return
          }
          const totalCA = data.transactions.reduce((sum: number, t: any) => sum + Number(t.ca || 0), 0)
          const nbAchats = data.transactions.length
          setClientResult({
            carte: data.client.carte,
            ville: data.client.ville,
            cp: data.client.cp,
            transactions: data.transactions,
            totalCA,
            nbAchats
          })
        })
        .catch(err => {
          console.error('Erreur recherche:', err)
          setError('Client non trouvé')
        })
        .finally(() => setLoading(false))
    }, 100)
  }

  const switchToTicketSearch = (facture: string) => {
    setMode('ticket')
    setSearchTerm(facture)
    setTimeout(() => {
      setLoading(true)
      setError(null)
      setTicketResults([])
      setTicketInfo(null)
      setClientResult(null)
      
      fetch(`/api/tickets?facture=${facture}`)
        .then(res => res.json())
        .then(data => {
          setTicketResults(data.transactions || [])
          setTicketInfo({ facture: data.facture, client: data.client, magasin: data.magasin })
          if (!data.transactions || data.transactions.length === 0) {
            setError('Aucun ticket trouvé avec ce numéro')
          }
        })
        .catch(err => {
          console.error('Erreur recherche:', err)
          setError('Ticket non trouvé')
        })
        .finally(() => setLoading(false))
    }, 100)
  }

  const switchToProduitSearch = (produit: string) => {
    setMode('produit')
    setSearchTerm(produit)
    setTimeout(() => {
      setLoading(true)
      setError(null)
      setTicketResults([])
      setTicketInfo(null)
      setClientResult(null)
      setProduitResult(null)
      
      fetch(`/api/produits?produit=${produit}`)
        .then(res => res.json())
        .then(data => {
          setProduitResult(data)
          if (!data || !data.produit) {
            setError('Produit non trouvé')
          }
        })
        .catch(err => {
          console.error('Erreur recherche:', err)
          setError('Produit non trouvé')
        })
        .finally(() => setLoading(false))
    }, 100)
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
        <button
          onClick={() => {
            setMode('produit')
            setSearchTerm('')
            setTicketResults([])
            setClientResult(null)
            setProduitResult(null)
            setError(null)
          }}
          className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all ${
            mode === 'produit'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
        >
          <Package className="w-5 h-5" />
          Recherche Produit
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
                mode === 'ticket' ? '🎫 Entrez un numéro de ticket...' : mode === 'client' ? '👤 Entrez un numéro de carte...' : '📦 Entrez un code produit...'
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

      {mode === 'ticket' && ticketResults.length > 0 && ticketInfo && !loading && (
        <div className="glass rounded-3xl shadow-2xl p-8 border border-zinc-800">
          {/* En-tête du ticket */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
                <Ticket className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-gradient">Ticket #{ticketInfo.facture}</p>
                <p className="text-sm text-zinc-400 font-medium flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" />
                  {ticketResults[0] && formatDate(ticketResults[0].date)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 font-bold uppercase">Total Ticket</p>
              <p className="text-4xl font-black text-gradient">
                {formatEuro(ticketResults.reduce((sum, t) => sum + Number(t.ca), 0))}
              </p>
            </div>
          </div>

          {/* Infos client et magasin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {ticketInfo.client && (
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-all group"
                onClick={() => switchToClientSearch(ticketInfo.client.carte)}>
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-blue-400" />
                  <span className="text-xs text-zinc-400 font-bold uppercase">Client (cliquer pour voir)</span>
                </div>
                <p className="text-white font-bold text-lg group-hover:text-blue-300 transition-colors">
                  Carte: {ticketInfo.client.carte}
                </p>
                <p className="text-zinc-400 text-sm">{ticketInfo.client.ville}</p>
              </div>
            )}
            {ticketInfo.magasin && (
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Store className="w-5 h-5 text-purple-400" />
                  <span className="text-xs text-zinc-400 font-bold uppercase">Magasin</span>
                </div>
                <p className="text-white font-bold text-lg">{ticketInfo.magasin.nom}</p>
                <p className="text-zinc-400 text-sm">{ticketInfo.magasin.ville}</p>
              </div>
            )}
          </div>

          {/* Lignes du ticket */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-5 h-5 text-emerald-400" />
              <h4 className="text-lg font-bold text-white">Articles ({ticketResults.length})</h4>
            </div>
            <div className="space-y-2">
              {ticketResults.map((transaction, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white">
                        {transaction.famille || 'N/A'}
                        {transaction.sous_famille && ` - ${transaction.sous_famille}`}
                      </p>
                      <p className="text-sm text-zinc-400 mt-1">
                        Produit:{' '}
                        <button
                          onClick={() => switchToProduitSearch(transaction.produit)}
                          className="text-blue-400 hover:text-blue-300 font-medium underline decoration-dotted hover:decoration-solid transition-all"
                        >
                          {transaction.produit}
                        </button>
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-zinc-500">Qté</p>
                        <p className="font-bold text-white">{transaction.quantite}</p>
                      </div>
                      <div className="min-w-[100px]">
                        <p className="text-xs text-zinc-500">Total</p>
                        <p className="font-bold text-emerald-400 text-lg">{formatEuro(transaction.ca)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <h3 className="text-2xl font-black text-gradient">
                {clientResult.nom && clientResult.prenom ? `${clientResult.prenom} ${clientResult.nom}` : `Carte: ${clientResult.carte}`}
              </h3>
              <p className="text-sm text-zinc-400 font-medium mt-1">
                🎴 Carte: {clientResult.carte}
                {clientResult.sexe && (clientResult.sexe === 'H' ? ' • 👨 Homme' : clientResult.sexe === 'F' ? ' • 👩 Femme' : '')}
              </p>
            </div>
          </div>

          {/* Infos client détaillées */}
          {(clientResult.email || clientResult.telephone || clientResult.ville) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {clientResult.email && (
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                  <p className="text-xs text-zinc-400 font-bold uppercase mb-1">📧 Email</p>
                  <p className="text-white font-medium break-all">{clientResult.email}</p>
                </div>
              )}
              {clientResult.telephone && (
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                  <p className="text-xs text-zinc-400 font-bold uppercase mb-1">📱 Téléphone</p>
                  <p className="text-white font-medium">{clientResult.telephone}</p>
                </div>
              )}
              {clientResult.ville && (
                <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                  <p className="text-xs text-zinc-400 font-bold uppercase mb-1">📍 Localisation</p>
                  <p className="text-white font-medium">{clientResult.ville} - {clientResult.cp}</p>
                </div>
              )}
            </div>
          )}

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
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          onClick={() => switchToTicketSearch(transaction.facture)}
                          className="text-blue-400 hover:text-blue-300 font-bold underline decoration-dotted hover:decoration-solid transition-all"
                        >
                          {transaction.facture}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">
                        <div className="text-xs">
                          <div className="text-white font-bold">{transaction.famille || 'N/A'}</div>
                          {transaction.sous_famille && (
                            <div className="text-zinc-500">{transaction.sous_famille}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">
                        {transaction.depot}
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

      {mode === 'produit' && produitResult && produitResult.transactions && produitResult.transactions.length > 0 && !loading && (
        <div className="glass rounded-3xl shadow-2xl p-8 border border-zinc-800">
          {/* En-tête produit */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-black text-gradient">Produit {produitResult.produit}</h3>
              {produitResult.transactions[0] && (
                <p className="text-sm text-zinc-400 font-medium mt-1">
                  {produitResult.transactions[0].famille}
                  {produitResult.transactions[0].sous_famille && ` › ${produitResult.transactions[0].sous_famille}`}
                </p>
              )}
            </div>
          </div>

          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
              <p className="text-sm text-zinc-400 font-bold uppercase mb-2">CA Total</p>
              <p className="text-3xl font-black text-gradient">
                {formatEuro(produitResult.transactions.reduce((sum: number, t: any) => sum + Number(t.ca || 0), 0))}
              </p>
            </div>
            <div className="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
              <p className="text-sm text-zinc-400 font-bold uppercase mb-2">Volume Total</p>
              <p className="text-3xl font-black text-gradient">
                {produitResult.transactions.reduce((sum: number, t: any) => sum + Number(t.quantite || 0), 0).toFixed(0)}
              </p>
            </div>
            <div className="bg-purple-500/10 rounded-2xl p-6 border border-purple-500/20">
              <p className="text-sm text-zinc-400 font-bold uppercase mb-2">Nb Ventes</p>
              <p className="text-3xl font-black text-gradient">{produitResult.transactions.length}</p>
            </div>
          </div>

          {/* Dernières transactions */}
          <div>
            <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-400" />
              Transactions
            </h4>
            <div className="max-h-96 overflow-y-auto rounded-xl">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase">Magasin</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase">Qté</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {produitResult.transactions.map((trans: any, idx: number) => (
                    <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">{formatDate(trans.date)}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          onClick={() => switchToTicketSearch(trans.facture)}
                          className="text-blue-400 hover:text-blue-300 font-bold underline decoration-dotted hover:decoration-solid transition-all"
                        >
                          {trans.facture}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          onClick={() => switchToClientSearch(trans.carte)}
                          className="text-blue-400 hover:text-blue-300 font-medium underline decoration-dotted hover:decoration-solid transition-all"
                        >
                          {trans.carte}
                        </button>
                        <div className="text-xs text-zinc-500">{trans.ville}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-300">{trans.depot}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-white">{trans.quantite}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-emerald-400">
                        {formatEuro(trans.ca)}
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
