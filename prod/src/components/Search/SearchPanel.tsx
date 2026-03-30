import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal, User, Ticket, Package, ChevronRight, ChevronLeft, ArrowLeft, ChevronDown, ChevronUp, Layers, TrendingUp, ShoppingCart, MapPin, Calendar, Phone, Mail, Star, BarChart3, ImageOff } from 'lucide-react'
import { LazyPieChart as PieChart, LazyPie as Pie, LazyCell as Cell, LazyResponsiveContainer as ResponsiveContainer, LazyTooltip as RechartsTooltip } from '../../utils/lazyRecharts'
import { trackSearch, trackClientView, trackInteraction } from '../../services/tracker'

// ═══════════════════════════════════════════════════════════════════════
// PIM IMAGE GALLERY COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const PIM_CDN_BASE = 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/'

const ALL_IMAGE_SUFFIXES = [
  { suffix: '_amb_1_web.jpg', label: 'Ambiance 1' },
  { suffix: '_amb_2_web.jpg', label: 'Ambiance 2' },
  { suffix: '_amb_3_web.jpg', label: 'Ambiance 3' },
  { suffix: '_amb_4_web.jpg', label: 'Ambiance 4' },
  { suffix: '_det_1_web.jpg', label: 'Détourée 1' },
  { suffix: '_det_2_web.jpg', label: 'Détourée 2' },
  { suffix: '_det_3_web.jpg', label: 'Détourée 3' },
  { suffix: '_det_4_web.jpg', label: 'Détourée 4' },
  { suffix: '_zoom_1_web.jpg', label: 'Zoom 1' },
  { suffix: '_zoom_2_web.jpg', label: 'Zoom 2' },
  { suffix: '_zoom_3_web.jpg', label: 'Zoom 3' },
]

function useProductImages(productId: string) {
  const [images, setImages] = useState<{ url: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const prevId = useRef('')

  useEffect(() => {
    if (prevId.current === productId) return
    prevId.current = productId
    setLoading(true)
    setImages([])

    const probes = ALL_IMAGE_SUFFIXES.map(({ suffix, label }) => {
      const url = `${PIM_CDN_BASE}${productId}${suffix}`
      return new Promise<{ url: string; label: string } | null>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ url, label })
        img.onerror = () => resolve(null)
        img.src = url
      })
    })

    Promise.all(probes).then((results) => {
      const found = results.filter(Boolean) as { url: string; label: string }[]
      setImages(found)
      setLoading(false)
    })
  }, [productId])

  return { images, loading }
}

function ProductImageLightbox({ images, initialIndex, onClose }: {
  images: { url: string; label: string }[]
  initialIndex: number
  onClose: () => void
}) {
  const [selectedIdx, setSelectedIdx] = useState(initialIndex)

  const goPrev = useCallback(() => setSelectedIdx(i => (i - 1 + images.length) % images.length), [images.length])
  const goNext = useCallback(() => setSelectedIdx(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      onClick={onClose}
      style={{ isolation: 'isolate', zIndex: 99999, padding: '2rem', backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <div className="relative flex flex-col items-center" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 'calc(100vw - 4rem)', maxHeight: 'calc(100vh - 4rem)' }}>

        {/* Main image with nav */}
        <div className="relative flex items-center gap-4" style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 10rem)' }}>
          {images.length > 1 && (
            <button onClick={goPrev}
              className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full border border-zinc-600 transition flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.img
              key={images[selectedIdx].url}
              src={images[selectedIdx].url}
              alt={images[selectedIdx].label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="object-contain rounded-2xl shadow-2xl"
              style={{ maxWidth: 'calc(100vw - 12rem)', maxHeight: 'calc(100vh - 12rem)' }}
            />
          </AnimatePresence>
          {images.length > 1 && (
            <button onClick={goNext}
              className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full border border-zinc-600 transition flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="mt-3 px-3 py-1 bg-zinc-800/80 rounded-full text-xs text-zinc-400 border border-zinc-700/50">
          {selectedIdx + 1} / {images.length} — {images[selectedIdx].label}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 mt-3 justify-center">
            {images.map((img, i) => (
              <img key={img.url} src={img.url} alt={img.label} onClick={() => setSelectedIdx(i)}
                className={`w-12 h-12 object-cover rounded-lg cursor-pointer border-2 transition ${i === selectedIdx ? 'border-blue-400 ring-2 ring-blue-400/30 opacity-100' : 'border-zinc-700 opacity-40 hover:opacity-80'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductThumbnail({ productId, size = 80 }: { productId: string; size?: number }) {
  const { images, loading } = useProductImages(productId)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (loading) {
    return (
      <div
        className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 skel-breath"
        style={{ width: size, height: size, minWidth: size }}
      />
    )
  }

  if (images.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-zinc-800/50 rounded-xl border border-zinc-700/50"
        style={{ width: size, height: size, minWidth: size }}
      >
        <ImageOff className="w-6 h-6 text-zinc-600" />
      </div>
    )
  }

  return (
    <>
      <img
        src={images[0].url}
        alt={productId}
        className="rounded-xl object-cover border border-zinc-700/50 shadow-lg cursor-pointer hover:brightness-110 transition-all"
        style={{ width: size, height: size, minWidth: size }}
        onClick={(e) => { e.stopPropagation(); setLightboxOpen(true) }}
      />
      {lightboxOpen && createPortal(
        <ProductImageLightbox images={images} initialIndex={0} onClose={() => setLightboxOpen(false)} />,
        document.body
      )}
    </>
  )
}

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
  produit_nom?: string
  produit_code?: string
  produit_famille?: string
}

interface SearchResult {
  type: 'client' | 'ticket' | 'produit' | 'categorie' | 'categorie_search'
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

// Couleurs alignées sur le module Segmentation RFM (7 segments)
const segmentColors: Record<string, string> = {
  'Ultra Champions': 'from-purple-500 to-purple-600',
  'Champions': 'from-emerald-500 to-emerald-600',
  'Loyaux': 'from-blue-500 to-blue-600',
  'À Risque': 'from-orange-500 to-red-500',
  'Perdus': 'from-red-600 to-red-800',
  'Nouveaux': 'from-cyan-500 to-cyan-600',
  'Occasionnels': 'from-zinc-500 to-zinc-600',
  'Inconnu': 'from-zinc-600 to-zinc-800',
}

const segmentEmoji: Record<string, string> = {
  'Ultra Champions': '👑',
  'Champions': '🏆',
  'Loyaux': '💙',
  'À Risque': '⚠️',
  'Perdus': '💤',
  'Nouveaux': '🌱',
  'Occasionnels': '🔄',
  'Inconnu': '❓',
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (defined outside to avoid re-mount on parent re-render)
// ═══════════════════════════════════════════════════════════════════════

function FilterInput({ placeholder, filterKey, type = 'text', label, value, onChange, onKeyDown }: {
  placeholder: string
  filterKey: string
  type?: string
  label?: string
  value: string
  onChange: (key: string, value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <>
      {label && <label className="block text-xs text-zinc-500">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(filterKey, e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-zinc-600"
      />
    </>
  )
}

function StatCard({ icon: Icon, label, value, color = 'text-white', sub }: any) {
  return (
    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center text-center">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

const FAMILLE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
  '#84cc16', '#a855f7', '#0ea5e9', '#eab308', '#22c55e'
]

function FamilleCAChart({ data: rawData }: { data: any[] }) {
  const totalCA = rawData.reduce((sum: number, f: any) => sum + Number(f.ca || 0), 0)
  if (totalCA <= 0) return null

  const chartData = rawData.map((f: any) => ({
    name: String(f.famille || 'Autre'),
    value: Math.round(Number(f.ca || 0) * 100) / 100,
    pct: ((Number(f.ca || 0) / totalCA) * 100).toFixed(1)
  })).filter(d => d.value > 0)

  const formatEuro = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' \u20ac'

  return (
    <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> R&eacute;partition CA par famille
      </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={105}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, pct }: any) => name.length > 15 ? `${name.slice(0, 14)}... (${pct}%)` : `${name} (${pct}%)`}
              labelLine={true}
              isAnimationActive={false}
            >
              {chartData.map((_: any, idx: number) => (
                <Cell key={idx} fill={FAMILLE_COLORS[idx % FAMILLE_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: 13 }}
              formatter={(value: any, name: any) => [formatEuro(Number(value)), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.slice(0, 10).map((item: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: FAMILLE_COLORS[idx % FAMILLE_COLORS.length] }} />
            <span className="text-zinc-400 truncate">{item.name}</span>
            <span className="text-zinc-500 ml-auto shrink-0">{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}



// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function SearchPanel({ subPath, navigate: nav, initialQuery = '', initialClientCarte = '', initialProductCode = '', onQueryConsumed, period }: { subPath?: string; navigate?: (path: string) => void; initialQuery?: string; initialClientCarte?: string; initialProductCode?: string; onQueryConsumed?: () => void; period?: { type: string; value: any; label?: string } } = {}) {
  const [query, setQuery] = useState(initialQuery)
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
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState<{ famille?: string; sous_famille?: string; sous_sous_famille?: string }>({})
  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [categoryData, setCategoryData] = useState<any>(null)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [categoryPage, setCategoryPage] = useState(1)
  const searchPeriod = period || { type: 'all', value: 'all' }
  const initialQueryHandled = useRef(false)
  const initialClientHandled = useRef(false)
  const initialProductHandled = useRef(false)

  // Refs for URL-driven navigation sync
  const selectedClientRef = useRef(selectedClient)
  selectedClientRef.current = selectedClient
  const selectedTicketRef = useRef(selectedTicket)
  selectedTicketRef.current = selectedTicket
  const selectedProduitRef = useRef(selectedProduit)
  selectedProduitRef.current = selectedProduit
  const pendingTicketRef = useRef<string | null>(null)
  const prevSubPathRef = useRef<string | undefined>(undefined)

  // Auto-search when initialQuery is provided from navigation
  useEffect(() => {
    if (initialQuery && !initialQueryHandled.current) {
      initialQueryHandled.current = true
      setQuery(initialQuery)
      // Trigger search after state update
      setTimeout(() => {
        onQueryConsumed?.()
      }, 100)
    }
  }, [initialQuery, onQueryConsumed])

  // Actually run the search when query is set from initialQuery  
  useEffect(() => {
    if (initialQueryHandled.current && query && !results && !loading) {
      handleSearchDirect(query)
    }
  }, [query])

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
      const response = await fetch(`/api/search?${params}`)
      const data = await response.json()
      if (data.error || !data.data) {
        setResults({ type: 'client', data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })
      } else {
        setResults(data)
        trackSearch(query, 'search', data.total)
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }, [query, filters, currentPage])

  // Direct search with explicit query (used by initialQuery auto-search)
  const handleSearchDirect = useCallback(async (searchQuery: string) => {
    setLoading(true)
    setFiltersCollapsed(true)
    try {
      const params = new URLSearchParams()
      params.append('query', searchQuery)
      params.append('page', '1')
      const response = await fetch(`/api/search?${params}`)
      const data = await response.json()
      if (data.error || !data.data) {
        setResults({ type: 'client', data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })
      } else {
        setResults(data)
        trackSearch(searchQuery, 'search', data.total)
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
    setSelectedCategory(null)
    setCategoryData(null)
  }

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(1)
    }
  }

  const viewClientTickets = async (client: any, pushUrl = true) => {
    setSelectedTicket(null)
    setSelectedProduit(null)
    setSelectedClient({ ...client, _loading: true })
    trackClientView(client.carte, 'search')
    if (pushUrl && nav) {
      nav('/search/client/' + encodeURIComponent(client.carte))
    }
    try {
      const dates = getSearchPeriodDates()
      const params = new URLSearchParams()
      if (dates.startDate) params.set('startDate', dates.startDate)
      if (dates.endDate) params.set('endDate', dates.endDate)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(`/api/clients/${client.carte}/tickets${qs}`)
      const data = await response.json()
      setSelectedClient({
        ...client,
        ...data.client,
        tickets: data.tickets || [],
        stats: data.stats,
        topProduits: data.topProduits,
        depots: data.depots,
        rfm: data.rfm,
        periodRfm: data.periodRfm,
        familleCA: data.familleCA
      })
      // Handle pending ticket (from deep link)
      if (pendingTicketRef.current) {
        const facture = pendingTicketRef.current
        pendingTicketRef.current = null
        viewTicketDetails({ facture }, false)
      }
    } catch {
      setSelectedClient({ ...client, tickets: [], _error: true })
    }
  }

  const viewTicketDetails = async (ticket: any, pushUrl = true) => {
    setSelectedTicket(ticket)
    trackInteraction('TICKET_VIEW', 'search', { facture: ticket.facture })
    if (pushUrl && nav) {
      const clientCarte = selectedClientRef.current?.carte
      if (clientCarte) {
        nav('/search/client/' + encodeURIComponent(clientCarte) + '/ticket/' + encodeURIComponent(ticket.facture))
      } else {
        nav('/search/ticket/' + encodeURIComponent(ticket.facture))
      }
    }
    const response = await fetch(`/api/tickets/${ticket.facture}/transactions`)
    const data = await response.json()
    setSelectedTicket({ ...data.ticket, client: data.client, transactions: data.transactions || [] })
  }

  const backToResults = () => {
    window.history.back()
  }

  const backToClientTickets = () => {
    window.history.back()
  }

  const viewProduitDetails = async (produit: any, pushUrl = true) => {
    setSelectedClient(null)
    setSelectedTicket(null)
    setSelectedProduit(produit)
    setProduitTickets([])
    trackInteraction('PRODUCT_VIEW', 'search', { productId: produit.id })
    if (pushUrl && nav) {
      nav('/search/produit/' + encodeURIComponent(produit.id))
    }
    const dates = getSearchPeriodDates()
    const dateParams = dates.startDate ? `&startDate=${dates.startDate}&endDate=${dates.endDate}` : ''
    const response = await fetch(`/api/search?produit_id=${encodeURIComponent(produit.id)}&pageSize=100${dateParams}`)
    const data = await response.json()
    setProduitTickets(data.data || [])
    setSelectedProduit({ ...produit, ...(data.produit || {}), total_tickets: data.total })
  }

  // URL-driven navigation sync (handles popstate + deep links)
  useEffect(() => {
    if (subPath === undefined) return
    if (subPath === prevSubPathRef.current) return
    prevSubPathRef.current = subPath

    // /search/client/:carte or /search/client/:carte/ticket/:facture
    const clientMatch = subPath.match(/^client\/([^/]+?)(?:\/ticket\/(.+))?$/)
    if (clientMatch) {
      const carte = decodeURIComponent(clientMatch[1])
      const facture = clientMatch[2] ? decodeURIComponent(clientMatch[2]) : null
      if (!selectedClientRef.current || selectedClientRef.current.carte !== carte) {
        if (facture) pendingTicketRef.current = facture
        viewClientTickets({ carte }, false)
      } else if (facture) {
        if (!selectedTicketRef.current || selectedTicketRef.current.facture !== facture) {
          viewTicketDetails({ facture }, false)
        }
      } else {
        if (selectedTicketRef.current) setSelectedTicket(null)
      }
      return
    }

    // /search/ticket/:facture (direct ticket without client context)
    const ticketMatch = subPath.match(/^ticket\/(.+)$/)
    if (ticketMatch) {
      const facture = decodeURIComponent(ticketMatch[1])
      if (!selectedTicketRef.current || selectedTicketRef.current.facture !== facture) {
        viewTicketDetails({ facture }, false)
      }
      return
    }

    // /search/produit/:code
    const produitMatch = subPath.match(/^produit\/(.+)$/)
    if (produitMatch) {
      const code = decodeURIComponent(produitMatch[1])
      if (!selectedProduitRef.current || selectedProduitRef.current.id !== code) {
        viewProduitDetails({ id: code }, false)
      }
      return
    }

    // Empty subPath = main search view
    if (selectedClientRef.current || selectedTicketRef.current || selectedProduitRef.current) {
      setSelectedClient(null)
      setSelectedTicket(null)
      setSelectedProduit(null)
    }
  }, [subPath])

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
      const response = await fetch(`/api/search?${params}`)
      const data = await response.json()
      setResults(data)
      trackSearch(value, 'search', data.total)
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSearchPeriodDates = useCallback(() => {
    const p = searchPeriod
    if (p.type === 'all') return {}
    if (p.type === 'months') {
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - Number(p.value))
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }
    }
    if (p.type === 'year') {
      return { startDate: `${p.value}-01-01`, endDate: `${p.value}-12-31` }
    }
    if (p.type === 'custom' && typeof p.value === 'string' && p.value.includes('_')) {
      const [s, e] = p.value.split('_')
      return { startDate: s, endDate: e }
    }
    return {}
  }, [searchPeriod])

  // Re-fetch when period changes (for category/product views)
  const searchPeriodRef = useRef(searchPeriod)
  useEffect(() => {
    searchPeriodRef.current = searchPeriod
    if (selectedCategory) {
      browseCategory(selectedCategory, categoryPage)
    }
    if (selectedProduit && !selectedTicket) {
      viewProduitDetails(selectedProduit, false)
    }
    if (selectedClient && !selectedTicket) {
      viewClientTickets(selectedClient, false)
    }
  }, [searchPeriod])

  const browseCategory = async (
    opts: { famille?: string; sous_famille?: string; sous_sous_famille?: string },
    pageOverride?: number
  ) => {
    setCategoryLoading(true)
    const cat = { ...opts }
    trackInteraction('CATEGORY_BROWSE', 'search', opts as Record<string, unknown>)
    setSelectedCategory(cat)
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
      const dates = getSearchPeriodDates()
      if (dates.startDate) params.append('startDate', dates.startDate)
      if (dates.endDate) params.append('endDate', dates.endDate)
      const response = await fetch(`/api/search?${params}`)
      const data = await response.json()
      setCategoryData(data)
      setCategoryPage(pageOverride || 1)
    } catch (e) {
      console.error('Category browse error:', e)
    } finally {
      setCategoryLoading(false)
    }
  }

  // FilterInput/StatCard are defined outside the component to prevent focus loss

  // ═══════════════════════════════════════════════════════════════════════
  // VUE DETAIL CATEGORIE (page complète)
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedCategory && !selectedProduit && !selectedTicket && !selectedClient) {
    const cat = selectedCategory
    const data = categoryData

    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6">
        {/* Header */}
        <div className="glass rounded-3xl p-4 mb-6 shadow-2xl border border-zinc-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (cat.sous_sous_famille) {
                  browseCategory({ famille: cat.famille, sous_famille: cat.sous_famille })
                } else if (cat.sous_famille) {
                  browseCategory({ famille: cat.famille })
                } else {
                  setSelectedCategory(null)
                  setCategoryData(null)
                }
              }}
              className="p-2 hover:bg-zinc-700/50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Layers className="w-5 h-5 text-purple-400" />
                {cat.famille && (
                  <button
                    onClick={() => browseCategory({ famille: cat.famille })}
                    className={`text-sm font-bold transition-colors ${!cat.sous_famille ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {cat.famille}
                  </button>
                )}
                {cat.sous_famille && (
                  <>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                    <button
                      onClick={() => browseCategory({ famille: cat.famille, sous_famille: cat.sous_famille })}
                      className={`text-sm font-bold transition-colors ${!cat.sous_sous_famille ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {cat.sous_famille}
                    </button>
                  </>
                )}
                {cat.sous_sous_famille && (
                  <>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                    <span className="text-sm font-bold text-white">{cat.sous_sous_famille}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => { setSelectedCategory(null); setCategoryData(null); setFiltersCollapsed(false) }}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              Nouvelle recherche
            </button>
          </div>
        </div>

        {categoryLoading && (
          <div className="py-8 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 skel-breath">
              {[0,1,2,3].map(i => <div key={i} className={`rounded-xl p-4 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${i+1}`}><div className="h-3 w-16 bg-zinc-800 rounded mb-2" /><div className="h-5 w-20 bg-zinc-800 rounded" /></div>)}
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden skel-breath skel-d2">
              <div className="p-6 space-y-3">{[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-zinc-800/40 rounded-lg" />)}</div>
            </div>
          </div>
        )}

        {!categoryLoading && data && (
          <>
            {/* Stats */}
            {data.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={TrendingUp} label="CA total" value={formatCurrency(data.stats.ca_total)} color="text-green-400" />
                <StatCard icon={Package} label="Produits" value={data.total || data.stats.nb_produits || 0} color="text-blue-400" />
                <StatCard icon={Ticket} label="Tickets" value={data.stats.nb_tickets || 0} color="text-purple-400" />
                <StatCard icon={ShoppingCart} label="Clients" value={data.stats.nb_clients || 0} color="text-amber-400" />
              </div>
            )}

            {/* Sous-catégories */}
            {data.subcategories && data.subcategories.length > 0 && (
              <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800 mb-6">
                <h3 className="text-lg font-black text-gradient mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Sous-catégories ({data.subcategories.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {data.subcategories.map((sub: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (!cat.sous_famille) {
                          browseCategory({ famille: cat.famille, sous_famille: sub.name })
                        } else {
                          browseCategory({ famille: cat.famille, sous_famille: cat.sous_famille, sous_sous_famille: sub.name })
                        }
                      }}
                      className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 hover:border-purple-500 transition-all text-left group"
                    >
                      <p className="text-white font-bold text-sm group-hover:text-purple-400 transition-colors mb-2 truncate">
                        {sub.name}
                      </p>
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-zinc-500">
                          {sub.nb_produits} produit{sub.nb_produits > 1 ? 's' : ''}
                        </span>
                        <span className="text-sm text-green-400 font-bold">
                          {formatCurrency(sub.ca_total)}
                        </span>
                      </div>
                      <ChevronRight className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-zinc-700 group-hover:text-purple-400 transition-colors hidden group-hover:block" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Produits */}
            {data.data && data.data.length > 0 && (
              <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
                <h3 className="text-lg font-black text-gradient mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Produits ({data.total})
                </h3>
                <div className="space-y-3">
                  {data.data.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => viewProduitDetails(item)}
                      className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-purple-500 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProductThumbnail productId={item.id} size={40} />
                          <div className="min-w-0">
                            <p className="font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                              {item.designation || item.id}
                            </p>
                            {item.designation && <p className="text-xs text-zinc-500 font-mono">{item.id}</p>}
                            {item.sous_famille && !cat.sous_famille && (
                              <p className="text-xs text-zinc-500 mt-0.5">{item.sous_famille}</p>
                            )}
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

                {/* Pagination */}
                {data.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {categoryPage > 1 && (
                      <button
                        onClick={() => browseCategory(cat, categoryPage - 1)}
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-zinc-700 transition-colors text-sm"
                      >
                        ← Préc.
                      </button>
                    )}
                    {Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => {
                      let p: number
                      if (data.totalPages <= 10) p = i + 1
                      else if (categoryPage <= 5) p = i + 1
                      else if (categoryPage >= data.totalPages - 4) p = data.totalPages - 9 + i
                      else p = categoryPage - 4 + i
                      return (
                        <button
                          key={p}
                          onClick={() => browseCategory(cat, p)}
                          className={`w-10 h-10 rounded-xl font-bold transition-all ${p === categoryPage ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    {categoryPage < data.totalPages && (
                      <button
                        onClick={() => browseCategory(cat, categoryPage + 1)}
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-zinc-700 transition-colors text-sm"
                      >
                        Suiv. →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty */}
            {(!data.data || data.data.length === 0) && (!data.subcategories || data.subcategories.length === 0) && (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500">Aucun produit dans cette catégorie</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

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
              <div className="flex gap-4 items-start">
                <ProductThumbnail productId={selectedProduit.id} size={80} />
                <div className="flex-1 min-w-0">
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
                <a
                  href={`https://www.decor-discount.com/#b19a/fullscreen/m=and&q=${selectedProduit.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2 underline transition-colors"
                >
                  🌐 Voir sur decor-discount.com
                </a>
              )}
                </div>
              </div>
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
                      <p className="font-bold text-green-400">{Number(ticket.ca || 0).toFixed(2)} €</p>
                      <p className="text-xs text-zinc-500">qt&eacute; : {ticket.quantite}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {produitTickets.length === 0 && (
            <div className="space-y-3 py-6">
              {[0,1,2].map(i => (
                <div key={i} className={`flex items-center gap-3 skel-breath skel-d${i+1}`}>
                  <div className="h-3 w-20 bg-zinc-800 rounded" />
                  <div className="flex-1 h-3 bg-zinc-800/40 rounded" />
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
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
                  <span className="font-bold text-green-400">{Number(selectedTicket.ca_total || 0).toFixed(2)} €</span>
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
                    Carte {selectedTicket.client.carte}{selectedTicket.client.magasin_nom ? ` \u2022 ${selectedTicket.client.magasin_nom} (${selectedTicket.client.magasin_code})` : ''}
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
                    <p className="font-bold text-green-400">{Number(trans.ca || 0).toFixed(2)} €</p>
                    <p className="text-sm text-zinc-500">Qté : {trans.quantite}</p>
                    {trans.prix && (
                      <p className="text-xs text-zinc-600">PU : {Number(trans.prix).toFixed(2)} €</p>
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
    const periodRfm = selectedClient.periodRfm || null
    const hasPeriodRfm = periodRfm && searchPeriod.type !== 'all'

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
            {/* Segment de base (toutes données) */}
            <div className={`rounded-2xl p-4 bg-gradient-to-br ${gradientClass} ${hasPeriodRfm ? 'mb-2' : 'mb-4'}`}>
              <p className="text-3xl mb-1">{segmentEmoji[segment]}</p>
              <p className="text-white font-black text-xl">{segment}</p>
              {hasPeriodRfm && <p className="text-white/60 text-[10px] mt-1 font-medium">Segmentation globale (toute la donnée)</p>}
            </div>
            {/* Segment sur la période sélectionnée */}
            {hasPeriodRfm && (() => {
              const pSegment = periodRfm.segment || 'Inconnu'
              const pGradient = segmentColors[pSegment] || segmentColors['Inconnu']
              const changed = pSegment !== segment
              return (
                <div className={`rounded-2xl p-3 bg-gradient-to-br ${pGradient} mb-4 border ${changed ? 'border-amber-500/40' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xl">{segmentEmoji[pSegment]}</p>
                      <div>
                        <p className="text-white font-black text-base">{pSegment}</p>
                        <p className="text-white/60 text-[10px] font-medium">Sur la période</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-black/30 text-white/80 text-[10px] font-bold">
                        {periodRfm.score}
                      </span>
                    </div>
                  </div>
                  {changed && (
                    <p className="text-amber-300/80 text-[10px] mt-1.5 font-medium">⚠ Segment différent de la base globale</p>
                  )}
                </div>
              )
            })()}
            {/* Scores RFM (quintiles 1-5) — toujours la base globale */}
            {(rfm.r || rfm.f || rfm.m) && (
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-zinc-900/50 p-3 rounded-xl">
                  <p className="text-lg font-black text-blue-400">{rfm.r ?? '–'}<span className="text-xs text-zinc-600">/5</span></p>
                  <p className="text-xs text-zinc-500">Récence</p>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-xl">
                  <p className="text-lg font-black text-green-400">{rfm.f ?? '–'}<span className="text-xs text-zinc-600">/5</span></p>
                  <p className="text-xs text-zinc-500">Fréquence</p>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-xl">
                  <p className="text-lg font-black text-amber-400">{rfm.m ?? '–'}<span className="text-xs text-zinc-600">/5</span></p>
                  <p className="text-xs text-zinc-500">Montant</p>
                </div>
              </div>
            )}
            {/* Métriques brutes */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-zinc-900/50 p-2 rounded-xl">
                <p className="text-sm font-bold text-blue-400">{rfm.recency != null ? `${rfm.recency}j` : '–'}</p>
                <p className="text-[10px] text-zinc-600">Dernier achat</p>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded-xl">
                <p className="text-sm font-bold text-green-400">{rfm.frequency ?? '–'}</p>
                <p className="text-[10px] text-zinc-600">Nb tickets</p>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded-xl">
                <p className="text-sm font-bold text-amber-400">{formatCurrency(rfm.monetary)}</p>
                <p className="text-[10px] text-zinc-600">CA total</p>
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
                        <span className="text-white text-sm font-bold">{d.depot_nom ? `${d.depot_nom} (${d.depot})` : d.depot}</span>
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

        {/* Camembert CA par famille */}
        {selectedClient.familleCA && selectedClient.familleCA.length > 0 && (
          <div className="mb-6">
            <FamilleCAChart data={selectedClient.familleCA} />
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
                        {Number(ticket.ca_total || ticket.ca || 0).toFixed(2)} €
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
            <div className="space-y-3 py-6">
              {[0,1,2].map(i => (
                <div key={i} className={`flex items-center gap-3 skel-breath skel-d${i+1}`}>
                  <div className="h-3 w-20 bg-zinc-800 rounded" />
                  <div className="flex-1 h-3 bg-zinc-800/40 rounded" />
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
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
        <div className="relative glass rounded-2xl p-4 shadow-2xl border border-zinc-700/60 bg-gradient-to-r from-zinc-900/80 via-zinc-800/60 to-zinc-900/80">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-3 bg-zinc-950/60 border border-zinc-700/50 rounded-xl px-4 focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all duration-200">
              <Search className="w-5 h-5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(1) }}
                placeholder="Rechercher un client, ticket ou produit..."
                className="flex-1 py-3 bg-transparent text-white placeholder-zinc-500 focus:outline-none text-base"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleSearch(1)}
              disabled={loading}
              className="p-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-500 hover:to-blue-400 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:hover:shadow-none shrink-0"
              title="Rechercher"
            >
              {loading ? <div className="w-5 h-5 bg-white/20 rounded-full skel-breath" /> : <Search className="w-5 h-5" />}
            </button>
            {Object.keys(filters).length > 0 && (
              <button onClick={resetFilters} className="p-3 bg-zinc-800/80 rounded-xl hover:bg-zinc-700 transition-colors shrink-0" title="Tout effacer">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
        {/* SIDEBAR FILTRES */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl shadow-2xl border border-zinc-800 sticky top-6 overflow-hidden">
            <div
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors select-none"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Filtres</h3>
                {Object.values(filters).filter(Boolean).length > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {Object.values(filters).filter(Boolean).length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {Object.values(filters).filter(Boolean).length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); resetFilters(); }} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                    Réinitialiser
                  </button>
                )}
                {filtersCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </div>
            </div>

            {!filtersCollapsed && (
              <div className="px-3 pb-3 space-y-1">

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
                      <FilterInput placeholder="Nom" filterKey="nom" value={filters.nom || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Pr&eacute;nom" filterKey="prenom" value={filters.prenom || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Email" filterKey="email" value={filters.email || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="T&eacute;l&eacute;phone (06 84 12...)" filterKey="telephone" value={filters.telephone || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Adresse" filterKey="adresse" value={filters.adresse || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="N&deg; Carte" filterKey="carte" value={filters.carte || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Ville" filterKey="ville" value={filters.ville || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Code postal" filterKey="cp" value={filters.cp || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
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
                      <FilterInput placeholder="N&deg; Facture" filterKey="facture" value={filters.facture || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="" filterKey="dateDebut" type="date" label="Date d&eacute;but" value={filters.dateDebut || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="" filterKey="dateFin" type="date" label="Date fin" value={filters.dateFin || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="D&eacute;p&ocirc;t" filterKey="depot" value={filters.depot || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <div className="grid grid-cols-2 gap-2">
                        <FilterInput placeholder="Min €" filterKey="montantMin" type="number" value={filters.montantMin || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                        <FilterInput placeholder="Max €" filterKey="montantMax" type="number" value={filters.montantMax || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
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
                      <FilterInput placeholder="Nom du produit" filterKey="produit_nom" value={filters.produit_nom || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Code produit" filterKey="produit_code" value={filters.produit_code || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
                      <FilterInput placeholder="Famille / Sous-famille" filterKey="produit_famille" value={filters.produit_famille || ''} onChange={updateFilter} onKeyDown={handleFilterKeyDown} />
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
            )}
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
            ) : results.type === 'categorie_search' ? (
              /* VUE RESULTATS RECHERCHE FAMILLE */
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gradient">
                    {results.total} famille{results.total > 1 ? 's' : ''} trouvée{results.total > 1 ? 's' : ''}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.data.map((cat: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (cat.level === 'famille') {
                          browseCategory({ famille: cat.name })
                        } else if (cat.level === 'sous_famille') {
                          browseCategory({ famille: cat.parent_famille, sous_famille: cat.name })
                        } else {
                          browseCategory({ famille: cat.parent_famille, sous_famille: undefined, sous_sous_famille: cat.name })
                        }
                      }}
                      className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 hover:border-purple-500 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-violet-600" />
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-5 h-5 text-purple-400" />
                        <span className="text-xs text-zinc-500 capitalize">
                          {cat.level === 'famille' ? 'Famille' : cat.level === 'sous_famille' ? 'Sous-famille' : 'Sous-sous-famille'}
                        </span>
                      </div>
                      <p className="text-white font-bold text-lg group-hover:text-purple-400 transition-colors mb-1">
                        {cat.name}
                      </p>
                      {cat.parent_famille && cat.level !== 'famille' && (
                        <p className="text-xs text-zinc-500 mb-2">dans {cat.parent_famille}</p>
                      )}
                      <div className="flex justify-between items-end mt-3">
                        <span className="text-sm text-zinc-500">
                          {cat.nb_produits} produit{cat.nb_produits > 1 ? 's' : ''}
                        </span>
                        <span className="text-lg font-bold text-green-400">{formatCurrency(cat.ca_total)}</span>
                      </div>
                      <ChevronRight className="absolute top-1/2 right-4 -translate-y-1/2 w-5 h-5 text-zinc-700 group-hover:text-purple-400 transition-colors" />
                    </button>
                  ))}
                </div>
                {results.data.length === 0 && (
                  <div className="text-center py-12">
                    <Layers className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500">Aucune famille trouvée</p>
                  </div>
                )}
              </>
            ) : results.type === 'categorie' ? (
              /* VUE CATEGORIE - redirect vers page complète */
              (() => {
                // Si on reçoit un résultat catégorie, ouvrir la page complète
                if (!selectedCategory) {
                  setTimeout(() => browseCategory({
                    famille: results.famille || undefined,
                    sous_famille: results.sous_famille || undefined,
                    sous_sous_famille: results.sous_sous_famille || undefined
                  }), 0)
                }
                return (
                  <div className="py-8 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 skel-breath">
                      {[0,1,2,3].map(i => <div key={i} className={`rounded-xl p-4 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${i+1}`}><div className="h-3 w-16 bg-zinc-800 rounded mb-2" /><div className="h-5 w-20 bg-zinc-800 rounded" /></div>)}
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden skel-breath skel-d2">
                      <div className="p-6 space-y-3">{[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-zinc-800/40 rounded-lg" />)}</div>
                    </div>
                  </div>
                )
              })()
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
                                Carte {item.carte}{item.magasin_nom ? ` \u2022 ${item.magasin_nom} (${item.magasin_code})` : ''}
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
                                {Number(item.ca_total || 0).toFixed(2)} €
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
                            <ProductThumbnail productId={item.id} size={40} />
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
