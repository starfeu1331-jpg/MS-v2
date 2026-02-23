import { useState } from 'react'
import { Search, X, SlidersHorizontal, User, Ticket, Package, ChevronRight, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

interface SearchFilters {
  nom?: string
  carte?: string
  ville?: string
  facture?: string
  dateDebut?: string
  dateFin?: string
  montantMin?: string
  montantMax?: string
  depot?: string
  produit?: string
}

interface SearchResult {
  type: 'client' | 'ticket' | 'produit'
  data: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

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

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.append('query', query)
      params.append('page', currentPage.toString())
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
  }

  const resetFilters = () => {
    setFilters({})
    setQuery('')
    setResults(null)
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(null)
    setProduitTickets([])
    setCurrentPage(1)
  }

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const viewClientTickets = async (client: any) => {
    setSelectedTicket(null)
    setSelectedProduit(null)
    setSelectedClient(client)
    const response = await fetch(`/api/clients/${client.carte}/tickets`)
    const data = await response.json()
    setSelectedClient({ ...client, tickets: data.tickets || [] })
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
              <span className="text-white font-bold">{selectedProduit.nom}</span>
              {selectedProduit.reference_interne && <span className="text-zinc-500 text-sm font-mono">{selectedProduit.reference_interne}</span>}
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Produit</h3>
              <p className="text-xl font-black text-white mb-1">{selectedProduit.nom}</p>
              {selectedProduit.reference_interne && <p className="text-sm font-mono text-zinc-500 mb-2">{selectedProduit.reference_interne}</p>}
              {selectedProduit.famille && (
                <p className="text-sm text-zinc-400">
                  <span className="hover:text-blue-400 cursor-pointer" onClick={() => searchFor(selectedProduit.famille)}>{selectedProduit.famille}</span>
                  {selectedProduit.sous_famille && <><span className="text-zinc-600"> › </span><span className="hover:text-blue-400 cursor-pointer" onClick={() => searchFor(selectedProduit.sous_famille)}>{selectedProduit.sous_famille}</span></>}
                  {selectedProduit.sous_sous_famille && <><span className="text-zinc-600"> › </span><span className="text-zinc-500">{selectedProduit.sous_sous_famille}</span></>}
                </p>
              )}
            </div>
            <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Statistiques</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-black text-green-400">{Number(selectedProduit.ca_total || 0).toFixed(0)}€</p>
                  <p className="text-xs text-zinc-500">CA total</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-blue-400">{selectedProduit.nb_tickets || selectedProduit.total_tickets || 0}</p>
                  <p className="text-xs text-zinc-500">Tickets</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-purple-400">{selectedProduit.quantite_totale || 0}</p>
                  <p className="text-xs text-zinc-500">Qté vendue</p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-black text-gradient mb-4">Tickets contenant ce produit ({produitTickets.length})</h2>
          <div className="space-y-3">
            {produitTickets.map((ticket: any, idx: number) => (
              <div
                key={idx}
                onClick={() => viewTicketDetails(ticket)}
                className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-blue-500 cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{ticket.facture}</p>
                    <p className="text-sm text-zinc-400">
                      {ticket.date ? new Date(ticket.date).toLocaleDateString('fr-FR') : '–'}
                      {ticket.depot && ` • ${ticket.depot}`}
                    </p>
                    {(ticket.nom || ticket.prenom) && (
                      <p
                        className="text-xs text-zinc-500 hover:text-blue-400 cursor-pointer transition-colors"
                        onClick={(e) => { e.stopPropagation(); viewClientTickets({ carte: ticket.carte, nom: ticket.nom, prenom: ticket.prenom, ville: ticket.ville }) }}
                      >{ticket.nom} {ticket.prenom}{ticket.ville ? ` • ${ticket.ville}` : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-green-400">{Number(ticket.ca || 0).toFixed(2)}€</p>
                      <p className="text-xs text-zinc-500">qté : {ticket.quantite}</p>
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

  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button
              onClick={backToClientTickets}
              className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-400" />
              <span className="text-white font-bold">{selectedTicket.facture}</span>
              <span className="text-zinc-500">→ Ticket du {new Date(selectedTicket.date).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
          <div className="flex flex-col lg:flex-row gap-6 mb-6">
            <div className="flex-1 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Ticket</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-zinc-500">Date :</span> <span className="text-white">{selectedTicket.date ? new Date(selectedTicket.date).toLocaleDateString('fr-FR') : '–'}</span></div>
                <div><span className="text-zinc-500">Dépôt :</span> <span className="text-white">{selectedTicket.depot || '–'}</span></div>
                <div><span className="text-zinc-500">CA total :</span> <span className="font-bold text-green-400">{Number(selectedTicket.ca_total || 0).toFixed(2)}€</span></div>
                <div><span className="text-zinc-500">Articles :</span> <span className="text-white">{selectedTicket.quantite_totale || 0}</span></div>
              </div>
            </div>
            {selectedTicket.client && (
              <div
                className="flex-1 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 hover:border-blue-500 cursor-pointer transition-all group"
                onClick={() => viewClientTickets(selectedTicket.client)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Client</h3>
                  <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Voir le profil →</span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{selectedTicket.client.civilite} {selectedTicket.client.prenom} {selectedTicket.client.nom}</p>
                  <p className="text-zinc-400">Carte {selectedTicket.client.carte} • {selectedTicket.client.ville || ''}{selectedTicket.client.cp ? ` (${selectedTicket.client.cp})` : ''}</p>
                  {selectedTicket.client.telephone && <p className="text-zinc-500">{selectedTicket.client.telephone}</p>}
                  {selectedTicket.client.email && <p className="text-zinc-500 text-xs truncate">{selectedTicket.client.email}</p>}
                </div>
              </div>
            )}
          </div>

          <h2 className="text-xl font-black text-gradient mb-4">Lignes du ticket ({selectedTicket.transactions?.length || 0})</h2>
          
          <div className="space-y-4">
            {selectedTicket.transactions?.map((trans: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors"
                      onClick={() => viewProduitDetails({ id: trans.produit, nom: trans.produit_nom || trans.produit, famille: trans.famille, sous_famille: trans.sous_famille })}
                    >{trans.produit_nom || trans.produit}</p>
                    {trans.produit_nom && (
                      <p
                        className="text-xs text-zinc-500 font-mono hover:text-blue-400 cursor-pointer transition-colors"
                        onClick={() => viewProduitDetails({ id: trans.produit, nom: trans.produit_nom, famille: trans.famille, sous_famille: trans.sous_famille })}
                      >{trans.produit}</p>
                    )}
                    {trans.famille && (
                      <p className="text-sm text-zinc-400">
                        <span className="hover:text-blue-400 cursor-pointer transition-colors" onClick={() => searchFor(trans.famille)}>{trans.famille}</span>
                        {trans.sous_famille && <><span className="text-zinc-600"> › </span><span className="hover:text-blue-400 cursor-pointer transition-colors" onClick={() => searchFor(trans.sous_famille)}>{trans.sous_famille}</span></>}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">{trans.depot || ''}</p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="font-bold text-green-400">{Number(trans.ca || 0).toFixed(2)}€</p>
                    <p className="text-sm text-zinc-500">Qté : {trans.quantite}</p>
                    {trans.prix && <p className="text-xs text-zinc-600">PU : {Number(trans.prix).toFixed(2)}€</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!selectedTicket.transactions?.length && (
            <p className="text-center text-zinc-500 py-12">Aucune transaction trouvée</p>
          )}
        </div>
      </div>
    )
  }

  if (selectedClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button
              onClick={backToResults}
              className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              <span className="text-white font-bold">
                {selectedClient.nom}
              </span>
              <span className="text-zinc-500">› Carte {selectedClient.carte}</span>
            </div>
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              Nouvelle recherche
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-72 shrink-0 glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-black text-gradient mb-4">Informations</h3>
            <div className="space-y-3 text-sm">
              {selectedClient.ville && (
                <div>
                  <span className="text-zinc-500">Ville:</span>
                  <p
                    className="text-white hover:text-blue-400 cursor-pointer transition-colors"
                    onClick={() => searchFor(selectedClient.ville)}
                  >{selectedClient.ville} ({selectedClient.cp})</p>
                </div>
              )}
              {selectedClient.date_creation && (
                <div>
                  <span className="text-zinc-500">Client depuis:</span>
                  <p className="text-white">{new Date(selectedClient.date_creation).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-black text-gradient mb-4">
              Tickets ({selectedClient.tickets?.length || 0})
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
                        {new Date(ticket.date).toLocaleDateString()} • {ticket.depot}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-green-400">{Number(ticket.ca_total || ticket.ca || 0).toFixed(2)}€</p>
                        <p className="text-xs text-zinc-500">{ticket.nb_lignes || ticket.quantite || 0} lignes</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!selectedClient.tickets?.length && (
              <p className="text-center text-zinc-500 py-12">Ce client n'a aucun ticket</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
      <div className="max-w-6xl mx-auto mb-8">
        <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 items-center gap-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-2xl px-4 focus-within:border-blue-500">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher un client, ticket ou produit..."
                className="flex-1 py-4 bg-transparent text-white placeholder-zinc-500 focus:outline-none text-lg"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Recherche...' : 'Rechercher'}
            </button>
            {(query || Object.keys(filters).length > 0) && (
              <button
                onClick={resetFilters}
                className="p-4 bg-zinc-800 rounded-2xl hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
        <div className="lg:col-span-1">
          <div className="glass rounded-3xl p-4 shadow-2xl border border-zinc-800 sticky top-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-base font-black text-gradient flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filtres
              </h3>
              <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-300">
                Tout réinitialiser
              </button>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('clients')}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  Clients
                </span>
                {openSections.clients ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>
              {openSections.clients && (
                <div className="p-3 space-y-2 bg-zinc-900/30">
                  <input
                    type="text"
                    placeholder="Nom"
                    value={filters.nom || ''}
                    onChange={(e) => updateFilter('nom', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="N° Carte"
                    value={filters.carte || ''}
                    onChange={(e) => updateFilter('carte', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Ville"
                    value={filters.ville || ''}
                    onChange={(e) => updateFilter('ville', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('tickets')}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-green-400" />
                  Tickets
                </span>
                {openSections.tickets ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>
              {openSections.tickets && (
                <div className="p-3 space-y-2 bg-zinc-900/30">
                  <input
                    type="text"
                    placeholder="N° Facture"
                    value={filters.facture || ''}
                    onChange={(e) => updateFilter('facture', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <label className="block text-xs text-zinc-500">Date début</label>
                  <input
                    type="date"
                    value={filters.dateDebut || ''}
                    onChange={(e) => updateFilter('dateDebut', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <label className="block text-xs text-zinc-500">Date fin</label>
                  <input
                    type="date"
                    value={filters.dateFin || ''}
                    onChange={(e) => updateFilter('dateFin', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Dépôt"
                    value={filters.depot || ''}
                    onChange={(e) => updateFilter('depot', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="€ min"
                      value={filters.montantMin || ''}
                      onChange={(e) => updateFilter('montantMin', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="€ max"
                      value={filters.montantMax || ''}
                      onChange={(e) => updateFilter('montantMax', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('produits')}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-400" />
                  Produits
                </span>
                {openSections.produits ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>
              {openSections.produits && (
                <div className="p-3 space-y-2 bg-zinc-900/30">
                  <input
                    type="text"
                    placeholder="Nom du produit"
                    value={filters.produit || ''}
                    onChange={(e) => updateFilter('produit', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <label className="block text-xs text-zinc-500 pt-1">Date début</label>
                  <input
                    type="date"
                    value={filters.dateDebut || ''}
                    onChange={(e) => updateFilter('dateDebut', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <label className="block text-xs text-zinc-500">Date fin</label>
                  <input
                    type="date"
                    value={filters.dateFin || ''}
                    onChange={(e) => updateFilter('dateFin', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSearch}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors text-sm"
            >
              Appliquer les filtres
            </button>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="glass rounded-3xl p-8 shadow-2xl border border-zinc-800">
            {!results ? (
              <div className="text-center py-16">
                <Search className="w-20 h-20 text-zinc-700 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-gradient mb-3">
                  Recherchez dans votre base de données
                </h2>
                <p className="text-zinc-400 text-lg mb-6">
                  Utilisez la barre de recherche ou les filtres pour commencer
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                  <span>💡 Recherchez par :</span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full">Nom</span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full">N° Carte</span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full">Email</span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full">Téléphone</span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full">N° Facture</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gradient">
                    {results.total} résultat{results.total > 1 ? 's' : ''} trouvé{results.total > 1 ? 's' : ''}
                    {results.type && (
                      <span className="ml-2 text-sm font-normal text-zinc-400">
                        ({results.type === 'client' ? 'Clients' : results.type === 'ticket' ? 'Tickets' : 'Produits'})
                      </span>
                    )}
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
                    className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 hover:border-blue-500 transition-all group cursor-pointer"
                  >
                    {results.type === 'client' && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                            {item.nom?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                              {item.civilite} {item.nom}
                            </p>
                            <p className="text-sm text-zinc-400">
                              Carte {item.carte} • {item.ville || 'Ville inconnue'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    )}

                    {results.type === 'ticket' && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <Ticket className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors">Facture {item.facture}</p>
                            <p className="text-sm text-zinc-400">
                              {item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '–'}
                              {item.heure !== undefined && ` à ${item.heure}h`}
                              {item.depot && ` • ${item.depot}`}
                            </p>
                            {item.nom && (
                              <p
                                className="text-xs text-zinc-500 hover:text-blue-400 cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); viewClientTickets({ carte: item.carte, nom: item.nom, ville: item.ville }) }}
                              >{item.nom}{item.ville ? ` • ${item.ville}` : ''}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-green-400">{Number(item.ca_total || 0).toFixed(2)} €</p>
                            <p className="text-xs text-zinc-500">{item.nb_lignes || 0} ligne{(item.nb_lignes || 0) > 1 ? 's' : ''}</p>
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
                          <div>
                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{item.nom}</p>
                            {item.reference_interne && <p className="text-xs text-zinc-500 font-mono">{item.reference_interne}</p>}
                            {item.famille && (
                              <p className="text-sm text-zinc-400">{item.famille}{item.sous_famille ? ` › ${item.sous_famille}` : ''}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-green-400">{Number(item.ca_total || 0).toFixed(0)}€</p>
                            <p className="text-xs text-zinc-500">{item.nb_tickets || 0} ticket{(item.nb_tickets || 0) > 1 ? 's' : ''}</p>
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
                  <p className="text-zinc-500">Aucun résultat trouvé</p>
                  <p className="text-sm text-zinc-600 mt-2">Essayez avec d'autres critères</p>
                </div>
              )}

              {results.total > results.pageSize && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: Math.ceil(results.total / results.pageSize) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page)
                        handleSearch()
                      }}
                      className={`w-10 h-10 rounded-xl font-bold transition-all ${
                        page === currentPage
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
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
