import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, ChevronLeft, ArrowLeft, Heart, Plus, Trash2, X, Star,
  Package, TrendingUp, ShoppingCart, Users, Store, Calendar, BarChart3,
  ImageOff, FolderOpen, Loader2, Edit3, Check, CheckSquare, Square, MinusSquare,
  PaintBucket, Layers, Armchair, AlertTriangle
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

// ─── Constants ───────────────────────────────────────────────
const PIM_CDN_BASE = 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/'
const ALL_IMAGE_SUFFIXES = [
  { suffix: '_amb_1_web.jpg', label: 'Ambiance 1' },
  { suffix: '_amb_2_web.jpg', label: 'Ambiance 2' },
  { suffix: '_amb_3_web.jpg', label: 'Ambiance 3' },
  { suffix: '_det_1_web.jpg', label: 'Détourée 1' },
  { suffix: '_det_2_web.jpg', label: 'Détourée 2' },
  { suffix: '_zoom_1_web.jpg', label: 'Zoom 1' },
  { suffix: '_zoom_2_web.jpg', label: 'Zoom 2' },
]

const FAMILIES = [
  {
    id: 'mur',
    name: 'Mur',
    subtitle: 'Papiers peints, peintures',
    categoryId: 'f841ffa8-ae68-40fc-8f28-21e91613b487',
    image: 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/67319_amb_1_web.jpg',
    icon: PaintBucket,
    accentColor: 'bg-blue-500',
    iconBg: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/50',
    hoverBg: 'hover:bg-blue-500/5'
  },
  {
    id: 'sol',
    name: 'Sol',
    subtitle: 'PVC, moquettes, stratifié, tapis',
    categoryId: '4eace1a1-b882-49a4-97f8-9aaeeeae04a4',
    image: 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/77408_amb_1_web.jpg',
    icon: Layers,
    accentColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-500/50',
    hoverBg: 'hover:bg-emerald-500/5'
  },
  {
    id: 'ameublement',
    name: 'Ameublement',
    subtitle: 'Tissus, rideaux, coussins',
    categoryId: '98586ce1-5987-488d-8cc2-d250b6cbf648',
    image: 'https://www.decor-discount.com/img/cms/tissu-categorie2.jpg',
    icon: Armchair,
    accentColor: 'bg-amber-500',
    iconBg: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/50',
    hoverBg: 'hover:bg-amber-500/5'
  }
]

const TOKEN_KEY = 'magic_token'
function getToken() { return localStorage.getItem(TOKEN_KEY) || '' }

// ─── Types ───────────────────────────────────────────────────
interface PimCategory { id: string; code: string; name: string; productCount: number; hasChildren?: boolean }
interface PimProduct {
  id: string; code: string; name: string; nameComplement: string; refInterne: string;
  famille: string; familleCode: string; categories: { id: string; code: string; name: string }[];
  gammeColoristique: string; fabrication: string; fournisseur: string; destination: string;
  epaisseur: string; largeur: string; prixVente: string; dateCreation: string;
  composition: string; marque: string; aspect: string; sousFamille: string; sousSousFamille: string;
}
interface ProductStats { ca: number; nbTickets: number; nbLignes: number; quantite: number; firstSale: string; lastSale: string; nbDepots: number }
interface FavoriteGroup { id: string; name: string; itemCount: number; createdAt: string }

// ─── Image Hooks ─────────────────────────────────────────────
function useProductImages(productId: string) {
  const [images, setImages] = useState<{ url: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const prevId = useRef('')

  useEffect(() => {
    if (!productId || prevId.current === productId) return
    prevId.current = productId
    setLoading(true); setImages([])
    const probes = ALL_IMAGE_SUFFIXES.map(({ suffix, label }) => {
      const url = `${PIM_CDN_BASE}${productId}${suffix}`
      return new Promise<{ url: string; label: string } | null>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ url, label })
        img.onerror = () => resolve(null)
        img.src = url
      })
    })
    Promise.all(probes).then((r) => { setImages(r.filter(Boolean) as any); setLoading(false) })
  }, [productId])
  return { images, loading }
}

function ProductThumbnail({ productId, size = 64 }: { productId: string; size?: number }) {
  const { images, loading } = useProductImages(productId)
  if (loading) return <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 skel-breath" style={{ width: size, height: size, minWidth: size }} />
  if (!images.length) return <div className="flex items-center justify-center bg-zinc-800/50 rounded-xl border border-zinc-700/50" style={{ width: size, height: size, minWidth: size }}><ImageOff className="w-4 h-4 text-zinc-600" /></div>
  return <img src={images[0].url} alt={productId} className="rounded-xl object-cover border border-zinc-700/50" style={{ width: size, height: size, minWidth: size }} />
}

function ImageGallery({ productId }: { productId: string }) {
  const { images, loading } = useProductImages(productId)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const goPrev = useCallback(() => setSelectedIdx(i => (i - 1 + images.length) % images.length), [images.length])
  const goNext = useCallback(() => setSelectedIdx(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, goPrev, goNext])

  if (loading) return <div style={{ width: 500, height: 500, minWidth: 500, maxWidth: 500 }} className="bg-zinc-800/50 rounded-2xl skel-breath" />
  if (!images.length) return <div style={{ width: 500, height: 500, minWidth: 500, maxWidth: 500 }} className="bg-zinc-800/50 rounded-2xl flex items-center justify-center border border-zinc-700/50"><ImageOff className="w-12 h-12 text-zinc-700" /><span className="text-zinc-600 ml-3">Aucune image</span></div>

  return (
    <>
      <div className="space-y-2">
        <div className="relative group" style={{ width: 500, height: 500, minWidth: 500, maxWidth: 500 }}>
          <img
            src={images[selectedIdx]?.url}
            alt={images[selectedIdx]?.label}
            style={{ width: 500, height: 500, minWidth: 500, maxWidth: 500, minHeight: 500, maxHeight: 500 }}
            className="object-contain rounded-2xl bg-zinc-900 border border-zinc-700/50 cursor-pointer hover:brightness-110 transition"
            onClick={() => setLightbox(true)}
          />
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); goPrev() }}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition">
                <ChevronLeft className="w-3.5 h-3.5 text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); goNext() }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </button>
            </>
          )}
          {images.length > 1 && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setSelectedIdx(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition ${i === selectedIdx ? 'bg-blue-400' : 'bg-white/30'}`} />
              ))}
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <img key={img.url} src={img.url} alt={img.label} onClick={() => setSelectedIdx(i)}
                className={`w-10 h-10 object-cover rounded-lg cursor-pointer border-2 flex-shrink-0 transition ${i === selectedIdx ? 'border-blue-400 ring-2 ring-blue-400/30' : 'border-zinc-700 opacity-60 hover:opacity-100'}`}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && createPortal(
        <div className="fixed inset-0 flex items-center justify-center"
          onClick={() => setLightbox(false)}
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
        </div>, document.body
      )}
    </>
  )
}

// ─── API Helpers ─────────────────────────────────────────────
async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}`, ...options?.headers } })
  if (!res.ok) throw new Error(`API ${url} → ${res.status}`)
  return res.json()
}

// ─── API Cache ───────────────────────────────────────────────
const apiCache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 min

function cacheKey(url: string, options?: RequestInit) {
  return `${options?.method || 'GET'}:${url}:${options?.body || ''}`
}

async function cachedFetch(url: string, options?: RequestInit) {
  const key = cacheKey(url, options)
  const cached = apiCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data
  const data = await fetchApi(url, options)
  apiCache.set(key, { data, ts: Date.now() })
  return data
}

function invalidateCache(prefix?: string) {
  if (!prefix) { apiCache.clear(); return }
  for (const k of apiCache.keys()) { if (k.includes(prefix)) apiCache.delete(k) }
}

// ─── Formatters ──────────────────────────────────────────────
const fmtCA = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : `${v.toFixed(0)}€`
const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

type BreadcrumbItem = { id: string; code: string; name: string }

type ViewState =
  | { type: 'home' }
  | { type: 'family'; familyId: string }
  | { type: 'category'; familyId: string; categoryId: string; categoryName: string; breadcrumb: BreadcrumbItem[] }
  | { type: 'product'; productId: string }
  | { type: 'search'; query: string }
  | { type: 'favorites'; groupId?: string }

interface ProductsPanelProps {
  period?: { type: string; value: number | string; label?: string }
  navigate?: (path: string) => void
  subPath?: string
}

export default function ProductsPanel({ period, navigate, subPath }: ProductsPanelProps) {
  const [view, setView] = useState<ViewState>({ type: 'home' })
  const [searchInput, setSearchInput] = useState('')
  const prevViewRef = useRef<ViewState>({ type: 'home' })
  const skipNextSubPathParse = useRef(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setToast({ message, type })
    toastTimeout.current = setTimeout(() => setToast(null), 3500)
  }

  // Parse subPath for URL-based navigation
  useEffect(() => {
    if (skipNextSubPathParse.current) { skipNextSubPathParse.current = false; return }
    if (!subPath) { setView({ type: 'home' }); return }
    const parts = subPath.split('/')
    if (parts[0] === 'family' && parts[1]) setView({ type: 'family', familyId: parts[1] })
    else if (parts[0] === 'category' && parts[1] && parts[2]) setView({ type: 'category', familyId: parts[1], categoryId: parts[2], categoryName: '', breadcrumb: [{ id: '', code: parts[2], name: '' }] })
    else if (parts[0] === 'product' && parts[1]) setView({ type: 'product', productId: parts[1] })
    else if (parts[0] === 'search' && parts[1]) { setView({ type: 'search', query: decodeURIComponent(parts[1]) }); setSearchInput(decodeURIComponent(parts[1])) }
    else if (parts[0] === 'favorites') setView({ type: 'favorites', groupId: parts[1] })
    else setView({ type: 'home' })
  }, [subPath])

  const goHome = () => navigate ? navigate('/produits') : setView({ type: 'home' })
  const goFamily = (fid: string) => navigate ? navigate(`/produits/family/${fid}`) : setView({ type: 'family', familyId: fid })
  const goCategory = (fid: string, cid: string, cname: string, breadcrumb?: BreadcrumbItem[]) => {
    const bc = breadcrumb || [{ id: '', code: cid, name: cname }]
    setView({ type: 'category', familyId: fid, categoryId: cid, categoryName: cname, breadcrumb: bc })
    if (navigate) { skipNextSubPathParse.current = true; navigate(`/produits/category/${fid}/${cid}`) }
  }
  const goProduct = (pid: string) => { prevViewRef.current = view; navigate ? navigate(`/produits/product/${pid}`) : setView({ type: 'product', productId: pid }) }
  const goSearch = (q: string) => { if (!q.trim()) return; navigate ? navigate(`/produits/search/${encodeURIComponent(q)}`) : setView({ type: 'search', query: q }) }
  const goFavorites = () => navigate ? navigate('/produits/favorites') : setView({ type: 'favorites' })
  const goFavoriteGroup = (groupId: string) => navigate ? navigate(`/produits/favorites/${groupId}`) : setView({ type: 'favorites', groupId })

  const goBack = () => {
    if (view.type === 'family') return goHome()
    if (view.type === 'category') {
      // Pop the last breadcrumb level
      if (view.breadcrumb.length > 1) {
        const parentBc = view.breadcrumb.slice(0, -1)
        const parent = parentBc[parentBc.length - 1]
        return goCategory(view.familyId, parent.code, parent.name, parentBc)
      }
      return goFamily(view.familyId)
    }
    if (view.type === 'search') return goHome()
    if (view.type === 'favorites') return goHome()
    if (view.type === 'product') {
      const prev = prevViewRef.current
      if (prev.type === 'category') return goCategory(prev.familyId, prev.categoryId, prev.categoryName, prev.breadcrumb)
      if (prev.type === 'search') return goSearch(prev.query)
      if (prev.type === 'favorites') return prev.groupId ? goFavoriteGroup(prev.groupId) : goFavorites()
    }
    goHome()
  }

  const periodParams = period ? `periodType=${period.type}&periodValue=${period.value}` : ''

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); goSearch(searchInput) }

  return (
    <div className="space-y-6">
      {/* Title — only on home */}
      {view.type === 'home' && (
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Catalogue Produits</h2>
          <p className="text-zinc-400">Explorez les produits par famille, recherchez dans le PIM et suivez vos favoris</p>
        </div>
      )}

      {/* Search Bar — always visible */}
      <div className="flex items-center gap-3">
        {view.type !== 'home' && (
          <button onClick={goBack} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition"><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>
        )}
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-0 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition">
          <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
            <Search className="w-5 h-5 text-zinc-500" />
          </div>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher un produit (nom, référence, couleur...)"
            className="flex-1 bg-transparent pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none"
          />
        </form>
        <button onClick={goFavorites} className={`p-3 rounded-xl border transition ${view.type === 'favorites' ? 'bg-pink-500/20 border-pink-500/30 text-pink-400' : 'bg-zinc-800 border-zinc-700/50 text-zinc-400 hover:text-pink-400 hover:border-pink-500/30'}`}>
          <Heart className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={view.type + ('familyId' in view ? view.familyId : '') + ('categoryId' in view ? view.categoryId : '') + ('productId' in view ? view.productId : '') + ('query' in view ? view.query : '')}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          
          {view.type === 'home' && <HomeView goFamily={goFamily} goSearch={goSearch} goFavorites={goFavorites} goFavoriteGroup={goFavoriteGroup} />}
          {view.type === 'family' && <FamilyView familyId={view.familyId} goCategory={goCategory} goHome={goHome} />}
          {view.type === 'category' && <CategoryView familyId={view.familyId} categoryId={view.categoryId} categoryName={view.categoryName} breadcrumb={view.breadcrumb} goProduct={goProduct} goFamily={goFamily} goCategory={goCategory} goHome={goHome} periodParams={periodParams} showToast={showToast} />}
          {view.type === 'product' && <ProductDetailView productId={view.productId} goBack={goBack} prevView={prevViewRef.current} goHome={goHome} goFamily={goFamily} goCategory={goCategory} periodParams={periodParams} />}
          {view.type === 'search' && <SearchResultsView query={view.query} goProduct={goProduct} goHome={goHome} periodParams={periodParams} showToast={showToast} />}
          {view.type === 'favorites' && <FavoritesView goProduct={goProduct} periodParams={periodParams} goFavorites={goFavorites} initialGroupId={view.groupId} />}
        </motion.div>
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-red-600 border-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <Heart className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOME VIEW — 3 Family Blocks
// ═══════════════════════════════════════════════════════════════
function HomeView({ goFamily, goSearch, goFavorites, goFavoriteGroup }: { goFamily: (id: string) => void; goSearch: (q: string) => void; goFavorites: () => void; goFavoriteGroup: (groupId: string) => void }) {
  const [favGroups, setFavGroups] = useState<FavoriteGroup[]>([])

  useEffect(() => {
    cachedFetch('/api/products/favorites').then(d => setFavGroups(d.groups || [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      {/* 3 Family Cards — Bento Grid asymétrique */}
      <div className="flex gap-3" style={{ height: 340 }}>
        {/* Mur — grande carte à gauche, pleine hauteur */}
        {(() => {
          const f = FAMILIES[0]
          const Icon = f.icon
          return (
            <motion.button
              key={f.id}
              onClick={() => goFamily(f.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex-1 rounded-2xl overflow-hidden group cursor-pointer ring-1 ring-white/10 hover:ring-white/20 transition-all text-left"
            >
              <img src={f.image} alt={f.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.15) 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-5 h-5 ${f.textColor}`} />
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{f.name}</h3>
                </div>
                <p style={{ fontSize: 13, color: '#d4d4d8' }}>{f.subtitle}</p>
              </div>
            </motion.button>
          )
        })()}
        {/* Sol & Ameublement — empilés à droite */}
        <div className="flex flex-col gap-3 flex-1">
          {FAMILIES.slice(1).map(f => {
            const Icon = f.icon
            return (
              <motion.button
                key={f.id}
                onClick={() => goFamily(f.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative flex-1 rounded-2xl overflow-hidden group cursor-pointer ring-1 ring-white/10 hover:ring-white/20 transition-all text-left"
              >
                <img src={f.image} alt={f.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} className="group-hover:scale-105 transition-transform duration-700" />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className={`w-4 h-4 ${f.textColor}`} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{f.name}</h3>
                  </div>
                  <p style={{ fontSize: 12, color: '#d4d4d8' }}>{f.subtitle}</p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Quick search suggestions */}
      <div className="flex flex-wrap gap-2 justify-center">
        {['Papier peint', 'PVC', 'Moquette', 'Rideau', 'Tapis', 'Peinture'].map(q => (
          <button key={q} onClick={() => goSearch(q)}
            className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-full text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition">
            {q}
          </button>
        ))}
      </div>

      {/* Favorites section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" /> Vos favoris
          </h3>
          <button onClick={goFavorites} className="text-sm text-pink-400 hover:text-pink-300 transition flex items-center gap-1">
            Gérer <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {favGroups.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-8 text-center">
            <Heart className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">Aucun groupe de favoris créé</p>
            <p className="text-zinc-600 text-xs mt-1">Sélectionnez des produits dans une catégorie pour créer un groupe</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favGroups.map(g => (
              <button key={g.id} onClick={() => goFavoriteGroup(g.id)}
                className="flex items-center gap-3 p-4 bg-zinc-900/40 border border-pink-500/20 rounded-xl hover:border-pink-500/40 hover:bg-pink-500/5 transition text-left group">
                <Star className="w-5 h-5 text-pink-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{g.name}</p>
                  <p className="text-zinc-500 text-xs">{g.itemCount} produits</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-pink-400 transition" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FAMILY VIEW — Sub-categories list for a family
// ═══════════════════════════════════════════════════════════════
function FamilyView({ familyId, goCategory, goHome }: { familyId: string; goCategory: (fid: string, cid: string, cname: string, bc?: BreadcrumbItem[]) => void; goHome: () => void }) {
  const [categories, setCategories] = useState<PimCategory[]>([])
  const [loading, setLoading] = useState(true)
  const family = FAMILIES.find(f => f.id === familyId)

  useEffect(() => {
    if (!family) return
    setLoading(true)
    cachedFetch(`/api/products/categories?parentId=${family.categoryId}`)
      .then(d => setCategories(d.categories || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [family?.categoryId])

  if (!family) return <div className="text-zinc-500">Famille non trouvée</div>

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <button onClick={goHome} className="hover:text-white transition">Produits</button>
        <ChevronRight className="w-3 h-3" />
        <span className={`font-semibold ${family.textColor}`}>{family.name}</span>
        <span className="text-zinc-600 ml-1">— {categories.length} sous-catégories</span>
      </div>

      {/* Categories grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`flex items-center gap-4 p-5 bg-zinc-900/60 border border-zinc-800/50 rounded-xl skel-breath skel-d${(i%4)+1}`}>
              <div className="w-12 h-12 bg-zinc-800 rounded-xl" />
              <div className="flex-1"><div className="h-4 w-28 bg-zinc-800 rounded mb-1.5" /><div className="h-3 w-16 bg-zinc-800/50 rounded" /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <motion.button
              key={cat.id}
              onClick={() => goCategory(familyId, cat.code, cat.name, [{ id: cat.id, code: cat.code, name: cat.name }])}
              whileHover={{ scale: 1.01 }}
              className={`flex items-center gap-4 p-5 bg-zinc-900/60 border ${family.borderColor} rounded-xl ${family.hoverBorder} ${family.hoverBg} transition-all text-left group`}
            >
              <div className={`w-12 h-12 rounded-xl ${family.iconBg} flex items-center justify-center`}>
                <FolderOpen className={`w-6 h-6 ${family.textColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{cat.name}</p>
                <p className="text-zinc-500 text-sm">{cat.productCount} produits</p>
              </div>
              <ChevronRight className={`w-5 h-5 text-zinc-600 group-hover:${family.textColor} transition`} />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY VIEW — Recursive: sub-categories OR product list
// ═══════════════════════════════════════════════════════════════
function CategoryView({ familyId, categoryId, categoryName, breadcrumb, goProduct, goFamily, goCategory, goHome, periodParams, showToast }: {
  familyId: string; categoryId: string; categoryName: string; breadcrumb: BreadcrumbItem[];
  goProduct: (pid: string) => void; goFamily: (fid: string) => void;
  goCategory: (fid: string, cid: string, cname: string, bc?: BreadcrumbItem[]) => void;
  goHome: () => void; periodParams: string; showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [subCategories, setSubCategories] = useState<PimCategory[]>([])
  const [hasChildren, setHasChildren] = useState<boolean | null>(null) // null = loading
  const [products, setProducts] = useState<PimProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Record<string, ProductStats>>({})
  const [sortBy, setSortBy] = useState<'name' | 'ca' | 'tickets'>('ca')
  const [catName, setCatName] = useState(categoryName)
  const [categoryStats, setCategoryStats] = useState<any>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [favGroups, setFavGroups] = useState<FavoriteGroup[]>([])
  const [showFavDropdown, setShowFavDropdown] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectingAll, setSelectingAll] = useState(false)
  const [allProductIds, setAllProductIds] = useState<string[]>([])
  const family = FAMILIES.find(f => f.id === familyId)
  const PAGE_SIZE = 50

  // Find the PIM category ID for this code from the breadcrumb
  const currentCatId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : ''

  // Step 1: Check if this category has sub-categories
  useEffect(() => {
    setLoading(true)
    setHasChildren(null)
    setSubCategories([])
    setProducts([])
    setPage(0)
    setCategoryStats(null)
    setAllProductIds([])
    setSelected(new Set())

    if (currentCatId) {
      // We have the PIM UUID — fetch children directly
      cachedFetch(`/api/products/categories?parentId=${currentCatId}`)
        .then(d => {
          const cats = d.categories || []
          if (cats.length > 0) {
            setSubCategories(cats)
            setHasChildren(true)
            setLoading(false)
          } else {
            setHasChildren(false)
            // Will trigger product loading via the other useEffect
          }
        })
        .catch(() => { setHasChildren(false) })
    } else {
      // No UUID — this is a leaf category, load products
      setHasChildren(false)
    }
  }, [categoryId, currentCatId])

  // Step 2: Load products (only if no children)
  useEffect(() => {
    if (hasChildren !== false) return
    setLoading(true)
    cachedFetch('/api/products/list', {
      method: 'POST',
      body: JSON.stringify({ categoryCode: categoryId, start: page * PAGE_SIZE, length: PAGE_SIZE, sortBy: 'uniq_id', orderBy: 'ASC' })
    }).then(d => {
      setProducts(d.products || [])
      setTotal(d.total || 0)
      if (!catName && d.products?.[0]?.categories?.length) {
        const cat = d.products[0].categories.find((c: any) => c.id === categoryId)
        if (cat) setCatName(cat.name)
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [categoryId, page, hasChildren])

  // Load ALL product IDs for category-level stats (only for leaf categories)
  useEffect(() => {
    if (hasChildren !== false) return
    let cancelled = false
    ;(async () => {
      const firstPage = await cachedFetch('/api/products/list', {
        method: 'POST',
        body: JSON.stringify({ categoryCode: categoryId, start: 0, length: 200, sortBy: 'uniq_id', orderBy: 'ASC' })
      })
      const allIds: string[] = (firstPage.products || []).map((p: any) => p.id)
      const t = firstPage.total || 0
      for (let s = 200; s < t; s += 200) {
        const d = await cachedFetch('/api/products/list', {
          method: 'POST',
          body: JSON.stringify({ categoryCode: categoryId, start: s, length: 200, sortBy: 'uniq_id', orderBy: 'ASC' })
        })
        const prods = d.products || []
        allIds.push(...prods.map((p: any) => p.id))
        if (prods.length < 200) break
      }
      if (!cancelled) setAllProductIds(allIds)
    })()
    return () => { cancelled = true }
  }, [categoryId, hasChildren])

  // Load stats for displayed products
  useEffect(() => {
    if (!products.length) return
    const ids = products.map(p => p.id).join(',')
    cachedFetch(`/api/products/stats?ids=${ids}&${periodParams}`)
      .then(d => setStats(d.stats || {}))
      .catch(console.error)
  }, [products, periodParams])

  // Load category-level stats (uses ALL product IDs)
  useEffect(() => {
    if (!allProductIds.length) return
    cachedFetch(`/api/products/stats/category?${periodParams}`, {
      method: 'POST',
      body: JSON.stringify({ productIds: allProductIds })
    }).then(d => setCategoryStats(d)).catch(console.error)
  }, [allProductIds, periodParams])

  // Sort products
  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    const sa = stats[a.id], sb = stats[b.id]
    if (sortBy === 'ca') return (sb?.ca || 0) - (sa?.ca || 0)
    return (sb?.nbTickets || 0) - (sa?.nbTickets || 0)
  })

  // Load fav groups for selection
  useEffect(() => {
    cachedFetch('/api/products/favorites').then(d => setFavGroups(d.groups || [])).catch(() => {})
  }, [])

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = async () => {
    if (allProductIds.length) { setSelected(new Set(allProductIds)); return }
    setSelectingAll(true)
    try {
      const allIds: string[] = []
      for (let s = 0; s < (total || 10000); s += 200) {
        const d = await cachedFetch('/api/products/list', {
          method: 'POST',
          body: JSON.stringify({ categoryCode: categoryId, start: s, length: 200, sortBy: 'uniq_id', orderBy: 'ASC' })
        })
        const prods = d.products || []
        allIds.push(...prods.map((p: any) => p.id))
        if (prods.length < 200) break
      }
      setAllProductIds(allIds)
      setSelected(new Set(allIds))
    } catch (e) { console.error(e) }
    setSelectingAll(false)
  }
  const deselectAll = () => setSelected(new Set())
  const addSelectionToGroup = async (groupId: string, groupName?: string) => {
    const count = selected.size
    await fetchApi(`/api/products/favorites/${groupId}/items`, { method: 'POST', body: JSON.stringify({ productIds: Array.from(selected) }) })
    invalidateCache('favorites')
    const name = groupName || favGroups.find(g => g.id === groupId)?.name || 'Favoris'
    showToast(`${count} produit${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} à « ${name} »`)
    setShowFavDropdown(false)
    setSelected(new Set())
    cachedFetch('/api/products/favorites').then(d => setFavGroups(d.groups || [])).catch(() => {})
  }
  const createGroupAndAdd = async () => {
    if (!newGroupName.trim()) return
    const name = newGroupName.trim()
    const res = await fetchApi('/api/products/favorites', { method: 'POST', body: JSON.stringify({ name }) })
    invalidateCache('favorites')
    if (res.group) await addSelectionToGroup(res.group.id, name)
    setNewGroupName('')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Navigate into a sub-category
  const goSubCategory = (cat: PimCategory) => {
    const newBc = [...breadcrumb, { id: cat.id, code: cat.code, name: cat.name }]
    goCategory(familyId, cat.code, cat.name, newBc)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 flex-wrap">
        <button onClick={goHome} className="hover:text-white transition">Produits</button>
        <ChevronRight className="w-3 h-3" />
        <button onClick={() => goFamily(familyId)} className={`hover:text-white transition ${family?.textColor || ''}`}>{family?.name}</button>
        {breadcrumb.map((bc, i) => {
          const isLast = i === breadcrumb.length - 1
          return (
            <span key={bc.code} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              {isLast ? (
                <span className="text-zinc-300">{bc.name || catName || 'Catégorie'}</span>
              ) : (
                <button onClick={() => goCategory(familyId, bc.code, bc.name, breadcrumb.slice(0, i + 1))} className="hover:text-white transition">{bc.name}</button>
              )}
            </span>
          )
        })}
        {breadcrumb.length === 0 && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-300">{catName || 'Catégorie'}</span>
          </>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`flex items-center gap-4 p-5 bg-zinc-900/60 border border-zinc-800/50 rounded-xl skel-breath skel-d${(i%4)+1}`}>
              <div className="w-12 h-12 bg-zinc-800 rounded-xl" />
              <div className="flex-1"><div className="h-4 w-28 bg-zinc-800 rounded mb-1.5" /><div className="h-3 w-16 bg-zinc-800/50 rounded" /></div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-CATEGORIES MODE */}
      {!loading && hasChildren && (
        <div className="space-y-4">
          <p className="text-zinc-500 text-sm">{subCategories.length} sous-catégories</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subCategories.map(cat => (
              <motion.button
                key={cat.id}
                onClick={() => goSubCategory(cat)}
                whileHover={{ scale: 1.01 }}
                className={`flex items-center gap-4 p-5 bg-zinc-900/60 border ${family?.borderColor || 'border-zinc-700/50'} rounded-xl ${family?.hoverBorder || ''} ${family?.hoverBg || ''} transition-all text-left group`}
              >
                <div className={`w-12 h-12 rounded-xl ${family?.iconBg || 'bg-zinc-800'} flex items-center justify-center`}>
                  <FolderOpen className={`w-6 h-6 ${family?.textColor || 'text-zinc-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{cat.name}</p>
                  <p className="text-zinc-500 text-sm">{cat.productCount} produits</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCTS MODE (leaf category) */}
      {!loading && hasChildren === false && (
        <>
          {/* Category KPIs */}
          {categoryStats?.kpi && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard icon={<TrendingUp className="w-5 h-5" />} label="CA Total" value={fmtCA(categoryStats.kpi.ca)} color="text-emerald-400" />
              <KPICard icon={<ShoppingCart className="w-5 h-5" />} label="Tickets" value={fmtNum(categoryStats.kpi.nbTickets)} color="text-blue-400" />
              <KPICard icon={<Package className="w-5 h-5" />} label="Produits vendus" value={String(categoryStats.kpi.nbProduitsVendus)} color="text-amber-400" />
              <KPICard icon={<Users className="w-5 h-5" />} label="Clients" value={fmtNum(categoryStats.kpi.nbClients)} color="text-purple-400" />
            </div>
          )}

          {/* Category evolution chart */}
          {categoryStats?.evolution?.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Évolution du CA</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryStats.evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => fmtCA(v)} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} formatter={(v: number) => [fmtCA(v), 'CA']} />
                  <Bar dataKey="ca" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Selection bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-pink-500/10 border border-pink-500/30 rounded-xl backdrop-blur-sm">
              <span className="text-pink-400 font-medium text-sm">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
              <button onClick={deselectAll} className="text-xs text-zinc-400 hover:text-white transition">Désélectionner</button>
              <div className="flex-1" />
              <div className="relative">
                <button onClick={() => setShowFavDropdown(!showFavDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium transition">
                  <Heart className="w-4 h-4" /> Ajouter aux favoris
                </button>
                {showFavDropdown && (
                  <div className="absolute top-full mt-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl p-2 shadow-xl z-20 min-w-[240px]">
                    {favGroups.map(g => (
                      <button key={g.id} onClick={() => addSelectionToGroup(g.id)}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition">
                        {g.name} <span className="text-zinc-600">({g.itemCount})</span>
                      </button>
                    ))}
                    <div className="border-t border-zinc-800 mt-1 pt-1">
                      <form onSubmit={e => { e.preventDefault(); createGroupAndAdd() }} className="flex gap-2 px-2 py-1">
                        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nouveau groupe..."
                          className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500" />
                        <button type="submit" className="text-pink-400 hover:text-pink-300"><Plus className="w-4 h-4" /></button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sort + Count + Select all */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-zinc-500 text-sm">{total} produits</p>
              <button onClick={selected.size >= total ? deselectAll : selectAll} disabled={selectingAll}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1 disabled:opacity-50">
                {selectingAll ? <span className="w-3.5 h-3.5 rounded-full bg-zinc-600 skel-breath" /> : selected.size >= total ? <MinusSquare className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selectingAll ? 'Sélection en cours...' : selected.size >= total ? 'Tout désélectionner' : `Tout sélectionner (${total})`}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">Trier:</span>
              {(['ca', 'tickets', 'name'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === s ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                  {s === 'ca' ? 'CA' : s === 'tickets' ? 'Tickets' : 'Nom'}
                </button>
              ))}
            </div>
          </div>

          {/* Products list */}
          <div className="space-y-2">
            {sortedProducts.map(p => {
              const s = stats[p.id]
              const isSel = selected.has(p.id)
              return (
                <div key={p.id} className={`flex items-center gap-4 p-4 bg-zinc-900/40 border rounded-xl transition text-left group ${isSel ? 'border-pink-500/40 bg-pink-500/5' : 'border-zinc-800/50 hover:border-zinc-700'}`}>
                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(p.id) }} className="flex-shrink-0">
                    {isSel ? <CheckSquare className="w-5 h-5 text-pink-400" /> : <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />}
                  </button>
                  <button onClick={() => goProduct(p.id)} className="flex items-center gap-4 flex-1 min-w-0">
                    <ProductThumbnail productId={p.id} size={56} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white font-medium truncate group-hover:text-blue-400 transition">{p.name}</p>
                      <p className="text-zinc-500 text-sm truncate">{p.nameComplement || p.refInterne || p.code}</p>
                      {p.marque && <span className="text-xs text-zinc-600">{p.marque}</span>}
                    </div>
                    {s ? (
                      <div className="text-right space-y-1 flex-shrink-0">
                        <p className="text-emerald-400 font-semibold text-sm">{fmtCA(s.ca)}</p>
                        <p className="text-zinc-500 text-xs">{s.nbTickets} tickets</p>
                      </div>
                    ) : (
                      <div className="text-zinc-700 text-xs">—</div>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-500 text-sm">Page {page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
function ProductDetailView({ productId, goBack, prevView, goHome, goFamily, goCategory, periodParams }: {
  productId: string; goBack: () => void; prevView: ViewState; goHome: () => void;
  goFamily: (fid: string) => void; goCategory: (fid: string, cid: string, cname: string, bc?: BreadcrumbItem[]) => void; periodParams: string
}) {
  const [product, setProduct] = useState<any>(null)
  const [detailStats, setDetailStats] = useState<any>(null)
  const [categoryAvg, setCategoryAvg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [favGroups, setFavGroups] = useState<FavoriteGroup[]>([])
  const [showFavMenu, setShowFavMenu] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      cachedFetch(`/api/products/detail/${productId}`),
      cachedFetch(`/api/products/stats/${productId}?${periodParams}`),
      cachedFetch(`/api/products/stats/${productId}/category-avg`).catch(() => null),
      cachedFetch('/api/products/favorites').catch(() => ({ groups: [] }))
    ]).then(([prod, stats, catAvg, favs]) => {
      setProduct(prod)
      setDetailStats(stats)
      setCategoryAvg(catAvg)
      setFavGroups(favs.groups || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [productId, periodParams])

  const addToFavorites = async (groupId: string) => {
    await fetchApi(`/api/products/favorites/${groupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productIds: [productId] })
    })
    invalidateCache('favorites')
    setShowFavMenu(false)
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 skel-breath">
        <div className="w-[500px] h-[500px] bg-zinc-800/50 rounded-2xl" />
        <div className="flex-1 space-y-4">
          <div className="h-7 w-64 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-40 bg-zinc-800/60 rounded" />
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[0,1,2,3].map(i => <div key={i} className={`rounded-xl p-4 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${i+1}`}><div className="h-3 w-16 bg-zinc-800 rounded mb-2" /><div className="h-5 w-20 bg-zinc-800 rounded" /></div>)}
          </div>
        </div>
      </div>
    </div>
  )
  if (!product) return <div className="text-zinc-500 text-center py-20">Produit introuvable</div>

  const kpi = detailStats?.kpi

  return (
    <div className="space-y-6 fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <button onClick={goHome} className="hover:text-white transition">Produits</button>
        {prevView.type === 'category' && (
          <>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => goFamily(prevView.familyId)} className="hover:text-white transition">
              {FAMILIES.find(f => f.id === prevView.familyId)?.name || 'Famille'}
            </button>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => goCategory(prevView.familyId, prevView.categoryId, prevView.categoryName, prevView.breadcrumb)} className="hover:text-white transition">
              {prevView.categoryName || 'Catégorie'}
            </button>
          </>
        )}
        {prevView.type === 'search' && (
          <>
            <ChevronRight className="w-3 h-3" />
            <button onClick={goBack} className="hover:text-white transition">Recherche « {prevView.query} »</button>
          </>
        )}
        {prevView.type === 'favorites' && (
          <>
            <ChevronRight className="w-3 h-3" />
            <button onClick={goBack} className="hover:text-white transition">Favoris</button>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-300 truncate max-w-xs">{product?.name || productId}</span>
      </div>

      {/* Header */}
      <div className="flex flex-row gap-6">
        {/* Image gallery */}
        <div className="flex-shrink-0" style={{ width: 500 }}>
          <ImageGallery productId={productId} />
        </div>

        {/* Product info */}
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{product.name}</h2>
            {product.nameComplement && <p className="text-zinc-400 mt-1">{product.nameComplement}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {product.famille && <span className="px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs font-medium">{product.famille}</span>}
            {product.categories?.map((c: any) => (
              <span key={c.id} className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-xs">{c.name}</span>
            ))}
          </div>

          {/* Attributes */}
          <div className="grid grid-cols-2 gap-3">
            {product.refInterne && <InfoRow label="Réf. interne" value={product.refInterne} />}
            {product.marque && <InfoRow label="Marque" value={product.marque} />}
            {product.fournisseur && <InfoRow label="Fournisseur" value={product.fournisseur} />}
            {product.fabrication && <InfoRow label="Fabrication" value={product.fabrication} />}
            {product.gammeColoristique && <InfoRow label="Coloris" value={product.gammeColoristique} />}
            {product.composition && <InfoRow label="Composition" value={product.composition} />}
            {product.largeur && <InfoRow label="Largeur" value={product.largeur} />}
            {product.epaisseur && <InfoRow label="Épaisseur" value={product.epaisseur} />}
            {product.destination && <InfoRow label="Destination" value={product.destination} />}
            {product.aspect && <InfoRow label="Aspect" value={product.aspect} />}
            {product.prixVente && <InfoRow label="Prix vente" value={`${product.prixVente} €`} />}
            {product.dateCreation && <InfoRow label="Création" value={product.dateCreation} />}
          </div>

          {/* Favorite button */}
          <div className="relative pt-2">
            <button onClick={() => setShowFavMenu(!showFavMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500/15 border border-pink-500/30 rounded-xl text-pink-400 hover:bg-pink-500/25 transition text-sm">
              <Heart className="w-4 h-4" /> Ajouter aux favoris
            </button>
            {showFavMenu && (
              <div className="absolute top-full mt-2 left-0 bg-zinc-900 border border-zinc-700 rounded-xl p-2 shadow-xl z-20 min-w-[200px]">
                {favGroups.length === 0 ? (
                  <p className="text-zinc-500 text-xs px-3 py-2">Aucun groupe créé. Créez-en un dans Favoris.</p>
                ) : (
                  favGroups.map(g => (
                    <button key={g.id} onClick={() => addToFavorites(g.id)}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition">
                      {g.name} <span className="text-zinc-600">({g.itemCount})</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats KPIs */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard icon={<TrendingUp className="w-5 h-5" />} label="CA Total" value={fmtCA(kpi.ca)} color="text-emerald-400" />
          <KPICard icon={<ShoppingCart className="w-5 h-5" />} label="Tickets" value={fmtNum(kpi.nbTickets)} color="text-blue-400" />
          <KPICard icon={<Package className="w-5 h-5" />} label="Quantité" value={fmtNum(kpi.quantite)} color="text-amber-400" />
          <KPICard icon={<Users className="w-5 h-5" />} label="Clients" value={fmtNum(kpi.nbClients)} color="text-purple-400" />
          <KPICard icon={<Store className="w-5 h-5" />} label="Magasins" value={String(kpi.nbDepots)} color="text-teal-400" />
        </div>
      )}

      {/* Date range */}
      {kpi?.firstSale && (
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <Calendar className="w-4 h-4" />
          <span>1ère vente: <span className="text-zinc-300">{new Date(kpi.firstSale).toLocaleDateString('fr-FR')}</span></span>
          <span>Dernière: <span className="text-zinc-300">{new Date(kpi.lastSale).toLocaleDateString('fr-FR')}</span></span>
        </div>
      )}

      {/* Evolution chart — with category average comparison */}
      {detailStats?.evolution?.length > 0 && (() => {
        const prodEvo = detailStats.evolution as { mois: string; ca: number; nbTickets: number; quantite: number }[]
        const catEvo = categoryAvg?.evolution || []
        const catAvgMap = new Map(catEvo.map((r: any) => [r.mois, r.caAvg]))
        // Find first month CA for indexing (base 100)
        const prodBase = prodEvo[0]?.ca || 1
        const firstMonth = prodEvo[0]?.mois
        const catBase = (catAvgMap.get(firstMonth) as number) || 1
        // Build merged data
        const chartData = prodEvo.map(r => ({
          mois: r.mois,
          ca: r.ca,
          nbTickets: r.nbTickets,
          indexProduit: Math.round((r.ca / prodBase) * 100),
          indexCategorie: catAvgMap.has(r.mois) ? Math.round(((catAvgMap.get(r.mois) as number) / catBase) * 100) : null
        }))
        const hasCatData = chartData.some(d => d.indexCategorie !== null)
        const catLabel = categoryAvg?.sousFamille || categoryAvg?.famille || 'Catégorie'
        return (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-1">Évolution mensuelle</h3>
            {hasCatData && <p className="text-zinc-500 text-xs mb-4">Indice base 100 — comparaison avec la moyenne {catLabel}</p>}
            <ResponsiveContainer width="100%" height={250}>
              {hasCatData ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }}
                    formatter={(v: number, name: string) => [v, name === 'indexProduit' ? 'Ce produit' : name === 'indexCategorie' ? `Moy. ${catLabel}` : name]} />
                  <Line type="monotone" dataKey="indexProduit" stroke="#10b981" strokeWidth={2} dot={false} name="Ce produit" />
                  <Line type="monotone" dataKey="indexCategorie" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" name={`Moy. ${catLabel}`} connectNulls />
                </LineChart>
              ) : (
                <LineChart data={prodEvo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => fmtCA(v)} />
                  <YAxis yAxisId="qty" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }}
                    formatter={(v: number, name: string) => [name === 'ca' ? fmtCA(v) : v, name === 'ca' ? 'CA' : name === 'nbTickets' ? 'Tickets' : 'Quantité']} />
                  <Line yAxisId="ca" type="monotone" dataKey="ca" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line yAxisId="qty" type="monotone" dataKey="nbTickets" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* Per-store breakdown */}
      {detailStats?.stores?.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Répartition par magasin</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={detailStats.stores.slice(0, 8)} dataKey="ca" nameKey="nom" cx="50%" cy="50%" outerRadius={70} innerRadius={30} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine>
                  {detailStats.stores.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} formatter={(v: number) => [fmtCA(v), 'CA']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {detailStats.stores.map((s: any, i: number) => (
                <div key={s.depot} className="flex items-center gap-3 text-sm">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-zinc-300 flex-1 truncate">{s.nom}</span>
                  <span className="text-zinc-400">{fmtCA(s.ca)}</span>
                  <span className="text-zinc-600">{s.nbTickets}t</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top clients */}
      {detailStats?.topClients?.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Top clients</h3>
          <div className="space-y-2">
            {detailStats.topClients.slice(0, 10).map((c: any, i: number) => (
              <div key={c.carte} className="flex items-center gap-3 text-sm px-3 py-2 hover:bg-zinc-800/50 rounded-lg transition">
                <span className="text-zinc-600 w-5">{i + 1}</span>
                <span className="text-zinc-300 flex-1">{c.prenom} {c.nom} <span className="text-zinc-600">({c.carte})</span></span>
                <span className="text-emerald-400 font-medium">{fmtCA(c.ca)}</span>
                <span className="text-zinc-600">{c.nbTickets}t</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SEARCH RESULTS VIEW
// ═══════════════════════════════════════════════════════════════
function SearchResultsView({ query, goProduct, goHome, periodParams, showToast }: { query: string; goProduct: (pid: string) => void; goHome: () => void; periodParams: string; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [products, setProducts] = useState<PimProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Record<string, ProductStats>>({})
  const [sortBy, setSortBy] = useState<'name' | 'ca' | 'tickets'>('ca')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [favGroups, setFavGroups] = useState<FavoriteGroup[]>([])
  const [showFavDropdown, setShowFavDropdown] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectingAll, setSelectingAll] = useState(false)
  const PAGE_SIZE = 50

  useEffect(() => {
    setLoading(true); setPage(0)
    cachedFetch('/api/products/list', {
      method: 'POST',
      body: JSON.stringify({ search: query, start: 0, length: PAGE_SIZE })
    }).then(d => { setProducts(d.products || []); setTotal(d.total || 0) })
      .catch(console.error).finally(() => setLoading(false))
  }, [query])

  useEffect(() => {
    if (page === 0) return
    setLoading(true)
    cachedFetch('/api/products/list', {
      method: 'POST',
      body: JSON.stringify({ search: query, start: page * PAGE_SIZE, length: PAGE_SIZE })
    }).then(d => { setProducts(d.products || []) })
      .catch(console.error).finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    if (!products.length) return
    cachedFetch(`/api/products/stats?ids=${products.map(p => p.id).join(',')}&${periodParams}`)
      .then(d => setStats(prev => ({ ...prev, ...(d.stats || {}) })))
      .catch(console.error)
  }, [products, periodParams])

  useEffect(() => {
    cachedFetch('/api/products/favorites').then(d => setFavGroups(d.groups || [])).catch(() => {})
  }, [])

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    const sa = stats[a.id], sb = stats[b.id]
    if (sortBy === 'ca') return (sb?.ca || 0) - (sa?.ca || 0)
    return (sb?.nbTickets || 0) - (sa?.nbTickets || 0)
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = async () => {
    if (total <= PAGE_SIZE) { setSelected(new Set(sortedProducts.map(p => p.id))); return }
    setSelectingAll(true)
    try {
      const allIds: string[] = []
      for (let s = 0; s < total; s += 200) {
        const d = await cachedFetch('/api/products/list', { method: 'POST', body: JSON.stringify({ search: query, start: s, length: 200 }) })
        const prods = d.products || []
        allIds.push(...prods.map((p: any) => p.id))
        if (prods.length < 200) break
      }
      setSelected(new Set(allIds))
    } catch (e) { console.error(e) }
    setSelectingAll(false)
  }
  const deselectAll = () => setSelected(new Set())
  const addSelectionToGroup = async (groupId: string, groupName?: string) => {
    const count = selected.size
    await fetchApi(`/api/products/favorites/${groupId}/items`, { method: 'POST', body: JSON.stringify({ productIds: Array.from(selected) }) })
    invalidateCache('favorites')
    const name = groupName || favGroups.find(g => g.id === groupId)?.name || 'Favoris'
    showToast(`${count} produit${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} à « ${name} »`)
    setShowFavDropdown(false); setSelected(new Set())
    cachedFetch('/api/products/favorites').then(d => setFavGroups(d.groups || [])).catch(() => {})
  }
  const createGroupAndAdd = async () => {
    if (!newGroupName.trim()) return
    const name = newGroupName.trim()
    const res = await fetchApi('/api/products/favorites', { method: 'POST', body: JSON.stringify({ name }) })
    invalidateCache('favorites')
    if (res.group) await addSelectionToGroup(res.group.id, name)
    setNewGroupName('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Résultats pour « {query} »</h2>
          <p className="text-zinc-500 text-sm">{total} produits trouvés</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">Trier:</span>
          {(['ca', 'tickets', 'name'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === s ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
              {s === 'ca' ? 'CA' : s === 'tickets' ? 'Tickets' : 'Nom'}
            </button>
          ))}
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-pink-500/10 border border-pink-500/30 rounded-xl backdrop-blur-sm">
          <span className="text-pink-400 font-medium text-sm">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <button onClick={deselectAll} className="text-xs text-zinc-400 hover:text-white transition">Désélectionner</button>
          <div className="flex-1" />
          <div className="relative">
            <button onClick={() => setShowFavDropdown(!showFavDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium transition">
              <Heart className="w-4 h-4" /> Ajouter aux favoris
            </button>
            {showFavDropdown && (
              <div className="absolute top-full mt-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl p-2 shadow-xl z-20 min-w-[240px]">
                {favGroups.map(g => (
                  <button key={g.id} onClick={() => addSelectionToGroup(g.id)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition">
                    {g.name} <span className="text-zinc-600">({g.itemCount})</span>
                  </button>
                ))}
                <div className="border-t border-zinc-800 mt-1 pt-1">
                  <form onSubmit={e => { e.preventDefault(); createGroupAndAdd() }} className="flex gap-2 px-2 py-1">
                    <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nouveau groupe..."
                      className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500" />
                    <button type="submit" className="text-pink-400 hover:text-pink-300"><Plus className="w-4 h-4" /></button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Select all */}
      {!loading && products.length > 0 && (
        <button onClick={selected.size >= total ? deselectAll : selectAll} disabled={selectingAll}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
          {selectingAll ? <span className="w-3.5 h-3.5 rounded-full bg-zinc-600 skel-breath" /> : selected.size >= total ? <MinusSquare className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
          {selectingAll ? 'Chargement...' : selected.size >= total ? 'Tout désélectionner' : `Tout sélectionner (${total})`}
        </button>
      )}

      {loading ? (
        <div className="space-y-3 py-4">
          {[0,1,2,3,4].map(i => (
            <div key={i} className={`flex items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl skel-breath skel-d${(i%4)+1}`}>
              <div className="w-14 h-14 bg-zinc-800 rounded-xl" />
              <div className="flex-1"><div className="h-4 w-40 bg-zinc-800 rounded mb-1.5" /><div className="h-3 w-24 bg-zinc-800/50 rounded" /></div>
              <div className="h-4 w-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucun produit trouvé pour « {query} »</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedProducts.map(p => {
            const s = stats[p.id]
            const isSel = selected.has(p.id)
            return (
              <div key={p.id} className={`flex items-center gap-4 p-4 bg-zinc-900/40 border rounded-xl transition text-left group ${isSel ? 'border-pink-500/40 bg-pink-500/5' : 'border-zinc-800/50 hover:border-zinc-700'}`}>
                <button onClick={() => toggleSelect(p.id)} className="flex-shrink-0">
                  {isSel ? <CheckSquare className="w-5 h-5 text-pink-400" /> : <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />}
                </button>
                <button onClick={() => goProduct(p.id)} className="flex items-center gap-4 flex-1 min-w-0">
                  <ProductThumbnail productId={p.id} size={56} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-medium truncate group-hover:text-blue-400 transition">{p.name}</p>
                    <p className="text-zinc-500 text-sm truncate">{p.nameComplement || p.refInterne || p.code}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {p.famille && <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-zinc-500">{p.famille}</span>}
                      {p.categories?.[0] && <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-zinc-500">{p.categories[0].name}</span>}
                    </div>
                  </div>
                  {s ? (
                    <div className="text-right space-y-1 flex-shrink-0">
                      <p className="text-emerald-400 font-semibold text-sm">{fmtCA(s.ca)}</p>
                      <p className="text-zinc-500 text-xs">{s.nbTickets} tickets</p>
                    </div>
                  ) : <div className="text-zinc-700 text-xs">—</div>}
                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-zinc-500 text-sm">Page {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FAVORITES VIEW
// ═══════════════════════════════════════════════════════════════
function FavoritesView({ goProduct, periodParams, goFavorites, initialGroupId }: { goProduct: (pid: string) => void; periodParams: string; goFavorites: () => void; initialGroupId?: string }) {
  const [groups, setGroups] = useState<FavoriteGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [groupItems, setGroupItems] = useState<{ id: string; productId: string; name: string | null }[]>([])
  const [itemsStats, setItemsStats] = useState<Record<string, ProductStats>>({})
  const [categoryStats, setCategoryStats] = useState<any>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'ca' | 'tickets'>('ca')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadGroups = useCallback(() => {
    setLoading(true)
    cachedFetch('/api/products/favorites')
      .then(d => setGroups(d.groups || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  // Auto-open initial group if specified
  useEffect(() => {
    if (initialGroupId && groups.length && !selectedGroup) {
      loadGroupItems(initialGroupId)
    }
  }, [initialGroupId, groups])

  // Re-fetch stats when period changes while a group is open
  useEffect(() => {
    if (!selectedGroup || !groupItems.length) return
    const ids = groupItems.map(i => i.productId)
    Promise.all([
      cachedFetch(`/api/products/stats?ids=${ids.join(',')}&${periodParams}`),
      cachedFetch(`/api/products/stats/category?${periodParams}`, { method: 'POST', body: JSON.stringify({ productIds: ids }) }).catch(() => null)
    ]).then(([statsData, catStatsData]) => {
      setItemsStats(statsData.stats || {})
      setCategoryStats(catStatsData)
    })
  }, [periodParams])

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    await fetchApi('/api/products/favorites', { method: 'POST', body: JSON.stringify({ name: newGroupName.trim() }) })
    invalidateCache('favorites')
    setNewGroupName('')
    loadGroups()
  }

  const deleteGroup = async (id: string) => {
    await fetchApi(`/api/products/favorites/${id}`, { method: 'DELETE' })
    invalidateCache('favorites')
    if (selectedGroup === id) { setSelectedGroup(null); setGroupItems([]); setCategoryStats(null) }
    loadGroups()
  }

  const renameGroup = async (id: string) => {
    if (!editName.trim()) return
    await fetchApi(`/api/products/favorites/${id}`, { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) })
    invalidateCache('favorites')
    setEditingId(null)
    loadGroups()
  }

  const loadGroupItems = async (groupId: string) => {
    setSelectedGroup(groupId)
    setItemsLoading(true)
    setCategoryStats(null)
    setSelected(new Set())
    const data = await cachedFetch(`/api/products/favorites/${groupId}/items`)
    const items = data.items || []
    setGroupItems(items)
    if (items.length) {
      const ids = items.map((i: any) => i.productId)
      const [statsData, catStatsData] = await Promise.all([
        cachedFetch(`/api/products/stats?ids=${ids.join(',')}&${periodParams}`),
        cachedFetch(`/api/products/stats/category?${periodParams}`, { method: 'POST', body: JSON.stringify({ productIds: ids }) }).catch(() => null)
      ])
      setItemsStats(statsData.stats || {})
      setCategoryStats(catStatsData)
    }
    setItemsLoading(false)
  }

  const removeFromGroup = async (groupId: string, productIds: string[]) => {
    await fetchApi(`/api/products/favorites/${groupId}/items`, { method: 'DELETE', body: JSON.stringify({ productIds }) })
    invalidateCache('favorites')
    loadGroupItems(groupId)
    loadGroups()
  }

  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name || ''

  // Sort items
  const sortedItems = [...groupItems].sort((a, b) => {
    if (sortBy === 'name') return (a.name || a.productId).localeCompare(b.name || b.productId)
    const sa = itemsStats[a.productId], sb = itemsStats[b.productId]
    if (sortBy === 'ca') return (sb?.ca || 0) - (sa?.ca || 0)
    return (sb?.nbTickets || 0) - (sa?.nbTickets || 0)
  })

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelected(new Set(groupItems.map(i => i.productId)))
  const deselectAll = () => setSelected(new Set())
  const removeSelected = () => { if (selectedGroup && selected.size) removeFromGroup(selectedGroup, Array.from(selected)); setSelected(new Set()) }

  // ─── Groups list (no group selected) ───
  if (!selectedGroup) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Heart className="w-7 h-7 text-pink-400" /> Mes Favoris
          </h2>
          <p className="text-zinc-500 mt-1">Organisez vos produits en groupes de favoris</p>
        </div>

        <form onSubmit={createGroup} className="flex gap-3">
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
            placeholder="Nom du nouveau groupe..." className="flex-1 px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition" />
          <button type="submit" disabled={!newGroupName.trim()}
            className="px-5 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-30 text-white rounded-xl font-medium flex items-center gap-2 transition">
            <Plus className="w-4 h-4" /> Créer
          </button>
        </form>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0,1,2].map(i => (
              <div key={i} className={`bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-5 skel-breath skel-d${i+1}`}>
                <div className="flex items-center gap-3"><div className="w-6 h-6 bg-zinc-800 rounded" /><div className="flex-1"><div className="h-4 w-28 bg-zinc-800 rounded mb-1" /><div className="h-3 w-16 bg-zinc-800/50 rounded" /></div></div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Aucun groupe créé</p>
            <p className="text-xs mt-1">Sélectionnez des produits dans une catégorie ou une recherche pour créer un groupe</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => (
              <div key={g.id} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl hover:border-pink-500/30 transition">
                <button onClick={() => loadGroupItems(g.id)} className="w-full p-5 text-left">
                  <div className="flex items-center gap-3">
                    <Star className="w-6 h-6 text-pink-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === g.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); renameGroup(g.id) }} className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                            className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-sm" />
                          <button type="submit" className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                        </form>
                      ) : (
                        <>
                          <p className="text-white font-semibold truncate">{g.name}</p>
                          <p className="text-zinc-500 text-sm">{g.itemCount} produits</p>
                        </>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600" />
                  </div>
                </button>
                <div className="flex border-t border-zinc-800/50 divide-x divide-zinc-800/50">
                  <button onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                    className="flex-1 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1"><Edit3 className="w-3 h-3" /> Renommer</button>
                  <button onClick={() => deleteGroup(g.id)}
                    className="flex-1 py-2 text-xs text-zinc-500 hover:text-red-400 transition flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" /> Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Group detail (acts like a category page) ───
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <button onClick={goFavorites} className="hover:text-white transition">Favoris</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-pink-400 font-semibold">{selectedGroupName}</span>
        <span className="text-zinc-600 ml-1">— {groupItems.length} produits</span>
      </div>

      {itemsLoading ? (
        <div className="space-y-3 py-4">
          {[0,1,2,3,4].map(i => (
            <div key={i} className={`flex items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl skel-breath skel-d${(i%4)+1}`}>
              <div className="w-14 h-14 bg-zinc-800 rounded-xl" />
              <div className="flex-1"><div className="h-4 w-40 bg-zinc-800 rounded mb-1.5" /><div className="h-3 w-24 bg-zinc-800/50 rounded" /></div>
              <div className="h-4 w-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : groupItems.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Ce groupe est vide</p>
          <p className="text-xs mt-1">Ajoutez des produits depuis une catégorie ou une recherche</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          {categoryStats?.kpi && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard icon={<TrendingUp className="w-5 h-5" />} label="CA Total" value={fmtCA(categoryStats.kpi.ca)} color="text-emerald-400" />
              <KPICard icon={<ShoppingCart className="w-5 h-5" />} label="Tickets" value={fmtNum(categoryStats.kpi.nbTickets)} color="text-blue-400" />
              <KPICard icon={<Package className="w-5 h-5" />} label="Produits vendus" value={String(categoryStats.kpi.nbProduitsVendus)} color="text-amber-400" />
              <KPICard icon={<Users className="w-5 h-5" />} label="Clients" value={fmtNum(categoryStats.kpi.nbClients)} color="text-purple-400" />
            </div>
          )}

          {/* Evolution chart */}
          {categoryStats?.evolution?.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Évolution du CA</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryStats.evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => fmtCA(v)} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} formatter={(v: number) => [fmtCA(v), 'CA']} />
                  <Bar dataKey="ca" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Selection bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
              <span className="text-red-400 font-medium text-sm">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
              <button onClick={deselectAll} className="text-xs text-zinc-400 hover:text-white transition">Désélectionner</button>
              <div className="flex-1" />
              <button onClick={removeSelected}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition">
                <Trash2 className="w-4 h-4" /> Retirer du groupe
              </button>
            </div>
          )}

          {/* Sort + Select all */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-zinc-500 text-sm">{groupItems.length} produits</p>
              <button onClick={selected.size === groupItems.length ? deselectAll : selectAll}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
                {selected.size === groupItems.length ? <MinusSquare className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selected.size === groupItems.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">Trier:</span>
              {(['ca', 'tickets', 'name'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === s ? 'bg-pink-500/20 text-pink-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                  {s === 'ca' ? 'CA' : s === 'tickets' ? 'Tickets' : 'Nom'}
                </button>
              ))}
            </div>
          </div>

          {/* Product list */}
          <div className="space-y-2">
            {sortedItems.map(item => {
              const s = itemsStats[item.productId]
              const isSel = selected.has(item.productId)
              return (
                <div key={item.id} className={`flex items-center gap-4 p-4 bg-zinc-900/40 border rounded-xl transition text-left group ${isSel ? 'border-pink-500/40 bg-pink-500/5' : 'border-zinc-800/50 hover:border-zinc-700'}`}>
                  <button onClick={() => toggleSelect(item.productId)} className="flex-shrink-0">
                    {isSel ? <CheckSquare className="w-5 h-5 text-pink-400" /> : <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />}
                  </button>
                  <button onClick={() => goProduct(item.productId)} className="flex items-center gap-4 flex-1 min-w-0">
                    <ProductThumbnail productId={item.productId} size={56} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white font-medium truncate group-hover:text-blue-400 transition">{item.name || item.productId}</p>
                      <p className="text-zinc-600 text-xs">{item.productId}</p>
                    </div>
                    {s ? (
                      <div className="text-right space-y-1 flex-shrink-0">
                        <p className="text-emerald-400 font-semibold text-sm">{fmtCA(s.ca)}</p>
                        <p className="text-zinc-500 text-xs">{s.nbTickets} tickets</p>
                      </div>
                    ) : <div className="text-zinc-700 text-xs">—</div>}
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
                  </button>
                  <button onClick={() => removeFromGroup(selectedGroup!, [item.productId])}
                    className="p-2 text-zinc-600 hover:text-red-400 transition flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
        <span className={color}>{icon}</span> {label}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 bg-zinc-800/30 rounded-lg">
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-zinc-300 text-sm font-medium truncate">{value}</p>
    </div>
  )
}
