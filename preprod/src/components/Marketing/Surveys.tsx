import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ClipboardList, Upload, ArrowLeft, X, Download, Trash2, Users, BarChart3, ChevronDown, Filter, PieChart, FileText, AlertCircle, CheckCircle2, Clock, Hash, MessageSquare, Star, TrendingUp, Eye, ChevronRight } from 'lucide-react'
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { trackInteraction, trackFilter, trackExport } from '../../services/tracker'

const API_URL = ''
const CACHE_DURATION = 2 * 60 * 1000

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════
interface SurveySummary {
  id: string
  title: string
  description: string | null
  source_file: string | null
  respondents: number
  question_count: number
  created_at: string
}

interface ActiveFilter {
  questionId: string
  value: string
}

interface Distribution {
  value: string
  count: number
  pct: number
}

interface NPSData {
  score: number
  promoters: { count: number; pct: number }
  passives: { count: number; pct: number }
  detractors: { count: number; pct: number }
}

interface QuestionResult {
  questionId: string
  questionKey: string
  label: string
  shortLabel: string
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'LIKERT' | 'NPS' | 'FREE_TEXT' | 'NUMERIC'
  isGrouped: boolean
  groupLabel: string | null
  options: string[] | null
  totalAnswers: number
  distribution: Distribution[] | null
  nps: NPSData | null
  average: number | null
}

interface SurveyDetail {
  survey: any
  questions: any[]
  results: QuestionResult[]
  timeline: { date: string; count: number }[]
  filteredCount: number
  totalCount: number
  activeFilters: ActiveFilter[]
  rfmStats: { segment: string; count: number }[]
  matchedClientsCount: number
  selectedRfmSegments: string[]
}

// ═══════════════════════════════════════════════════════
// Color Palette
// ═══════════════════════════════════════════════════════
const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
  '#a855f7', '#84cc16', '#0ea5e9', '#f43f5e', '#22d3ee',
]

const LIKERT_COLORS: Record<string, string> = {
  'Excellent': '#10b981',
  'Très satisfaisant': '#34d399',
  'Satisfaisant': '#fbbf24',
  'Correct': '#f97316',
  'Insuffisant': '#ef4444',
  'Tout à fait d\'accord': '#10b981',
  'Plutôt d\'accord': '#34d399',
  'Plutôt pas d\'accord': '#f97316',
  'Pas du tout d\'accord': '#ef4444',
}

const LIKERT_ORDER = [
  'Excellent', 'Très satisfaisant', 'Satisfaisant', 'Correct', 'Insuffisant',
  'Tout à fait d\'accord', 'Plutôt d\'accord', 'Plutôt pas d\'accord', 'Pas du tout d\'accord',
]

const NPS_COLORS = { promoter: '#10b981', passive: '#fbbf24', detractor: '#ef4444' }

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════
export default function Surveys() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [surveys, setSurveys] = useState<SurveySummary[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [searchQuestion, setSearchQuestion] = useState('')
  const [rfmSegments, setRfmSegments] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load survey list ───────────────────────────────
  const loadSurveys = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/surveys`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setSurveys(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSurveys() }, [loadSurveys])

  // ─── Load survey detail ─────────────────────────────
  const loadDetail = useCallback(async (id: string, filters: ActiveFilter[] = [], rfmSegs: string[] = []) => {
    try {
      setDetailLoading(true)
      const filterStr = filters.map(f => `${f.questionId}::${f.value}`).join('||')
      let url = `${API_URL}/api/surveys?id=${id}`
      if (filterStr) url += `&filters=${encodeURIComponent(filterStr)}`
      if (rfmSegs.length > 0) url += `&rfmSegments=${encodeURIComponent(rfmSegs.join(','))}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ─── Open survey ────────────────────────────────────
  const openSurvey = (id: string) => {
    const survey = surveys.find(s => s.id === id)
    trackInteraction('SURVEY_OPEN', 'surveys', { surveyId: id, title: survey?.title })
    setSelectedSurveyId(id)
    setActiveFilters([])
    setRfmSegments([])
    setExpandedQuestions(new Set())
    setCollapsedGroups(new Set())
    setSearchQuestion('')
    setView('detail')
    loadDetail(id)
  }

  // ─── Cross-filter: toggle a filter ──────────────────
  const toggleFilter = (questionId: string, value: string) => {
    const exists = activeFilters.find(f => f.questionId === questionId && f.value === value)
    let next: ActiveFilter[]
    if (exists) {
      next = activeFilters.filter(f => !(f.questionId === questionId && f.value === value))
    } else {
      next = [...activeFilters, { questionId, value }]
    }
    setActiveFilters(next)
    trackFilter('surveys', { questionId, value, action: exists ? 'remove' : 'add', totalFilters: next.length })
    if (selectedSurveyId) loadDetail(selectedSurveyId, next, rfmSegments)
  }

  // ─── Remove one filter ─────────────────────────────
  const removeFilter = (questionId: string, value: string) => {
    const next = activeFilters.filter(f => !(f.questionId === questionId && f.value === value))
    setActiveFilters(next)
    if (selectedSurveyId) loadDetail(selectedSurveyId, next, rfmSegments)
  }

  // ─── Clear all filters ─────────────────────────────
  const clearFilters = () => {
    trackInteraction('CLEAR_ALL_FILTERS', 'surveys')
    setActiveFilters([])
    setRfmSegments([])
    if (selectedSurveyId) loadDetail(selectedSurveyId, [], [])
  }

  // ─── Toggle RFM segment filter ─────────────────────
  const toggleRfmSegment = (segment: string) => {
    const next = rfmSegments.includes(segment)
      ? rfmSegments.filter(s => s !== segment)
      : [...rfmSegments, segment]
    setRfmSegments(next)
    trackFilter('surveys', { rfmSegment: segment, action: rfmSegments.includes(segment) ? 'remove' : 'add', totalRfmFilters: next.length })
    if (selectedSurveyId) loadDetail(selectedSurveyId, activeFilters, next)
  }

  // ─── Clear RFM filters only ────────────────────────
  const clearRfmFilters = () => {
    setRfmSegments([])
    if (selectedSurveyId) loadDetail(selectedSurveyId, activeFilters, [])
  }

  // ─── Delete survey ─────────────────────────────────
  const deleteSurvey = async (id: string) => {
    if (!confirm('Supprimer cette enquête et toutes ses données ?')) return
    try {
      await fetch(`${API_URL}/api/surveys?id=${id}`, { method: 'DELETE' })
      setSurveys(prev => prev.filter(s => s.id !== id))
      if (selectedSurveyId === id) {
        setView('list')
        setSelectedSurveyId(null)
        setDetail(null)
      }
    } catch (err: any) {
      alert('Erreur: ' + err.message)
    }
  }

  // ─── Upload CSV ─────────────────────────────────────
  const handleUpload = async (file: File, title: string, description: string) => {
    try {
      setUploadLoading(true)
      setUploadProgress('Lecture du fichier…')
      
      const text = await file.text()
      setUploadProgress('Envoi au serveur…')
      
      const res = await fetch(`${API_URL}/api/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          csvData: text,
          fileName: file.name,
        }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      
      const result = await res.json()
      setUploadProgress(`Importé ! ${result.respondents} répondants, ${result.questions} questions`)
      
      setTimeout(() => {
        setShowUpload(false)
        setUploadLoading(false)
        setUploadProgress('')
        loadSurveys()
        openSurvey(result.surveyId)
      }, 1500)
    } catch (err: any) {
      setUploadProgress('')
      setUploadLoading(false)
      alert('Erreur import: ' + err.message)
    }
  }

  // ─── Export filtered CSV ────────────────────────────
  const exportCSV = () => {
    if (!selectedSurveyId) return
    trackExport('CSV', 'surveys', { surveyId: selectedSurveyId, filtersCount: activeFilters.length, rfmSegments: rfmSegments.length })
    const filterStr = activeFilters.map(f => `${f.questionId}::${f.value}`).join('||')
    let url = `${API_URL}/api/surveys/export?id=${selectedSurveyId}`
    if (filterStr) url += `&filters=${encodeURIComponent(filterStr)}`
    if (rfmSegments.length > 0) url += `&rfmSegments=${encodeURIComponent(rfmSegments.join(','))}`
    window.open(url, '_blank')
  }

  // ─── Get question label for filter chip ─────────────
  const getQuestionLabel = (questionId: string) => {
    if (!detail) return questionId
    const q = detail.results.find(r => r.questionId === questionId)
    return q?.shortLabel || q?.label || questionId
  }

  // ─── Grouped results ───────────────────────────────
  const groupedResults = useMemo(() => {
    if (!detail) return []
    const groups: { label: string; results: QuestionResult[] }[] = []
    let currentGroup: { label: string; results: QuestionResult[] } | null = null

    // Filter by search
    const filtered = detail.results.filter(r => {
      if (!searchQuestion) return true
      const q = searchQuestion.toLowerCase()
      return r.label.toLowerCase().includes(q) || r.shortLabel?.toLowerCase().includes(q) || r.questionKey.toLowerCase().includes(q)
    })

    let ungroupedBatch: { label: string; results: QuestionResult[] } | null = null

    for (const r of filtered) {
      if (r.isGrouped && r.groupLabel) {
        // Close any open ungrouped batch
        ungroupedBatch = null
        if (!currentGroup || currentGroup.label !== r.groupLabel) {
          currentGroup = { label: r.groupLabel, results: [] }
          groups.push(currentGroup)
        }
        currentGroup.results.push(r)
      } else {
        currentGroup = null
        // Merge consecutive non-grouped questions into one batch
        if (!ungroupedBatch) {
          ungroupedBatch = { label: '', results: [] }
          groups.push(ungroupedBatch)
        }
        ungroupedBatch.results.push(r)
      }
    }
    return groups
  }, [detail, searchQuestion])

  // ═══════════════════════════════════════════════════
  // RENDER: List View
  // ═══════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-violet-400" />
              Enquêtes & Études clients
            </h2>
            <p className="text-zinc-500 mt-1">Analysez les résultats de vos questionnaires avec filtrage croisé</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="min-h-[300px] space-y-4 py-6">
            {[0,1,2].map(i => (
              <div key={i} className={`bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 skel-breath skel-d${i+1}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl" />
                  <div className="flex-1"><div className="h-4 w-40 bg-zinc-800 rounded mb-2" /><div className="h-3 w-24 bg-zinc-800/60 rounded" /></div>
                  <div className="h-6 w-16 bg-zinc-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Survey Cards */}
        {!loading && surveys.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
            <ClipboardList className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-400 mb-2">Aucune enquête</h3>
            <p className="text-zinc-600 mb-6">Importez votre premier fichier CSV d'enquête Google Forms</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Importer une enquête
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {surveys.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-violet-500/30 transition-all cursor-pointer group"
              onClick={() => openSurvey(s.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors truncate">{s.title}</h3>
                  {s.description && <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{s.description}</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSurvey(s.id) }}
                  className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-violet-400">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">{s.respondents}</span>
                  <span className="text-zinc-500">répondants</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Hash className="w-4 h-4" />
                  <span className="font-semibold">{s.question_count}</span>
                  <span className="text-zinc-500">questions</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                {s.source_file && (
                  <div className="flex items-center gap-1.5 text-zinc-600 text-xs truncate max-w-[160px]">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{s.source_file}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <span className="text-xs text-violet-400 group-hover:text-violet-300 flex items-center gap-1">
                  Voir les résultats <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Upload Modal */}
        <AnimatePresence>
          {showUpload && (
            <UploadModal
              onClose={() => { setShowUpload(false); setUploadLoading(false); setUploadProgress('') }}
              onUpload={handleUpload}
              loading={uploadLoading}
              progress={uploadProgress}
              fileInputRef={fileInputRef}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Detail View
  // ═══════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('list'); setSelectedSurveyId(null); setDetail(null); setActiveFilters([]); setRfmSegments([]) }}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{detail?.survey?.title || <span className="inline-block h-6 w-40 bg-zinc-800 rounded-lg skel-breath" />}</h2>
            {detail && (
              <p className="text-zinc-500 text-sm">
                {detail.totalCount} répondants
                {(activeFilters.length > 0 || rfmSegments.length > 0) && (
                  <span className="text-violet-400 ml-1">
                    → {detail.filteredCount} filtrés ({Math.round((detail.filteredCount / detail.totalCount) * 100)}%)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Active Filters Bar */}
      <AnimatePresence>
        {(activeFilters.length > 0 || rfmSegments.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="text-xs text-violet-400 font-semibold uppercase">Filtres actifs :</span>
              {rfmSegments.map((seg) => (
                <motion.span
                  key={`rfm-${seg}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium"
                >
                  <span className="text-emerald-500 text-[10px]">Segment RFM</span>
                  <span className="text-emerald-200">=</span>
                  <span>{seg}</span>
                  <button
                    onClick={() => toggleRfmSegment(seg)}
                    className="ml-0.5 p-0.5 hover:bg-emerald-500/30 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
              {activeFilters.map((f, i) => (
                <motion.span
                  key={`${f.questionId}-${f.value}-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/20 text-violet-300 rounded-lg text-xs font-medium"
                >
                  <span className="text-violet-500 text-[10px]">{getQuestionLabel(f.questionId)}</span>
                  <span className="text-violet-200">=</span>
                  <span className="max-w-[200px] truncate">{f.value}</span>
                  <button
                    onClick={() => removeFilter(f.questionId, f.value)}
                    className="ml-0.5 p-0.5 hover:bg-violet-500/30 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors ml-2"
              >
                Tout effacer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RFM Segment Filter */}
      {detail && detail.rfmStats && detail.rfmStats.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Segmentation RFM</span>
              <span className="text-xs text-zinc-600">
                ({detail.matchedClientsCount} répondants encartés sur {detail.totalCount})
              </span>
            </div>
            {rfmSegments.length > 0 && (
              <button
                onClick={clearRfmFilters}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.rfmStats.map(({ segment, count }) => {
              const isActive = rfmSegments.includes(segment)
              const segmentColors: Record<string, string> = {
                'Champions': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                'Ultra Champions': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                'Loyaux': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                'Nouveaux': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                'Occasionnels': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                'À Risque': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                'Perdus': 'bg-red-500/20 text-red-300 border-red-500/30',
              }
              const colorClass = segmentColors[segment] || 'bg-zinc-700/50 text-zinc-300 border-zinc-600/50'
              return (
                <button
                  key={segment}
                  onClick={() => toggleRfmSegment(segment)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    isActive
                      ? colorClass + ' ring-1 ring-white/30 shadow-lg'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  <span>{segment}</span>
                  <span className={`tabular-nums ${isActive ? 'opacity-90' : 'text-zinc-600'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick stats */}
      {detail && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              Répondants
            </div>
            <div className="text-2xl font-bold text-white">{detail.filteredCount}</div>
            {(activeFilters.length > 0 || rfmSegments.length > 0) && (
              <div className="text-xs text-zinc-600">sur {detail.totalCount}</div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Hash className="w-3.5 h-3.5" />
              Questions
            </div>
            <div className="text-2xl font-bold text-white">{detail.results.length}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Filter className="w-3.5 h-3.5" />
              Filtres actifs
            </div>
            <div className="text-2xl font-bold text-violet-400">{activeFilters.length + rfmSegments.length}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Taux complétion
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {detail.results.length > 0
                ? Math.round((detail.results.reduce((s, r) => s + r.totalAnswers, 0) / (detail.results.length * detail.filteredCount)) * 100)
                : 0}%
            </div>
          </div>
        </div>
      )}

      {/* Search questions */}
      {detail && (
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher une question…"
            value={searchQuestion}
            onChange={e => setSearchQuestion(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none transition-colors"
          />
          {searchQuestion && (
            <button onClick={() => setSearchQuestion('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {detail && (
        <div className={`transition-opacity duration-200 ${detailLoading ? 'opacity-50' : ''}`}>
        <div className="space-y-4">
          {groupedResults.map((group, gi) => (
            <div key={gi}>
              {/* Group header */}
              {group.label && (
                <button
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    next.has(group.label) ? next.delete(group.label) : next.add(group.label)
                    return next
                  })}
                  className="w-full flex items-center gap-2 mb-3 mt-6 group cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${collapsedGroups.has(group.label) ? '-rotate-90' : ''}`} />
                  <span className="text-sm font-semibold text-violet-400">{group.label}</span>
                  <span className="text-xs text-zinc-600">({group.results.length} sous-questions)</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </button>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {!collapsedGroups.has(group.label) && group.results.map(result => (
                  <QuestionCard
                    key={result.questionId}
                    result={result}
                    activeFilters={activeFilters}
                    onFilter={toggleFilter}
                    expanded={expandedQuestions.has(result.questionId)}
                    onToggleExpand={() => setExpandedQuestions(prev => {
                      const next = new Set(prev)
                      next.has(result.questionId) ? next.delete(result.questionId) : next.add(result.questionId)
                      return next
                    })}
                    filteredCount={detail.filteredCount}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Question Card Component
// ═══════════════════════════════════════════════════════
function QuestionCard({
  result, activeFilters, onFilter, expanded, onToggleExpand, filteredCount
}: {
  result: QuestionResult
  activeFilters: ActiveFilter[]
  onFilter: (qId: string, value: string) => void
  expanded: boolean
  onToggleExpand: () => void
  filteredCount: number
}) {
  const isFiltered = activeFilters.some(f => f.questionId === result.questionId)
  const typeIcon = {
    SINGLE_CHOICE: <PieChart className="w-4 h-4" />,
    MULTIPLE_CHOICE: <BarChart3 className="w-4 h-4" />,
    LIKERT: <Star className="w-4 h-4" />,
    NPS: <TrendingUp className="w-4 h-4" />,
    FREE_TEXT: <MessageSquare className="w-4 h-4" />,
    NUMERIC: <Hash className="w-4 h-4" />,
  }
  const typeLabel = {
    SINGLE_CHOICE: 'Choix unique',
    MULTIPLE_CHOICE: 'Choix multiple',
    LIKERT: 'Échelle',
    NPS: 'NPS',
    FREE_TEXT: 'Texte libre',
    NUMERIC: 'Numérique',
  }

  const topN = expanded ? result.distribution : result.distribution?.slice(0, 8)
  const hasMore = (result.distribution?.length || 0) > 8

  return (
    <div className={`bg-zinc-900 border rounded-2xl p-5 transition-all ${isFiltered ? 'border-violet-500/40 bg-violet-500/5' : 'border-zinc-800'}`}>
      {/* Question header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-zinc-600">{result.questionKey}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
              result.type === 'NPS' ? 'bg-emerald-500/10 text-emerald-400' :
              result.type === 'LIKERT' ? 'bg-amber-500/10 text-amber-400' :
              result.type === 'MULTIPLE_CHOICE' ? 'bg-pink-500/10 text-pink-400' :
              result.type === 'FREE_TEXT' ? 'bg-zinc-500/10 text-zinc-400' :
              'bg-blue-500/10 text-blue-400'
            }`}>
              {typeIcon[result.type]}
              {typeLabel[result.type]}
            </span>
            {isFiltered && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/20 text-violet-300">
                FILTRE ACTIF
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white leading-snug">{result.shortLabel || result.label}</h4>
          {result.shortLabel && result.shortLabel !== result.label && (
            <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{result.label}</p>
          )}
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <div className="text-lg font-bold text-white">{result.totalAnswers}</div>
          <div className="text-[10px] text-zinc-600">réponses</div>
        </div>
      </div>

      {/* NPS specific */}
      {result.type === 'NPS' && result.nps && (
        <NPSDisplay nps={result.nps} average={result.average} distribution={result.distribution} onFilter={onFilter} questionId={result.questionId} activeFilters={activeFilters} />
      )}

      {/* Likert specific */}
      {result.type === 'LIKERT' && result.distribution && (
        <LikertDisplay distribution={result.distribution} onFilter={onFilter} questionId={result.questionId} activeFilters={activeFilters} totalAnswers={result.totalAnswers} />
      )}

      {/* Single / Multiple choice */}
      {(result.type === 'SINGLE_CHOICE' || result.type === 'MULTIPLE_CHOICE') && topN && (
        <div className="space-y-3">
          {/* Chart + bars side by side */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Pie chart for single choice with <= 8 options */}
            {result.type === 'SINGLE_CHOICE' && (result.distribution?.length || 0) <= 10 && (
              <div className="w-full lg:w-1/3 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie
                      data={result.distribution?.slice(0, 8) || []}
                      dataKey="count"
                      nameKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={35}
                      paddingAngle={2}
                      stroke="transparent"
                    >
                      {result.distribution?.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [`${value} (${Math.round((value / result.totalAnswers) * 100)}%)`, name]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bars */}
            <div className="flex-1 space-y-1.5">
              {topN.map((d, i) => {
                const isActive = activeFilters.some(f => f.questionId === result.questionId && f.value === d.value)
                return (
                  <button
                    key={d.value}
                    onClick={() => onFilter(result.questionId, d.value)}
                    className={`w-full text-left group transition-all rounded-lg p-1.5 ${
                      isActive ? 'bg-violet-500/15 ring-1 ring-violet-500/30' : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className={`truncate max-w-[70%] ${isActive ? 'text-violet-300 font-semibold' : 'text-zinc-300'}`}>
                        {d.value}
                      </span>
                      <span className="text-zinc-500 ml-2 flex-shrink-0">
                        <span className="font-semibold text-zinc-300">{d.count}</span> ({d.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${d.pct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.03 }}
                        className={`h-full rounded-full ${isActive ? 'bg-violet-500' : ''}`}
                        style={!isActive ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Show more / less */}
          {hasMore && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors mt-1"
            >
              <Eye className="w-3 h-3" />
              {expanded ? 'Voir moins' : `Voir les ${result.distribution!.length - 8} autres réponses`}
            </button>
          )}

          {/* Clickable hint */}
          <p className="text-[10px] text-zinc-600 mt-2">
            💡 Cliquez sur une réponse pour filtrer les résultats des autres questions
          </p>
        </div>
      )}

      {/* Free text */}
      {result.type === 'FREE_TEXT' && result.distribution && (
        <div className="space-y-2">
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2">
            {(expanded ? result.distribution : result.distribution.slice(0, 6)).map((d, i) => {
              const isActive = activeFilters.some(f => f.questionId === result.questionId && f.value === d.value)
              return (
                <button
                  key={i}
                  onClick={() => onFilter(result.questionId, d.value)}
                  className={`w-full flex items-start gap-2 text-xs text-left px-2 py-1.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <span className="text-zinc-600 font-mono flex-shrink-0 w-6 text-right">{d.count}×</span>
                  <span className="leading-relaxed">"{d.value}"</span>
                </button>
              )
            })}
          </div>
          {result.distribution.length > 6 && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
            >
              <Eye className="w-3 h-3" />
              {expanded ? 'Réduire' : `Voir tout (${result.distribution.length} réponses uniques)`}
            </button>
          )}
          <p className="text-[10px] text-zinc-600 mt-1">
            💡 Cliquez sur une réponse pour filtrer
          </p>
        </div>
      )}

      {/* Numeric */}
      {result.type === 'NUMERIC' && result.distribution && (
        <div className="space-y-3">
          {result.average !== null && (
            <div className="text-center">
              <span className="text-3xl font-bold text-blue-400">{result.average}</span>
              <span className="text-zinc-500 text-sm ml-2">moyenne</span>
            </div>
          )}
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="value" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// NPS Display Component  
// ═══════════════════════════════════════════════════════
function NPSDisplay({ nps, average, distribution, onFilter, questionId, activeFilters }: {
  nps: NPSData
  average: number | null
  distribution: Distribution[] | null
  onFilter: (qId: string, value: string) => void
  questionId: string
  activeFilters: ActiveFilter[]
}) {
  return (
    <div className="space-y-4">
      {/* NPS Score */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className={`text-5xl font-black ${nps.score >= 50 ? 'text-emerald-400' : nps.score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {nps.score > 0 ? '+' : ''}{nps.score}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Score NPS</div>
        </div>
        {average !== null && (
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">{average}</div>
            <div className="text-xs text-zinc-500 mt-1">Moyenne /10</div>
          </div>
        )}
      </div>

      {/* Promoters / Passives / Detractors */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            // Filter scores 9-10
            distribution?.filter(d => Number(d.value) >= 9).forEach(d => onFilter(questionId, d.value))
          }}
          className={`flex-1 p-3 rounded-xl text-center transition-all ${
            activeFilters.some(f => f.questionId === questionId) ? 'ring-1 ring-emerald-500/30' : ''
          } bg-emerald-500/10 hover:bg-emerald-500/20`}
        >
          <div className="text-lg font-bold text-emerald-400">{nps.promoters.pct}%</div>
          <div className="text-[10px] text-emerald-400/70">Promoteurs ({nps.promoters.count})</div>
        </button>
        <button
          onClick={() => {
            distribution?.filter(d => Number(d.value) >= 7 && Number(d.value) <= 8).forEach(d => onFilter(questionId, d.value))
          }}
          className="flex-1 p-3 rounded-xl text-center bg-amber-500/10 hover:bg-amber-500/20 transition-all"
        >
          <div className="text-lg font-bold text-amber-400">{nps.passives.pct}%</div>
          <div className="text-[10px] text-amber-400/70">Passifs ({nps.passives.count})</div>
        </button>
        <button
          onClick={() => {
            distribution?.filter(d => Number(d.value) <= 6).forEach(d => onFilter(questionId, d.value))
          }}
          className="flex-1 p-3 rounded-xl text-center bg-red-500/10 hover:bg-red-500/20 transition-all"
        >
          <div className="text-lg font-bold text-red-400">{nps.detractors.pct}%</div>
          <div className="text-[10px] text-red-400/70">Détracteurs ({nps.detractors.count})</div>
        </button>
      </div>

      {/* Distribution bar */}
      <div className="h-3 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${nps.promoters.pct}%` }} />
        <div className="bg-amber-500 h-full transition-all" style={{ width: `${nps.passives.pct}%` }} />
        <div className="bg-red-500 h-full transition-all" style={{ width: `${nps.detractors.pct}%` }} />
      </div>

      {/* Score distribution */}
      {distribution && (
        <div className="flex items-end gap-1 h-20 mt-2">
          {distribution.map((d) => {
            const score = Number(d.value)
            const color = score >= 9 ? '#10b981' : score >= 7 ? '#fbbf24' : '#ef4444'
            const isActive = activeFilters.some(f => f.questionId === questionId && f.value === d.value)
            return (
              <button
                key={d.value}
                onClick={() => onFilter(questionId, d.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 transition-all ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
              >
                <span className="text-[9px] text-zinc-500">{d.count}</span>
                <div
                  className={`w-full rounded-t transition-all ${isActive ? 'ring-2 ring-violet-500' : ''}`}
                  style={{ height: `${Math.max(4, d.pct * 0.7)}px`, backgroundColor: color }}
                />
                <span className="text-[9px] text-zinc-500">{d.value}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-zinc-600">💡 Cliquez sur un score ou une catégorie pour filtrer</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Likert Display Component
// ═══════════════════════════════════════════════════════
function LikertDisplay({ distribution, onFilter, questionId, activeFilters, totalAnswers }: {
  distribution: Distribution[]
  onFilter: (qId: string, value: string) => void
  questionId: string
  activeFilters: ActiveFilter[]
  totalAnswers: number
}) {
  // Sort by Likert order
  const sorted = [...distribution].sort((a, b) => {
    const ai = LIKERT_ORDER.indexOf(a.value)
    const bi = LIKERT_ORDER.indexOf(b.value)
    if (ai === -1 && bi === -1) return b.count - a.count
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-8 rounded-lg overflow-hidden flex">
        {sorted.map((d) => {
          const color = LIKERT_COLORS[d.value] || CHART_COLORS[sorted.indexOf(d) % CHART_COLORS.length]
          const isActive = activeFilters.some(f => f.questionId === questionId && f.value === d.value)
          return (
            <button
              key={d.value}
              onClick={() => onFilter(questionId, d.value)}
              className={`h-full transition-all relative group ${isActive ? 'ring-2 ring-violet-400 z-10' : 'hover:brightness-110'}`}
              style={{ width: `${d.pct}%`, backgroundColor: color, minWidth: d.pct > 0 ? 4 : 0 }}
              title={`${d.value}: ${d.count} (${d.pct}%)`}
            >
              {d.pct >= 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                  {d.pct}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {sorted.map((d) => {
          const color = LIKERT_COLORS[d.value] || CHART_COLORS[sorted.indexOf(d) % CHART_COLORS.length]
          const isActive = activeFilters.some(f => f.questionId === questionId && f.value === d.value)
          return (
            <button
              key={d.value}
              onClick={() => onFilter(questionId, d.value)}
              className={`flex items-center gap-1.5 text-xs transition-all ${
                isActive ? 'text-violet-300 font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span>{d.value}</span>
              <span className="text-zinc-600 font-normal">{d.count} ({d.pct}%)</span>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-zinc-600">💡 Cliquez sur un niveau pour filtrer</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Upload Modal
// ═══════════════════════════════════════════════════════
function UploadModal({ onClose, onUpload, loading, progress, fileInputRef }: {
  onClose: () => void
  onUpload: (file: File, title: string, description: string) => void
  loading: boolean
  progress: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0]
      setFile(f)
      // Auto-generate title from filename
      if (!title) {
        const name = f.name.replace(/\.(csv|xlsx?)$/i, '').replace(/[\._-]/g, ' ')
        setTitle(name)
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Importer une enquête</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive ? 'border-violet-500 bg-violet-500/10' :
            file ? 'border-emerald-500/50 bg-emerald-500/5' :
            'border-zinc-700 hover:border-zinc-600'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-emerald-300 font-medium">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} Ko</p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Glissez votre fichier CSV ici</p>
              <p className="text-zinc-600 text-xs mt-1">ou cliquez pour sélectionner</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) {
                setFile(f)
                if (!title) {
                  const name = f.name.replace(/\.(csv|xlsx?)$/i, '').replace(/[\._-]/g, ' ')
                  setTitle(name)
                }
              }
            }}
          />
        </div>

        {/* Fields */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Titre de l'enquête *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Enquête satisfaction client Février 2026"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes, contexte…"
              rows={2}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-4 flex items-center gap-2 text-sm text-violet-400">
            <div className="w-4 h-4 bg-violet-500/30 rounded-full skel-breath" />
            {progress}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => file && title && onUpload(file, title, description)}
            disabled={!file || !title || loading}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
          >
            {loading ? 'Import en cours…' : 'Importer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
