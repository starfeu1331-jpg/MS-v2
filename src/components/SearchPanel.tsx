import { useState, useEffect } from 'react'
import { Search, Ticket, User, Mail, Package } from 'lucide-react'
import { calculateClientRFM } from '../utils/rfmCalculator'
import { getMainContact, getProductDetails } from '../services/decorAPI'

interface SearchPanelProps {
  data: any
  initialSearch?: string
}

interface ContactInfo {
  nom?: string
  prenom?: string
  email?: string
  loading?: boolean
}

interface TicketInfo {
  ticket: string
  date: string
  ca: number
  carte: string
  ville: string
  cp: string
  magasin: string
  famille: string
  sousFamille: string
  produit: string
  ca_total?: number
  achats?: any[]
  productInfo?: {
    nom_pro?: string
    nom_pr2?: string
    refext?: string
    px_refv?: number
    loading?: boolean
  }
}

export default function SearchPanel({ data, initialSearch }: SearchPanelProps) {
  const [mode, setMode] = useState<'ticket' | 'client'>('client')
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<TicketInfo[]>([])
  const [contactInfo, setContactInfo] = useState<ContactInfo>({})
  
  // Auto-search when initialSearch is provided
  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch)
      setMode('client')
      const client = data.allClients.get(initialSearch)
      setResults(client ? [client] : [])
      
      // Fetch contact info from API
      if (client) {
        fetchContactInfo(initialSearch)
      }
    }
  }, [initialSearch, data.allClients])
  
  const fetchContactInfo = async (carte: string) => {
    setContactInfo({ loading: true })
    try {
      const contact = await getMainContact(carte)
      if (contact) {
        setContactInfo({
          nom: contact.nom_cor,
          prenom: contact.prenom_cor,
          email: contact.internet,
          loading: false
        })
      } else {
        setContactInfo({ loading: false })
      }
    } catch (error) {
      console.error('Erreur récupération contact:', error)
      setContactInfo({ loading: false })
    }
  }

  const fetchProductInfo = async (ticket: TicketInfo, index: number) => {
    if (!ticket.produit || ticket.produit === '-' || ticket.produit === 'N/A') {
      return
    }

    // Marquer le produit comme en chargement
    setResults(prev => {
      const newResults = [...prev]
      newResults[index] = {
        ...newResults[index],
        productInfo: { loading: true }
      }
      return newResults
    })

    try {
      const productInfo = await getProductDetails(ticket.produit)
      
      setResults(prev => {
        const newResults = [...prev]
        newResults[index] = {
          ...newResults[index],
          productInfo: productInfo ? {
            nom_pro: productInfo.nom_pro,
            nom_pr2: productInfo.nom_pr2,
            refext: productInfo.refext,
            px_refv: productInfo.px_refv,
            loading: false
          } : { loading: false }
        }
        return newResults
      })
    } catch (error) {
      console.error('Erreur récupération produit:', error)
      setResults(prev => {
        const newResults = [...prev]
        newResults[index] = {
          ...newResults[index],
          productInfo: { loading: false }
        }
        return newResults
      })
    }
  }
  
  if (!data || !data.allTickets) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }

  const formatEuro = (value: number) =>
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`

  const handleSearch = () => {
    if (!searchTerm.trim()) return

    if (mode === 'ticket') {
      const filtered = data.allTickets.filter((t: any) =>
        t.ticket.toString().includes(searchTerm)
      )
      const limitedResults = filtered.slice(0, 100)
      setResults(limitedResults)
      setContactInfo({})
      
      // Charger les infos produits pour chaque ticket
      limitedResults.forEach((ticket: TicketInfo, index: number) => {
        fetchProductInfo(ticket, index)
      })
    } else {
      const client = data.allClients.get(searchTerm)
      setResults(client ? [client] : [])
      
      // Fetch contact info from API for client search
      if (client) {
        fetchContactInfo(searchTerm)
      } else {
        setContactInfo({})
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-8 relative">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float"></div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-2xl p-2 inline-flex gap-2 shadow-lg border border-zinc-800">
        <button
          onClick={() => {
            setMode('ticket')
            setSearchTerm('')
            setResults([])
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
            setResults([])
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

      {/* Search Box */}
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
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black rounded-xl hover:shadow-2xl hover:shadow-blue-500/20 transition-all shadow-lg group transform hover:scale-105"
          >
            <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6">
          {mode === 'ticket' ? (
            <div>
              <div className="glass rounded-2xl p-4 mb-6 inline-flex items-center gap-3 shadow-lg border border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-black">
                  {results.length}
                </div>
                <p className="text-sm font-bold text-zinc-300">
                  résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-4">
                {results.map((ticket: TicketInfo, idx: number) => (
                  <div
                    key={idx}
                    className="glass rounded-2xl shadow-xl p-6 card-hover border-l-4 border-blue-500 group border border-zinc-800"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                          <Ticket className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="text-xl font-black text-gradient">#{ticket.ticket}</h4>
                      </div>
                      <span className="text-2xl font-black text-gradient">{formatEuro(ticket.ca)}</span>
                    </div>
                    
                    {/* Infos produit enrichies de l'API */}
                    {ticket.productInfo?.loading ? (
                      <div className="mb-4 bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500"></div>
                          <p className="text-xs text-zinc-400">Chargement infos produit...</p>
                        </div>
                      </div>
                    ) : ticket.productInfo?.nom_pro ? (
                      <div className="mb-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Package className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-white text-lg">
                              {ticket.productInfo.nom_pro}
                              {ticket.productInfo.nom_pr2 && (
                                <span className="text-purple-400 ml-2">• {ticket.productInfo.nom_pr2}</span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm">
                              {ticket.productInfo.refext && (
                                <span className="text-zinc-400">
                                  Réf: <span className="text-cyan-400 font-bold">{ticket.productInfo.refext}</span>
                                </span>
                              )}
                              {ticket.productInfo.px_refv && (
                                <span className="text-zinc-400">
                                  Prix réf: <span className="text-emerald-400 font-bold">{formatEuro(ticket.productInfo.px_refv)}</span>
                                </span>
                              )}
                              <span className="text-zinc-400">
                                Code: <span className="text-blue-400 font-bold">{ticket.produit}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : ticket.produit && ticket.produit !== '-' ? (
                      <div className="mb-4 bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <p className="text-sm text-zinc-400">
                          Code produit: <span className="text-white font-bold">{ticket.produit}</span>
                        </p>
                      </div>
                    ) : null}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Date</span>
                        <p className="font-bold text-white mt-1">{ticket.date}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Client</span>
                        <p className="font-bold text-white mt-1">{ticket.carte}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Magasin</span>
                        <p className="font-bold text-white mt-1">{ticket.magasin}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Ville</span>
                        <p className="font-bold text-white mt-1">{ticket.ville}</p>
                      </div>
                      <div className="col-span-2 bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                        <span className="text-xs text-zinc-400 font-bold uppercase">Famille</span>
                        <p className="font-bold text-blue-400 mt-1">{ticket.famille}</p>
                      </div>
                      <div className="col-span-2 bg-cyan-500/10 rounded-xl p-3 border border-cyan-500/20">
                        <span className="text-xs text-zinc-400 font-bold uppercase">Sous-famille</span>
                        <p className="font-bold text-cyan-400 mt-1">{ticket.sousFamille}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl shadow-2xl p-8 border border-zinc-800">
              {(() => {
                const clientData = results[0] as any
                const allClientsMap = data.allClients as Map<string, any>
                const rfmData = calculateClientRFM(clientData, allClientsMap)
                return (
                  <>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-gradient">Carte: {clientData.carte}</h3>
                        
                        {/* Contact info from API */}
                        {contactInfo.loading ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                            <p className="text-xs text-zinc-500">Chargement des informations...</p>
                          </div>
                        ) : (contactInfo.nom || contactInfo.prenom) ? (
                          <div className="mt-2 space-y-1">
                            <p className="text-base font-bold text-white">
                              {contactInfo.prenom} {contactInfo.nom}
                            </p>
                            {contactInfo.email && (
                              <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <Mail className="w-4 h-4" />
                                <a href={`mailto:${contactInfo.email}`} className="hover:text-blue-400 transition-colors">
                                  {contactInfo.email}
                                </a>
                              </div>
                            )}
                          </div>
                        ) : null}
                        
                        <p className="text-sm text-zinc-400 font-medium mt-1">
                          📍 {clientData.ville} - {clientData.cp}
                        </p>
                      </div>
                      {rfmData && (
                        <div className={`px-4 py-2 rounded-xl bg-${rfmData.color}-500/20 border border-${rfmData.color}-500/30 flex items-center gap-2`}>
                          <span className="text-xl">{rfmData.icon}</span>
                          <div>
                            <p className={`text-sm font-black text-${rfmData.color}-400`}>{rfmData.segment}</p>
                            <p className="text-xs text-zinc-400 font-bold">R:{rfmData.R} F:{rfmData.F} M:{rfmData.M}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
                        <p className="text-sm text-zinc-400 font-bold uppercase mb-2">💰 CA Total</p>
                        <p className="text-3xl font-black text-gradient">
                          {formatEuro(clientData.ca_total)}
                        </p>
                      </div>
                      <div className="bg-cyan-500/10 rounded-2xl p-6 border border-cyan-500/20">
                        <p className="text-sm text-zinc-400 font-bold uppercase mb-2">🛒 Nb Achats</p>
                        <p className="text-3xl font-black text-gradient">{clientData.achats.length}</p>
                      </div>
                    </div>
                  </>
                )
              })()}

              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <h4 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                  Historique des achats
                </h4>
                <div className="max-h-96 overflow-y-auto rounded-xl">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Ticket</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Produits</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Magasin</th>
                        <th className="px-4 py-3 text-right text-xs font-black uppercase">CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(results[0].achats || []).map((achat: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-zinc-300">{achat.date}</td>
                          <td className="px-4 py-3 text-sm font-medium text-zinc-300">{achat.ticket}</td>
                          <td className="px-4 py-3 text-sm font-medium text-zinc-300">
                            {achat.produits ? (
                              <div className="text-xs">
                                {achat.produits.length} article{achat.produits.length > 1 ? 's' : ''}
                                <div className="text-zinc-500 mt-1">
                                  {Array.from(new Set(achat.produits.map((p: any) => p.famille))).join(', ')}
                                </div>
                              </div>
                            ) : (
                              achat.famille || '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-zinc-300">{achat.magasin}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-400">
                            {formatEuro(achat.ca)}
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
      )}

      {results.length === 0 && searchTerm && (
        <div className="glass rounded-3xl p-12 text-center shadow-xl border border-zinc-800">
          <div className="inline-flex p-6 bg-zinc-900/50 rounded-full mb-6 border border-zinc-800">
            <Search className="w-16 h-16 text-zinc-600" />
          </div>
          <p className="text-2xl font-bold text-zinc-400">Aucun résultat trouvé</p>
          <p className="text-sm text-zinc-500 mt-2">Essayez avec un autre numéro</p>
        </div>
      )}
    </div>
  )
}
