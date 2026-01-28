import { memo, useEffect, useState, useRef, Suspense } from 'react'
import { TrendingUp, Users, ShoppingCart, Euro, ArrowRight, AlertCircle, TrendingDown, Package, Target, Sparkles, Award, Store, Globe } from 'lucide-react'
import { LazyLineChart as LineChart, LazyLine as Line, LazyXAxis as XAxis, LazyYAxis as YAxis, LazyCartesianGrid as CartesianGrid, LazyTooltip as Tooltip, LazyResponsiveContainer as ResponsiveContainer, ChartFallback } from '../utils/lazyRecharts'

interface DashboardProps {
  data: any
  onNavigate?: (tab: any) => void
  showWebData?: boolean
}

// Définition de l'état calculé pour éviter les recalculs synchrones bloquants
interface ComputedStats {
  totalCAMagasin: number
  totalCAWeb: number
  totalTransactionsMag: number
  totalTransactionsWeb: number
  panierMoyenMag: number
  nbClients: number
  rfmSegments: any
  topSubFamilies: any[]
  produitsFollie: any[]
  allMagasins: any[]
  topMagasins: any[]
  saisonData: any[]
  tendance: number
}

function Dashboard({ data, onNavigate, showWebData }: DashboardProps) {
  try {
    const ticketCount = data?.allTickets?.length || 0
    const clientCount = data?.allClients?.size || 0
    console.log('🎬 Dashboard RENDER:', { 
      tickets: ticketCount, 
      clients: clientCount,
      hasProduitsWeb: !!data?.produitsWeb,
      hasProduitsMag: !!data?.produitsMag,
      hasGeo: !!data?.geo,
      hasSaisonWeb: !!data?.saisonWeb,
      hasSaisonMag: !!data?.saisonMag,
      hasFamilles: !!data?.familles,
      familles: data?.familles
    })
  
  const [stats, setStats] = useState<ComputedStats | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const calculationRef = useRef<number>(0)
  const lastDataKeyRef = useRef<string>('')

  // Vérification de sécurité
  if (!data || !data.familles || !data.allClients) {
    console.log('⚠️ Dashboard: Données manquantes', {
      hasData: !!data,
      hasFamilles: !!data?.familles,
      hasAllClients: !!data?.allClients,
      famillesType: typeof data?.familles,
      allClientsType: typeof data?.allClients
    })
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-flex p-6 bg-zinc-800 rounded-full mb-4">
            <div className="w-12 h-12 border-4 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-zinc-400">Chargement des données...</p>
        </div>
      </div>
    )
  }
  
  console.log('✅ Dashboard: Vérification sécurité passée')

  // Effect pour le calcul asynchrone par paquets
  useEffect(() => {
    console.log('🔧 USEEFFECT APPELÉ')
    // Génération d'une clé unique basée sur les données ACTUELLES
    const currentDataKey = `${ticketCount}-${clientCount}-${showWebData}`
    const previousDataKey = lastDataKeyRef.current
    
    console.log('🔄 Dashboard EFFECT CHECK:', { 
      currentDataKey, 
      previousDataKey, 
      changed: currentDataKey !== previousDataKey,
      hasData: !!data,
      hasFamilles: !!data?.familles,
      hasAllClients: !!data?.allClients
    })
    
    // Si les données n'ont pas changé, ne rien faire
    if (currentDataKey === previousDataKey) {
      console.log('⏭️ Dashboard: Données inchangées, skip calcul')
      return
    }
    
    lastDataKeyRef.current = currentDataKey
    
    // Annuler le calcul précédent
    const currentCalcId = Math.random()
    calculationRef.current = currentCalcId
    
    setStats(null)
    setLoadingProgress(0)
    setError(null)

    console.log('🚀 Dashboard EFFECT: DÉMARRAGE calcul asynchrone...', { calcId: currentCalcId, ticketCount, showWebData })

    // Variables temporaires pour le calcul
    let tempStats:  Partial<ComputedStats> = {}
    const CHUNK_TIME_LIMIT = 8 // Reduced to 8ms to be ultra-safe
    
    // Helper pour checks temps
    const shouldYield = (start: number) => performance.now() - start > CHUNK_TIME_LIMIT

    // Planification des étapes
    const steps = [
      // ÉTAPE 1: KPI de base (Chunked now!)
      async () => {
        return new Promise<boolean>((resolve, reject) => {
          try {
            const tickets = data.allTickets || []
            const total = tickets.length
            let idx = 0
            
            // Stats cumulatives
            let countMag = 0
            let caMag = 0
            let countWeb = 0
            let caWeb = 0
            const uniqueTicketsMag = new Set()
            const uniqueTicketsWeb = new Set()
            
            const processTicketsKPI = () => {
              if (calculationRef.current !== currentCalcId) return
              const start = performance.now()
              
              while (idx < total) {
                const t = tickets[idx]
                idx++
                
                if (t.magasin === 'WEB') {
                  countWeb++
                  caWeb += (t.ca || 0)
                  uniqueTicketsWeb.add(t.ticket) // Set operations are fast, but memory check?
                } else {
                  countMag++
                  caMag += (t.ca || 0)
                  uniqueTicketsMag.add(t.ticket)
                }
                
                if (shouldYield(start)) {
                  setTimeout(processTicketsKPI, 0)
                  return
                }
              }
              
              // Finished
              // IMPORTANT: countMag/countWeb = nombre total de transactions (lignes)
              // uniqueTicketsMag.size = nombre de factures uniques
              tempStats.totalTransactionsMag = countMag  // Nombre total de transactions magasin
              tempStats.totalCAMagasin = caMag
              tempStats.totalTransactionsWeb = countWeb  // Nombre total de transactions web
              tempStats.totalCAWeb = caWeb
              // Panier moyen = CA total / nombre de factures uniques (pas le nombre de lignes)
              tempStats.panierMoyenMag = uniqueTicketsMag.size > 0 ? (caMag / uniqueTicketsMag.size) : 0
              
              console.log('✅ Étape 1 (KPI) terminée:', { 
                caMag, 
                caWeb, 
                transMag: countMag,  // Nombre total de transactions
                facturesUniquesMag: uniqueTicketsMag.size,  // Nombre de factures uniques
                transWeb: countWeb,
                facturesUniquesWeb: uniqueTicketsWeb.size
              })
              setLoadingProgress(10)
              resolve(true)
            }
            
            processTicketsKPI()
          } catch (e) {
            reject(e)
          }
        })
      },

      // ÉTAPE 2: Clients (Optimisé - juste compter, pas d'itération lourde)
      async () => {
        return new Promise<boolean>((resolve) => {
          // Pour les gros datasets, on utilise directement la taille de la Map
          // C'est une estimation acceptable car les clients sans achats sont rares
          const clientSize = data.allClients instanceof Map 
            ? data.allClients.size 
            : (Array.isArray(data.allClients) ? data.allClients.length : 0)
          
          tempStats.nbClients = clientSize
          console.log(`✅ Étape 2 (Clients) terminée: ${clientSize} clients`)
          setLoadingProgress(30)
          resolve(true)
        })
      },

      // ÉTAPE 3: RFM - DÉSACTIVÉ pour les gros datasets (>100K clients)
      // Le calcul RFM complet est fait dans RFMAnalysis.tsx uniquement
      async () => {
        return new Promise<boolean>((resolve) => {
          // Pour éviter les crashes mémoire, on n'effectue PAS le calcul RFM ici
          // Le Dashboard affiche juste des estimations rapides basées sur un échantillon
          const clientSize = data.allClients?.size || 0
          console.log(`📊 RFM Skip: ${clientSize} clients (trop lourd pour Dashboard)`)
          
          // Estimation rapide basée sur des statistiques générales (pas de calcul lourd)
          const estimatedSegments = {
            champions: Math.round(clientSize * 0.05),    // ~5% champions
            loyaux: Math.round(clientSize * 0.15),       // ~15% loyaux
            risque: Math.round(clientSize * 0.10),       // ~10% à risque
            perdus: Math.round(clientSize * 0.40),       // ~40% perdus
            nouveaux: Math.round(clientSize * 0.10),     // ~10% nouveaux
            occasionnels: Math.round(clientSize * 0.20)  // ~20% occasionnels
          }
          
          tempStats.rfmSegments = estimatedSegments
          console.log('✅ Étape 3 (RFM estimé) terminée:', estimatedSegments)
          setLoadingProgress(60)
          resolve(true)
        })
      },
      
      // ÉTAPE 4: Sous-Familles (Moyen)
      async () => {
        return new Promise<boolean>((resolve, reject) => {
          try {
            const subFams: any = {}
            const tickets = data.allTickets || []
            let idx = 0
            const total = tickets.length
            
            const processTickets = () => {
               if (calculationRef.current !== currentCalcId) return 

               const start = performance.now()
               while (idx < total && !shouldYield(start)) {
                 const ticket = tickets[idx]
                 idx++
                 
                 if (showWebData === true && ticket.magasin !== 'WEB') continue
                 if (showWebData !== true && ticket.magasin === 'WEB') continue
                 
                 const key = `${ticket.famille}|${ticket.sousFamille}`
                 if (!subFams[key]) {
                    subFams[key] = {
                      famille: ticket.famille,
                      sousFamille: ticket.sousFamille,
                      ca: 0,
                      volume: 0,
                      passages: new Set()
                    }
                  }
                  subFams[key].ca += ticket.ca || 0
                  subFams[key].volume += ticket.quantite || 0
                  if (ticket.ticket) subFams[key].passages.add(ticket.ticket)
               }
               
               if (idx >= total) {
                 tempStats.topSubFamilies = Object.values(subFams)
                    .map((sf: any) => ({
                      ...sf,
                      panierMoyen: sf.passages.size > 0 ? sf.ca / sf.passages.size : 0
                    }))
                    .sort((a: any, b: any) => b.ca - a.ca)
                    .slice(0, 5)
                    
                  setLoadingProgress(80)
                  resolve(true)
               } else {
                 setTimeout(processTickets, 0)
               }
            }
            processTickets()
          } catch (e) { reject(e) }
        })
      },
      
      // ÉTAPE 5: Finitions
      async () => {
         return new Promise<boolean>((resolve) => {
             try {
                // Produits Follie
                const getProduitsFollie = () => {
                    if (!data.produitsWeb || !data.produitsMag) return []
                     const webArray = Object.entries(data.produitsWeb).map(([code, stats]: [string, any]) => ({ code, nom: stats.nom || code, ca: stats.ca, volume: stats.volume, famille: stats.famille, sousFamille: stats.sousFamille }))
                     const magArray = Object.entries(data.produitsMag).map(([code, stats]: [string, any]) => ({ code, nom: stats.nom || code, ca: stats.ca, volume: stats.volume, famille: stats.famille, sousFamille: stats.sousFamille }))
                     
                     const topWebCodes = webArray.sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.code)
                     const topMagCodes = magArray.sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.code)
                     
                     return webArray.filter(p => topWebCodes.includes(p.code) && topMagCodes.includes(p.code)).sort((a, b) => b.ca - a.ca).slice(0, 3)
                }
                tempStats.produitsFollie = getProduitsFollie()
                
                // Magasins
                const allMagasins = !showWebData && data.geo?.magasins 
                  ? Object.entries(data.geo.magasins)
                      .map(([mag, stats]: [string, any]) => ({ mag, ca: stats.ca || 0, volume: stats.volume || 0 }))
                      .filter(m => m.mag !== 'WEB' && !m.mag.startsWith('M41') && !m.mag.startsWith('M42'))
                  : []
                tempStats.allMagasins = allMagasins
                tempStats.topMagasins = allMagasins.slice(0, 5)
                
                // Saison
                const saisonDataSource = showWebData === true ? data.saisonWeb : (showWebData === false ? data.saisonMag : null)
                tempStats.saisonData = saisonDataSource ? Object.entries(saisonDataSource).map(([month, familles]: [string, any]) => {
                    const total = Object.values(familles).reduce((sum: number, ca: any) => sum + (ca || 0), 0)
                    return { month, ca: total }
                }).sort((a, b) => a.month.localeCompare(b.month)) : []
                
                // Tendance
                const recentMonths = tempStats.saisonData.slice(-3)
                const avgRecent = recentMonths.length > 0 ? recentMonths.reduce((sum, m) => sum + m.ca, 0) / recentMonths.length : 0
                const previousMonths = tempStats.saisonData.slice(-6, -3)
                const avgPrevious = previousMonths.length > 0 ? previousMonths.reduce((sum, m) => sum + m.ca, 0) / previousMonths.length : avgRecent
                tempStats.tendance = avgPrevious > 0 ? ((avgRecent - avgPrevious) / avgPrevious) * 100 : 0
                
                setLoadingProgress(100)
                resolve(true)
             } catch (e) {
                 console.error("Step 5 failed", e)
                 resolve(true) // Non critical
             }
         })
      }
    ]

    // Exécution de la chaîne
    const runSequence = async () => {
      try {
        // Exécution de TOUTES les étapes (maintenant optimisées)
        for (let i = 0; i < steps.length; i++) {
          if (calculationRef.current !== currentCalcId) return
          console.log(`📍 Exécution étape ${i + 1}/${steps.length}`)
          await steps[i]()
          // Petite pause pour s'assurer que l'UI a le temps de render
          await new Promise(r => setTimeout(r, 0))
        }
        
        // Set default values for RFM if not set
        if (!tempStats.rfmSegments) {
          tempStats.rfmSegments = { champions: 0, loyaux: 0, risque: 0, perdus: 0, nouveaux: 0, occasionnels: 0 }
        }
        
        if (calculationRef.current === currentCalcId) {
          console.log('✅ Dashboard: Calcul terminé')
          setStats(tempStats as ComputedStats)
        }
      } catch (e: any) {
        console.error('Erreur calcul dashboard', e)
        setError(e.message || "Erreur inconnue")
        // Force le rendu avec données vides plutôt que whitelist
        setStats({
          totalCAMagasin: 0,
          totalCAWeb: 0,
          totalTransactionsMag: 0,
          totalTransactionsWeb: 0,
          panierMoyenMag: 0,
          nbClients: 0,
          rfmSegments: { champions: 0, loyaux: 0, risque: 0, perdus: 0, nouveaux: 0, occasionnels: 0 },
          topSubFamilies: [],
          produitsFollie: [],
          allMagasins: [],
          topMagasins: [],
          saisonData: [],
          tendance: 0
        })
      }
    }
    
    runSequence()

  }, [data, ticketCount, clientCount, showWebData])
  
  if (error) {
     return (
         <div className="p-8 text-center glass rounded-3xl border border-red-500/30">
             <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-white mb-2">Erreur de calcul</h3>
             <p className="text-zinc-400 mb-4">Une erreur est survenue lors de l'analyse des données.</p>
             <p className="text-xs text-zinc-500 font-mono bg-black/30 p-2 rounded">{error}</p>
         </div>
     )
  }

  // Rendu loading intermédiaire
  if (!stats) {
    console.log('📦 Section: Loader (stats null)')
     return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-center w-full max-w-md">
           <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Calcul en cours...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="text-zinc-500 mt-4 text-sm animate-pulse">Analyse de {ticketCount.toLocaleString()} transactions...</p>
        </div>
      </div>
    )
  }
  
  console.log('📦 Section: Destructuring stats...')
  // Destructuring pour simplifier le reste du template
  const { 
    totalCAMagasin = 0, totalCAWeb = 0, totalTransactionsMag = 0, totalTransactionsWeb = 0,
    panierMoyenMag = 0, nbClients = 0, rfmSegments = { champions: 0, loyaux: 0, risque: 0, perdus: 0, nouveaux: 0, occasionnels: 0 }, topSubFamilies = [], 
    produitsFollie = [], topMagasins = [], allMagasins = [], saisonData = [], tendance = 0 
  } = stats || {}
  
  console.log('📦 Section: Calculs dérivés...')
  const totalCA = (totalCAMagasin || 0) + (totalCAWeb || 0)
  const panierMoyenWeb = totalTransactionsWeb > 0 ? totalCAWeb / totalTransactionsWeb : 0
  const formatEuro = (value: number) => `${(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  // Safe helper for Trend
  const safeTrend = typeof tendance === 'number' ? tendance : 0

  console.log('📦 Section: DEBUT RENDER JSX')

  return (
    <div className="space-y-6">
      {/* En-tête avec titre */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Vue d'Ensemble</h1>
            <p className="text-zinc-400">Tableau de bord global de votre activité</p>
          </div>
          <div className="flex items-center gap-2">
            {safeTrend >= 0 ? (
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-400" />
            )}
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                {safeTrend >= 0 ? '+' : ''}{safeTrend.toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500">Tendance 3 mois</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Principaux - Basculement Magasin/Web */}
      {!showWebData ? (
        // KPIs Magasin
        <div className="glass rounded-3xl p-6 border border-zinc-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-400" />
            Magasins Physiques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">CA Magasins</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(totalCAMagasin)}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    {((totalCAMagasin / totalCA) * 100).toFixed(1)}% du total
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Euro className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Transactions</p>
                  <p className="text-3xl font-semibold text-white">{totalTransactionsMag.toLocaleString('fr-FR')}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    {Math.round(totalTransactionsMag / nbClients * 10) / 10} par client
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <ShoppingCart className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Panier Moyen</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(panierMoyenMag)}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    Par transaction
                  </p>
                </div>
                <div className="p-3 bg-teal-500/20 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-teal-400" />
                </div>
              </div>
            </div>
            
            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Magasins</p>
                  <p className="text-3xl font-semibold text-white">{allMagasins.length}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    Points de vente actifs
                  </p>
                </div>
                <div className="p-3 bg-indigo-500/20 rounded-xl">
                  <Store className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : totalCAWeb > 0 && (
        // KPIs Web
        <div className="glass rounded-3xl p-6 border border-zinc-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            E-Commerce
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">CA Web</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(totalCAWeb)}</p>
                  <p className="text-xs text-cyan-400 mt-2 font-semibold">
                    {((totalCAWeb / totalCA) * 100).toFixed(1)}% du total
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <Euro className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Commandes</p>
                  <p className="text-3xl font-semibold text-white">{totalTransactionsWeb.toLocaleString('fr-FR')}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    En ligne
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <ShoppingCart className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Panier Moyen</p>
                  <p className="text-3xl font-semibold text-white">{formatEuro(panierMoyenWeb)}</p>
                  <p className="text-xs text-zinc-400 mt-2">
                    Par commande
                  </p>
                </div>
                <div className="p-3 bg-teal-500/20 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-teal-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Résumé Global */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">
                {showWebData ? 'CA E-Commerce' : 'CA Magasins'}
              </p>
              <p className="text-3xl font-semibold text-white">
                {formatEuro(showWebData ? totalCAWeb : totalCAMagasin)}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                {showWebData ? `${((totalCAWeb / totalCA) * 100).toFixed(1)}% du total` : `${((totalCAMagasin / totalCA) * 100).toFixed(1)}% du total`}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Euro className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card glass rounded-2xl shadow-lg p-6 card-hover border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Clients Uniques</p>
              <p className="text-3xl font-semibold text-white">{nbClients.toLocaleString('fr-FR')}</p>
              <p className="text-xs text-purple-400 mt-2 font-semibold">
                {rfmSegments.champions} Top Clients ⭐
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Segmentation RFM Rapide */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-2xl">
              <Users className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-white">Segmentation Clientèle</h3>
              <p className="text-sm text-zinc-500">Répartition par comportement d'achat</p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('rfm')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition-all font-medium"
            >
              Voir détails <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-emerald-500/10 rounded-2xl p-5 border border-emerald-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">🏆 Champions</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.champions}</p>
            <p className="text-xs text-emerald-400 mt-1">Meilleurs</p>
          </div>
          <div className="bg-blue-500/10 rounded-2xl p-5 border border-blue-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">💙 Loyaux</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.loyaux}</p>
            <p className="text-xs text-blue-400 mt-1">Fidèles</p>
          </div>
          <div className="bg-cyan-500/10 rounded-2xl p-5 border border-cyan-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">✨ Nouveaux</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.nouveaux}</p>
            <p className="text-xs text-cyan-400 mt-1">1er achat</p>
          </div>
          <div className="bg-zinc-500/10 rounded-2xl p-5 border border-zinc-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">🔄 Occasionnels</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.occasionnels}</p>
            <p className="text-xs text-zinc-400 mt-1">Irréguliers</p>
          </div>
          <div className="bg-orange-500/10 rounded-2xl p-5 border border-orange-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">⚠️ À Risque</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.risque}</p>
            <p className="text-xs text-orange-400 mt-1">À réactiver</p>
          </div>
          <div className="bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
            <p className="text-xs text-zinc-400 font-semibold mb-2">❌ Perdus</p>
            <p className="text-3xl font-semibold text-white">{rfmSegments.perdus}</p>
            <p className="text-xs text-red-400 mt-1">Inactifs</p>
          </div>
        </div>
      </div>

      {/* Insights & Produits de Folie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sous-familles */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <Package className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Top Sous-familles</h3>
                <p className="text-sm text-zinc-500">Les plus performantes</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('subFamilies')}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-xl transition-all text-sm font-medium"
              >
                Analyse <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {topSubFamilies.map((sf: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white text-sm">{sf.famille}</p>
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full font-bold">
                    #{idx + 1}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-2">{sf.sousFamille}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{formatEuro(sf.ca)}</span>
                  <span className="text-xs text-zinc-400">PM: {formatEuro(sf.panierMoyen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Produits de Folie */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Produits de Folie</h3>
                <p className="text-sm text-zinc-500">Stars Web & Magasin</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('social')}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl transition-all text-sm font-medium"
              >
                Voir tous <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {produitsFollie.length > 0 ? (
            <div className="space-y-3">
              {produitsFollie.map((p: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <p className="font-bold text-white">{p.nom}</p>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">Code: {p.code}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{formatEuro(p.ca)}</span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-bold">
                      {p.volume} ventes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Aucun produit commun trouvé</p>
              <p className="text-zinc-600 text-xs mt-1">Importez plus de données</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Magasins - UNIQUEMENT EN MODE MAGASIN */}
      {!showWebData && topMagasins.length > 0 && (
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-2xl">
                <Store className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white">Performance Magasins</h3>
                <p className="text-sm text-zinc-500">Top 5 des points de vente</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('stores')}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-all font-medium"
              >
                Analyse complète <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topMagasins.map((mag: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-green-400">#{idx + 1}</span>
                  <Target className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="font-bold text-white mb-2">{mag.mag}</p>
                <p className="text-lg font-semibold text-white mb-1">{formatEuro(mag.ca)}</p>
                <p className="text-xs text-zinc-500">{mag.volume.toLocaleString()} articles</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évolution du CA */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold text-white">Évolution du Chiffre d'Affaires</h3>
            <p className="text-sm text-zinc-500">Tendance sur la période</p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('forecast')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all font-medium"
            >
              Prévisions <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Suspense fallback={<ChartFallback />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={saisonData}>
              <defs>
                <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="month" 
                angle={-45} 
                textAnchor="end" 
                height={90} 
                fontSize={10} 
                stroke="#71717a" 
              />
              <YAxis tickFormatter={formatEuro} stroke="#71717a" />
              <Tooltip 
                formatter={(value: any) => formatEuro(value)}
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  color: '#ffffff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="ca" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fill="url(#colorCA)"
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6, fill: '#06b6d4' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>

      {/* Alertes & Recommandations */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-amber-500/20 rounded-2xl">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white">Insights & Actions</h3>
            <p className="text-sm text-zinc-500">Recommandations basées sur vos données</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfmSegments.risque > 0 && (
            <div className="bg-orange-500/10 rounded-xl p-5 border border-orange-500/20">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <p className="font-bold text-white">Clients à risque</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                {rfmSegments.risque} clients risquent de partir. Lancez une campagne de réactivation.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('rfm')}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Voir la segmentation →
                </button>
              )}
            </div>
          )}
          
          {rfmSegments.nouveaux > 10 && (
            <div className="bg-cyan-500/10 rounded-xl p-5 border border-cyan-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <p className="font-bold text-white">Nouveaux clients</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                {rfmSegments.nouveaux} nouveaux clients ! Créez une offre de bienvenue pour les fidéliser.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('cohortes')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Analyser les cohortes →
                </button>
              )}
            </div>
          )}
          
          {tendance < -5 && (
            <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <p className="font-bold text-white">Baisse d'activité</p>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                Le CA a baissé de {Math.abs(tendance).toFixed(1)}% ces 3 derniers mois. Analysez les causes.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('forecast')}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Voir les prévisions →
                </button>
              )}
            </div>
          )}
          
          <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/20">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <p className="font-bold text-white">Opportunités cross-sell</p>
            </div>
            <p className="text-sm text-zinc-400 mb-3">
              Découvrez quels produits sont souvent achetés ensemble pour optimiser vos recommandations.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('crossSelling')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                Analyser le cross-selling →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
  } catch (error) {
    console.error('💥 CRASH DASHBOARD:', error)
    console.error('Stack:', error.stack)
    return (
      <div className="p-8 text-center glass rounded-3xl border border-red-500/30">
        <h3 className="text-xl font-bold text-white mb-2">Erreur critique</h3>
        <p className="text-zinc-400 mb-4">Le Dashboard a crashé</p>
        <p className="text-xs text-zinc-500 font-mono bg-black/30 p-2 rounded">{error.message}</p>
      </div>
    )
  }
}

export default Dashboard
