import { useState, useCallback } from 'react'
import { Search, X, SlidersHorizontal, User, Ticket, Package, ChevronRight, ArrowLeft, ChevronDown, ChevronUp, Layers, TrendingUp, ShoppingCart, MapPin, Calendar, Phone, Mail, Star, BarChart3 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface SearchFilters {
  nom?: string
  prenom?: string
  adresse?: string
  carte?: string
  ville?: string
  cp?: string
  email?: string
  telephone?: string
  facture?: string
  dateDebut?: string
  dateFin?: string
  montantMin?: string
  montantMax?: string
  depot?: string
  produit?: string
}

interface SearchResult {
  type: 'client' | 'ticket' | 'produit' | 'categorie'
  data: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  famille?: string | null
  sous_famille?: string | null
  sous_sous_famille?: string | null
  subcategories?: any[]
  stats?: any
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function clientDisplayName(client: any) {
  if (client.nom && client.prenom) return `${client.prenom} ${client.nom}`
  if (client.nom) return client.nom
  if (client.prenom) return client.prenom
  return `Carte ${client.carte}`
}

function clientInitial(client: any) {
  if (client.nom) return client.nom[0].toUpperCase()
  if (client.prenom) return client.prenom[0].toUpperCase()
  return '?'
}

function formatCurrency(value: number | string) {
  return Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' \u20ac'
}

function formatDate(d: string) {
  if (!d) return '\u2013'
  return new Date(d).toLocaleDateString('fr-FR')
}

const segmentColors: Record<string, string> = {
  'Champion': 'from-yellow-500 to-amber-600',
  'Fid\u00e8le': 'from-green-500 to-emerald-600',
  'Prometteur': 'from-blue-500 to-cyan-600',
  '\u00c0 d\u00e9velopper': 'from-sky-500 to-blue-600',
  'Occasionnel': 'from-zinc-500 to-zinc-600',
  '\u00c0 risque': 'from-orange-500 to-red-500',
  'Perdu': 'from-red-600 to-red-800',
  'Inactif': 'from-zinc-600 to-zinc-800',
  'Inconnu': 'from-zinc-600 to-zinc-800',
}

const segmentEmoji: Record<string, string> = {
  'Champion': '\ud83c\udfc6',
  'Fid\u00e8le': '\ud83d\udc9a',
  'Prometteur': '\ud83c\udf31',
  '\u00c0 d\u00e9velopper': '\ud83d\udcc8',
  'Occasionnel': '\ud83d\udd04',
  '\u00c0 risque': '\u26a0\ufe0f',
  'Perdu': '\ud83d\udca4',
  'Inactif': '\u274c',
  'Inconnu': '\u2753',
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function SearchPanelV3() {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    clients: false, tickets: false, produits: false
  })
  const [filters, setFilters] = useState<SearchFilters>({})
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [selectedProduit, setSelectedProduit] = useState<any>(null)
  const [produitTickets, setProduitTickets] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState<{ famille?: string; sous_famille?: string; sous_sous_famille?: string }>({})

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSearch = useCallback(async (pageOverride?: number) => {
    setLoading(true)
    setFiltersCollapsed(true)
    try {
      const params = new URLSearchParams()
      if (query) params.append('query', query)
      params.append('page', (pageOverride ?? currentPage).toString())
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const response = await fetch(`/api/search-v3?${params}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }, [query, filters, currentPage])

  const resetFilters = () => {
    setFilters({})
    setQuery('')
    setResults(null)
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(null)
    setProduitTickets([])
    setCurrentPage(1)
    setFiltersCollapsed(false)
    setCategoryBreadcrumb({})
  }

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(1)
    }
  }

  const viewClientTickets = async (client: any) => {
    setSelectedTicket(null)
    setSelectedProduit(null)
    setSelectedClient({ ...client, _loading: true })
    try {
      const response = await fetch(`/api/clients/${client.carte}/tickets`)
      const data = await response.json()
      setSelectedClient({
        ...client,
        ...data.client,
        tickets: data.tickets || [],
        stats: data.stats,
        topProduits: data.topProduits,
        depots: data.depots,
        rfm: data.rfm
      })
    } catch {
      setSelectedClient({ ...client, tickets: [], _error: true })
    }
  }

  const viewTicketDetails = async (ticket: any) => {
    setSelectedTicket(ticket)
    const response = await fetch(`/api/tickets/${ticket.facture}/transactions`)
    const data = await response.json()
    setSelectedTicket({ ...data.ticket, client: data.client, transactions: data.transactions || [] })
  }

  const backToResults = () => {
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(null)
  }

  const backToClientTickets = () => {
    setSelectedTicket(null)
  }

  const viewProduitDetails = async (produit: any) => {
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(produit)
    setProduitTickets([])
    const response = await fetch(`/api/search-v3?produit_id=${encodeURIComponent(produit.id)}&pageSize=100`)
    const data = await response.json()
    setProduitTickets(data.data || [])
    setSelectedProduit({ ...produit, ...(data.produit || {}), total_tickets: data.total })
  }

  const searchFor = async (value: string) => {
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(null)
    setProduitTickets([])
    setQuery(value)
    setFiltersCollapsed(true)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('query', value)
      params.append('page', '1')
      const response = await fetch(`/api/search-v3?${params}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }

  const browseCategory = async (
    opts: { famille?: string; sous_famille?: string; sous_sous_famille?: string },
    pageOverride?: number
  ) => {
    setLoading(true)
    setCategoryBreadcrumb(opts)
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(null)
    setProduitTickets([])
    try {
      const params = new URLSearchParams()
      if (opts.famille) params.append('famille', opts.famille)
      if (opts.sous_famille) params.append('sous_famille', opts.sous_famille)
      if (opts.sous_sous_famille) params.append('sous_sous_famille', opts.sous_sous_famille)
      params.append('page', (pageOverride || 1).toString())
      params.append('pageSize', '20')
      const response = await fetch(`/api/search-v3?${params}`)
      const data = await response.json()
      setResults(data)
    } catch (e) {
      console.error('Category browse error:', e)
    } finally {
      setLoading(false)
    }
  }

  // StatCard component
  const StatCard = ({ icon: Icon, label, value, color = 'text-white', sub }: any) => (
    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center text-center">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )

  // FilterInput with Enter support
  const FilterInput = ({ placeholder, filterKey, type = 'text', label }: {
    placeholder: string
    filterKey: keyof SearchFilters
    type?: string
    label?: string
  }) => (
    <>
      {label && <label className="block text-xs text-zinc-500">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={filters[filterKey] || ''}
        onChange={(e) => updateFilter(filterKey, e.target.value)}
        onKeyDown={handleFilterKeyDown}
        className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-zinc-600"
      />
    </>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // VUE DETAIL PRODUIT
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedProduit && !selectedTicket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button onClick={backToResults} className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              <span className="text-white font-bold">{selectedProduit.designation || selectedProduit.id}</span>
              {selectedProduit.designation && (
                <span className="text-zinc-500 text-sm font-mono">({selectedProduit.id})</span>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Produit</h3>
              <p className="text-xl font-black text-white mb-1">{selectedProduit.designation || selectedProduit.id}</p>
              <p className="text-sm text-zinc-500 font-mono mb-2">{selectedProduit.id}</p>
              {selectedProduit.reference_interne && (
                <p className="text-xs text-zinc-500">R&eacute;f: {selectedProduit.reference_interne}</p>
              )}
              {selectedProduit.famille && (
                <div className="flex flex-wrap items-center gap-1 mt-3">
                  <span
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs cursor-pointer hover:bg-purple-500/30 transition-colors"
                    onClick={() => browseCategory({ famille: selectedProduit.famille })}
                  >
                    {selectedProduit.famille}
                  </span>
                  {selectedProduit.sous_famille && (
                    <>
                      <ChevronRight className="w-3 h-3 text-zinc-600" />
                      <span
                        className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded-lg text-xs cursor-pointer hover:bg-violet-500/30 transition-colors"
                        onClick={() => browseCategory({ famille: selectedProduit.famille, sous_famille: selectedProduit.sous_famille })}
                      >
                        {selectedProduit.sous_famille}
                      </span>
                    </>
                  )}
                  {selectedProduit.sous_sous_famille && (
                    <>
                      <ChevronRight className="w-3 h-3 text-zinc-600" />
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs">
                        {selectedProduit.sous_sous_famille}
                      </span>
                    </>
                  )}
                  {selectedProduit.sous_sous_sous_famille && (
                    <>
                      <ChevronRight className="w-3 h-3 text-zinc-600" />
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs">
                        {selectedProduit.sous_sous_sous_famille}
                      </span>
                    </>
                  )}
                </div>
              )}
              {selectedProduit.produit_web && (
                <p className="text-xs text-emerald-400 mt-2">Disponible en ligne</p>
              )}
            </div>
            <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Statistiques</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-black text-green-400">{formatCurrency(selectedProduit.ca_total)}</p>
                  <p className="text-xs text-zinc-500">CA total</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-blue-400">{selectedProduit.nb_tickets || selectedProduit.total_tickets || 0}</p>
                  <p className="text-xs text-zinc-500">Tickets</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-purple-400">{selectedProduit.quantite_totale || 0}</p>
                  <p className="text-xs text-zinc-500">Qt&eacute; vendue</p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-black text-gradient mb-4">
            Tickets contenant ce produit ({produitTickets.length})
          </h2>
          <div className="space-y-3">
            {produitTickets.map((ticket: any, idx: number) => (
              <div
                key={idx}
                onClick={() => viewTicketDetails(ticket)}
                className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-blue-500 cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                      {ticket.facture}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {formatDate(ticket.date)}{ticket.depot && ` \u2022 ${ticket.depot}`}
                    </p>
                    {(ticket.nom || ticket.prenom) && (
                      <p
                        className="text-xs text-zinc-500 hover:text-blue-400 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          viewClientTickets({ carte: ticket.carte, nom: ticket.nom, prenom: ticket.prenom, ville: ticket.ville })
                        }}
                      >
                        {ticket.prenom} {ticket.nom}{ticket.ville ? ` \u2022 ${ticket.ville}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-green-400">{Number(ticket.ca || 0).toFixed(2)}\u20ac</p>
                      <p className="text-xs text-zinc-500">qt&eacute; : {ticket.quantite}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {produitTickets.length === 0 && (
            <p className="text-center text-zinc-500 py-12">Chargement...</p>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VUE DETAIL TICKET
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button onClick={backToClientTickets} className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-400" />
              <span className="text-white font-bold">{selectedTicket.facture}</span>
              <span className="text-zinc-500">{'\u2192'} Ticket du {formatDate(selectedTicket.date)}</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
          <div className="flex flex-col lg:flex-row gap-6 mb-6">
            <div className="flex-1 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Ticket</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-zinc-500">Date :</span>{' '}
                  <span className="text-white">{formatDate(selectedTicket.date)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">D&eacute;p&ocirc;t :</span>{' '}
                  <span className="text-white">{selectedTicket.depot || '\u2013'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">CA total :</span>{' '}
                  <span className="font-bold text-green-400">{Number(selectedTicket.ca_total || 0).toFixed(2)}\u20ac</span>
                </div>
                <div>
                  <span className="text-zinc-500">Articles :</span>{' '}
                  <span className="text-white">{selectedTicket.quantite_totale || 0}</span>
                </div>
              </div>
            </div>
            {selectedTicket.client && (
              <div
                className="flex-1 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 hover:border-blue-500 cursor-pointer transition-all group"
                onClick={() => viewClientTickets(selectedTicket.client)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Client</h3>
                  <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Voir le profil {'\u2192'}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                    {selectedTicket.client.civilite} {clientDisplayName(selectedTicket.client)}
                  </p>
                  <p className="text-zinc-400">
                    Carte {selectedTicket.client.carte} {'\u2022'} {selectedTicket.client.ville || ''}
                    {selectedTicket.client.cp ? ` (${selectedTicket.client.cp})` : ''}
                  </p>
                  {selectedTicket.client.email && (
                    <p className="text-zinc-500 text-xs">{selectedTicket.client.email}</p>
                  )}
                  {selectedTicket.client.telephone && (
                    <p className="text-zinc-500 text-xs">T&eacute;l: {selectedTicket.client.telephone}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <h2 className="text-xl font-black text-gradient mb-4">
            Lignes du ticket ({selectedTicket.transactions?.length || 0})
          </h2>
          <div className="space-y-4">
            {selectedTicket.transactions?.map((trans: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors"
                      onClick={() => viewProduitDetails({
                        id: trans.produit,
                        designation: trans.produit_nom || trans.produit,
                        famille: trans.famille,
                        sous_famille: trans.sous_famille,
                        sous_sous_famille: trans.sous_sous_famille
                      })}
                    >
                      {trans.produit_nom || trans.produit}
                    </p>
                    {trans.produit_nom && trans.produit_nom !== trans.produit && (
                      <p className="text-xs text-zinc-500 font-mono">{trans.produit}</p>
                    )}
                    {trans.famille && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span
                          className="text-xs text-zinc-400 hover:text-purple-400 cursor-pointer transition-colors"
                          onClick={() => browseCategory({ famille: trans.famille })}
                        >
                          {trans.famille}
                        </span>
                        {trans.sous_famille && (
                          <>
                            <span className="text-zinc-600 text-xs">{'\u203a'}</span>
                            <span
                              className="text-xs text-zinc-500 hover:text-purple-400 cursor-pointer transition-colors"
                              onClick={() => browseCategory({ famille: trans.famille, sous_famille: trans.sous_famille })}
                            >
                              {trans.sous_famille}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="font-bold text-green-400">{Number(trans.ca || 0).toFixed(2)}\u20ac</p>
                    <p className="text-sm text-zinc-500">Qt&eacute; : {trans.quantite}</p>
                    {trans.prix && (
                      <p className="text-xs text-zinc-600">PU : {Number(trans.prix).toFixed(2)}\u20ac</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VUE DETAIL CLIENT (enrichie)
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedClient) {
    const stats = selectedClient.stats || {}
    const rfm = selectedClient.rfm || {}
    const segment = rfm.segment || 'Inconnu'
    const gradientClass = segmentColors[segment] || segmentColors['Inconnu']

    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        {/* Header */}
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button onClick={backToResults} className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold`}>
                {clientInitial(selectedClient)}
              </div>
              <div>
                <span className="text-white font-bold text-lg">{clientDisplayName(selectedClient)}</span>
                <span className="text-zinc-500 ml-2 text-sm">Carte {selectedClient.carte}</span>
              </div>
            </div>
            <button
              onClick={() => { setSelectedClient(null); setFiltersCollapsed(false) }}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              Nouvelle recherche
            </button>
          </div>
        </div>

        {/* Profile + Segment + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Info */}
          <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Informations
            </h3>
            <div className="space-y-3 text-sm">
              {(selectedClient.nom || selectedClient.prenom) && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-white font-bold">
                      {selectedClient.civilite} {clientDisplayName(selectedClient)}
                    </p>
                    {selectedClient.sexe && (
                      <p className="text-zinc-500 text-xs">
                        {selectedClient.sexe === 'H' ? 'Homme' : selectedClient.sexe === 'F' ? 'Femme' : selectedClient.sexe}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {selectedClient.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-white text-sm break-all">{selectedClient.email}</p>
                </div>
              )}
              {selectedClient.telephone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-white">{selectedClient.telephone}</p>
                </div>
              )}
              {(selectedClient.adresse || selectedClient.ville) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                  <div>
                    {selectedClient.adresse && <p className="text-white text-sm">{selectedClient.adresse}</p>}
                    {selectedClient.adresse_2 && <p className="text-white text-sm">{selectedClient.adresse_2}</p>}
                    {selectedClient.adresse_4 && <p className="text-white text-sm">{selectedClient.adresse_4}</p>}
                    {selectedClient.ville && (
                      <p
                        className="text-zinc-400 text-sm cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => searchFor(selectedClient.ville)}
                      >
                        {selectedClient.ville}{selectedClient.cp ? ` (${selectedClient.cp})` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {selectedClient.date_naissance && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-zinc-400">N&eacute;(e) le {formatDate(selectedClient.date_naissance)}</p>
                </div>
              )}
              {selectedClient.date_creation && (
                <div className="flex items-center gap-3">
                  <Star className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-zinc-400">Client depuis le {formatDate(selectedClient.date_creation)}</p>
                </div>
              )}
            </div>
          </div>

          {/* RFM Segment */}
          <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Segmentation RFM
            </h3>
            <div className={`rounded-2xl p-4 bg-gradient-to-br ${gradientClass} mb-4`}>
              <p className="text-3xl mb-1">{segmentEmoji[segment]}</p>
              <p className="text-white font-black text-xl">{segment}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-zinc-900/50 p-3 rounded-xl">
                <p className="text-lg font-black text-blue-400">{rfm.recency ?? '\u2013'}</p>
                <p className="text-xs text-zinc-500">R&eacute;cence (j)</p>
              </div>
              <div className="bg-zinc-900/50 p-3 rounded-xl">
                <p className="text-lg font-black text-green-400">{rfm.frequency ?? '\u2013'}</p>
                <p className="text-xs text-zinc-500">Fr&eacute;quence</p>
              </div>
              <div className="bg-zinc-900/50 p-3 rounded-xl">
                <p className="text-lg font-black text-amber-400">{formatCurrency(rfm.monetary)}</p>
                <p className="text-xs text-zinc-500">Montant</p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Indicateurs
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={ShoppingCart} label="CA Total" value={formatCurrency(stats.ca_total)} color="text-green-400" />
              <StatCard icon={Ticket} label="Tickets" value={stats.nb_tickets || 0} color="text-blue-400" />
              <StatCard icon={TrendingUp} label="Panier moyen" value={formatCurrency(stats.panier_moyen)} color="text-amber-400" />
              <StatCard
                icon={Calendar}
                label="Derni\u00e8re visite"
                value={stats.derniere_visite ? `${stats.jours_depuis_dernier}j` : '\u2013'}
                color="text-purple-400"
                sub={stats.derniere_visite ? formatDate(stats.derniere_visite) : undefined}
              />
            </div>
            {stats.depots_frequentes && (
              <div className="mt-3 text-xs text-zinc-500">
                <span className="text-zinc-400 font-bold">D&eacute;p&ocirc;ts :</span> {stats.depots_frequentes}
              </div>
            )}
          </div>
        </div>

        {/* Top produits + Depots */}
        {(selectedClient.topProduits?.length > 0 || selectedClient.depots?.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {selectedClient.topProduits?.length > 0 && (
              <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Top produits achet&eacute;s
                </h3>
                <div className="space-y-2">
                  {selectedClient.topProduits.map((p: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => viewProduitDetails({ id: p.id, designation: p.nom, famille: p.famille })}
                      className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-purple-500 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-zinc-600 font-mono w-5">#{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate group-hover:text-purple-400 transition-colors">
                            {p.nom}
                          </p>
                          {p.famille && <p className="text-xs text-zinc-500">{p.famille}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-green-400 font-bold text-sm">{formatCurrency(p.ca)}</p>
                        <p className="text-xs text-zinc-500">
                          {p.nb_achats}{'\u00d7'} achat{p.nb_achats > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedClient.depots?.length > 0 && (
              <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Magasins fr&eacute;quent&eacute;s
                </h3>
                <div className="space-y-2">
                  {selectedClient.depots.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-xs font-bold">
                          {d.depot?.substring(0, 2) || '?'}
                        </div>
                        <span className="text-white text-sm font-bold">{d.depot}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-sm">{formatCurrency(d.ca)}</p>
                        <p className="text-xs text-zinc-500">
                          {d.nb_tickets} ticket{d.nb_tickets > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tickets */}
        <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
          <h3 className="text-lg font-black text-gradient mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5" /> Historique des tickets ({selectedClient.tickets?.length || 0})
          </h3>
          <div className="space-y-3">
            {selectedClient.tickets?.map((ticket: any, idx: number) => (
              <div
                key={idx}
                onClick={() => viewTicketDetails(ticket)}
                className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-blue-500 cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                      {ticket.facture}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {formatDate(ticket.date)} {'\u2022'} {ticket.depot || '\u2013'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-green-400">
                        {Number(ticket.ca_total || ticket.ca || 0).toFixed(2)}\u20ac
                      </p>
                      <p className="text-xs text-zinc-500">
                        {ticket.nb_lignes || ticket.quantite || 0} lignes
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedClient._loading && !selectedClient.tickets && (
            <p className="text-center text-zinc-500 py-12">Chargement...</p>
          )}
          {!selectedClient._loading && !selectedClient.tickets?.length && (
            <p className="text-center text-zinc-500 py-12">Ce client n'a aucun ticket</p>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VUE RECHERCHE PRINCIPALE
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
      {/* Search bar */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-2xl px-4 focus-within:border-blue-500 transition-colors">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(1) }}
                placeholder="Rechercher un client, ticket ou produit..."
                className="flex-1 py-3.5 bg-transparent text-white placeholder-zinc-500 focus:outline-none text-lg"
              />
            </div>
            <button
              onClick={() => handleSearch(1)}
              disabled={loading}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-blue-500/20 transition-all disabled:opacity-50 shrink-0"
            >
              {loading ? '...' : 'Rechercher'}
            </button>
            {(query || Object.keys(filters).length > 0) && (
              <button onClick={resetFilters} className="p-3.5 bg-zinc-800 rounded-2xl hover:bg-zinc-700 transition-colors shrink-0">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
        {/* SIDEBAR FILTRES */}
        <div className="lg:col-span-1">
          <div className="glass rounded-3xl shadow-2xl border border-zinc-800 sticky top-6 overflow-hidden">
            <button
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <h3 className="text-base font-black text-gradient flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filtres
                {Object.values(filters).filter(Boolean).length > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {Object.values(filters).filter(Boolean).length}
                  </span>
                )}
              </h3>
              {filtersCollapsed ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            <div className={`transition-all duration-300 ease-in-out ${filtersCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
              <div className="p-4 pt-0 space-y-3">
                <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-300 w-full text-right">
                  Tout r&eacute;initialiser
                </button>

                {/* Clients */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('clients')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" /> Clients
                    </span>
                    {openSections.clients ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                  {openSections.clients && (
                    <div className="p-3 space-y-2 bg-zinc-900/30">
                      <FilterInput placeholder="Nom" filterKey="nom" />
                      <FilterInput placeholder="Pr&eacute;nom" filterKey="prenom" />
                      <FilterInput placeholder="Email" filterKey="email" />
                      <FilterInput placeholder="T&eacute;l&eacute;phone (06 84 12...)" filterKey="telephone" />
                      <FilterInput placeholder="Adresse" filterKey="adresse" />
                      <FilterInput placeholder="N&deg; Carte" filterKey="carte" />
                      <FilterInput placeholder="Ville" filterKey="ville" />
                      <FilterInput placeholder="Code postal" filterKey="cp" />
                    </div>
                  )}
                </div>

                {/* Tickets */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('tickets')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-green-400" /> Tickets
                    </span>
                    {openSections.tickets ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                  {openSections.tickets && (
                    <div className="p-3 space-y-2 bg-zinc-900/30">
                      <FilterInput placeholder="N&deg; Facture" filterKey="facture" />
                      <FilterInput placeholder="" filterKey="dateDebut" type="date" label="Date d&eacute;but" />
                      <FilterInput placeholder="" filterKey="dateFin" type="date" label="Date fin" />
                      <FilterInput placeholder="D&eacute;p&ocirc;t" filterKey="depot" />
                      <div className="grid grid-cols-2 gap-2">
                        <FilterInput placeholder="\u20ac min" filterKey="montantMin" type="number" />
                        <FilterInput placeholder="\u20ac max" filterKey="montantMax" type="number" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Produits */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('produits')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-400" /> Produits
                    </span>
                    {openSections.produits ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                  {openSections.produits && (
                    <div className="p-3 space-y-2 bg-zinc-900/30">
                      <FilterInput placeholder="Code, d&eacute;signation ou famille" filterKey="produit" />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSearch(1)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors text-sm"
                >
                  Appliquer les filtres
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RESULTATS */}
        <div className="lg:col-span-4">
          <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
            {!results ? (
              <div className="text-center py-16">
                <Search className="w-20 h-20 text-zinc-700 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-gradient mb-3">Recherchez dans votre base de donn&eacute;es</h2>
                <p className="text-zinc-400 text-lg mb-6">Utilisez la barre de recherche ou les filtres pour commencer</p>
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 flex-wrap">
                  <span>Recherchez par :</span>
                  {['Nom', 'Pr\u00e9nom', 'Email', 'T\u00e9l\u00e9phone', 'N\u00b0 Carte', 'Ville', 'N\u00b0 Facture'].map(h => (
                    <span key={h} className="px-3 py-1 bg-zinc-800 rounded-full">{h}</span>
                  ))}
                </div>
              </div>
            ) : results.type === 'categorie' ? (
              /* VUE CATEGORIE */
              <>
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <span className="text-sm text-zinc-400 flex items-center gap-1">
                    <Layers className="w-4 h-4" /> Cat&eacute;gories
                  </span>
                  {results.famille && (
                    <>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                      <button
                        onClick={() => browseCategory({ famille: results.famille! })}
                        className={`text-sm font-bold ${results.sous_famille ? 'text-zinc-400 hover:text-white' : 'text-white'} transition-colors`}
                      >
                        {results.famille}
                      </button>
                    </>
                  )}
                  {results.sous_famille && (
                    <>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                      <button
                        onClick={() => browseCategory({ famille: results.famille!, sous_famille: results.sous_famille! })}
                        className={`text-sm font-bold ${results.sous_sous_famille ? 'text-zinc-400 hover:text-white' : 'text-white'} transition-colors`}
                      >
                        {results.sous_famille}
                      </button>
                    </>
                  )}
                  {results.sous_sous_famille && (
                    <>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                      <span className="text-sm font-bold text-white">{results.sous_sous_famille}</span>
                    </>
                  )}
                </div>

                {results.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center">
                      <p className="text-xl font-black text-green-400">{formatCurrency(results.stats.ca_total)}</p>
                      <p className="text-xs text-zinc-500">CA total</p>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center">
                      <p className="text-xl font-black text-blue-400">{results.total}</p>
                      <p className="text-xs text-zinc-500">Produits</p>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center">
                      <p className="text-xl font-black text-purple-400">{results.stats.nb_tickets || 0}</p>
                      <p className="text-xs text-zinc-500">Tickets</p>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center">
                      <p className="text-xl font-black text-amber-400">{results.stats.nb_clients || 0}</p>
                      <p className="text-xs text-zinc-500">Clients</p>
                    </div>
                  </div>
                )}

                {results.subcategories && results.subcategories.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Sous-cat&eacute;gories
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {results.subcategories.map((sub: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!results.sous_famille) {
                              browseCategory({ famille: results.famille!, sous_famille: sub.name })
                            } else {
                              browseCategory({ famille: results.famille!, sous_famille: results.sous_famille!, sous_sous_famille: sub.name })
                            }
                          }}
                          className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-purple-500 transition-all text-left group"
                        >
                          <p className="text-white font-bold text-sm group-hover:text-purple-400 transition-colors truncate">
                            {sub.name}
                          </p>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-zinc-500">{sub.nb_produits} produit{sub.nb_produits > 1 ? 's' : ''}</span>
                            <span className="text-green-400 font-bold">{formatCurrency(sub.ca_total)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-lg font-black text-gradient mb-4">Produits ({results.total})</h3>
                <div className="space-y-3">
                  {results.data.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => viewProduitDetails(item)}
                      className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-purple-500 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                              {item.designation || item.id}
                            </p>
                            {item.designation && <p className="text-xs text-zinc-500 font-mono">{item.id}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <div className="text-right">
                            <p className="font-bold text-green-400">{formatCurrency(item.ca_total)}</p>
                            <p className="text-xs text-zinc-500">{item.nb_tickets || 0} tickets</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {results.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: Math.min(results.totalPages, 10) }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => { setCurrentPage(p); browseCategory(categoryBreadcrumb, p) }}
                        className={`w-10 h-10 rounded-xl font-bold transition-all ${p === (results.page || 1) ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        {p}
                      </button>
                    ))}
                    {results.totalPages > 10 && (
                      <span className="flex items-center text-zinc-500 px-2">... {results.totalPages}</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* RESULTATS NORMAUX */
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gradient">
                    {results.total} r&eacute;sultat{results.total > 1 ? 's' : ''}
                    <span className="ml-2 text-sm font-normal text-zinc-400">
                      ({results.type === 'client' ? 'Clients' : results.type === 'ticket' ? 'Tickets' : 'Produits'})
                    </span>
                  </h2>
                </div>

                <div className="space-y-4">
                  {results.data.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (results.type === 'client') viewClientTickets(item)
                        if (results.type === 'ticket') viewTicketDetails(item)
                        if (results.type === 'produit') viewProduitDetails(item)
                      }}
                      className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800 hover:border-blue-500 transition-all group cursor-pointer"
                    >
                      {results.type === 'client' && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shrink-0">
                              {clientInitial(item)}
                            </div>
                            <div>
                              <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                {item.civilite} {clientDisplayName(item)}
                              </p>
                              <p className="text-sm text-zinc-400">
                                Carte {item.carte} {'\u2022'} {item.ville || 'Ville inconnue'}
                                {item.cp ? ` (${item.cp})` : ''}
                              </p>
                              <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                                {item.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />{item.email}
                                  </span>
                                )}
                                {item.telephone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />{item.telephone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0" />
                        </div>
                      )}

                      {results.type === 'ticket' && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                              <Ticket className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                Facture {item.facture}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {formatDate(item.date)}{item.depot && ` \u2022 ${item.depot}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-green-400">
                                {Number(item.ca_total || 0).toFixed(2)} \u20ac
                              </p>
                              <p className="text-xs text-zinc-500">
                                {item.nb_lignes || 0} ligne{(item.nb_lignes || 0) > 1 ? 's' : ''}
                              </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                          </div>
                        </div>
                      )}

                      {results.type === 'produit' && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                {item.designation || item.id}
                              </p>
                              {item.designation && item.designation !== item.id && (
                                <p className="text-xs text-zinc-500 font-mono">{item.id}</p>
                              )}
                              {item.famille && (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  <span
                                    className="text-xs text-zinc-400 hover:text-purple-400 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); browseCategory({ famille: item.famille }) }}
                                  >
                                    {item.famille}
                                  </span>
                                  {item.sous_famille && (
                                    <>
                                      <span className="text-zinc-600 text-xs">{'\u203a'}</span>
                                      <span
                                        className="text-xs text-zinc-500 hover:text-purple-400 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); browseCategory({ famille: item.famille, sous_famille: item.sous_famille }) }}
                                      >
                                        {item.sous_famille}
                                      </span>
                                    </>
                                  )}
                                  {item.sous_sous_famille && (
                                    <>
                                      <span className="text-zinc-600 text-xs">{'\u203a'}</span>
                                      <span className="text-xs text-zinc-500">{item.sous_sous_famille}</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-green-400">{formatCurrency(item.ca_total)}</p>
                              <p className="text-xs text-zinc-500">
                                {item.nb_tickets || 0} ticket{(item.nb_tickets || 0) > 1 ? 's' : ''}
                              </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {results.data.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500">Aucun r&eacute;sultat trouv&eacute;</p>
                    <p className="text-sm text-zinc-600 mt-2">Essayez avec d'autres crit&egrave;res</p>
                  </div>
                )}

                {results.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: Math.min(results.totalPages, 10) }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => { setCurrentPage(p); handleSearch(p) }}
                        className={`w-10 h-10 rounded-xl font-bold transition-all ${p === currentPage ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        {p}
                      </button>
                    ))}
                    {results.totalPages > 10 && (
                      <span className="flex items-center text-zinc-500 px-2">... {results.totalPages}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
