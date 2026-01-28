import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Database, RefreshCw, Trash2, Download, Save, CheckCircle, AlertCircle, Eye, EyeOff, Server, Clock, HardDrive } from 'lucide-react'

export default function Settings() {
  const [dbStats, setDbStats] = useState<any>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [showApiUrl, setShowApiUrl] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{[key: string]: File}>({})
  const [updating, setUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [maxDate, setMaxDate] = useState<string | null>(null)
  
  const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'

  useEffect(() => {
    loadDbStats()
  }, [])

  const loadDbStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export`)
      const data = await response.json()
      console.log('📊 Stats chargées:', data.stats)
      
      // Récupérer la date max des transactions
      const maxDateResponse = await fetch(`${API_URL}/api/dashboard?year=2025`)
      const dashboardData = await maxDateResponse.json()
      
      // Extraire la date max du dataset
      if (dashboardData.monthlyData && dashboardData.monthlyData.length > 0) {
        const lastMonth = dashboardData.monthlyData[dashboardData.monthlyData.length - 1]
        setMaxDate(lastMonth.month)
      }
      
      setDbStats({
        totalCA: data.stats?.ca_total || 0,
        totalTransactions: data.stats?.nb_transactions || 0,
        totalClients: data.stats?.nb_clients || 0,
        lastUpdate: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Erreur chargement stats DB:', error)
    }
  }

  const clearAllCaches = () => {
    // Vider tous les caches du localStorage
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.includes('Cache') || key.includes('cache')) {
        localStorage.removeItem(key)
      }
    })
    
    // Recharger la page pour réinitialiser les caches en mémoire
    setCacheCleared(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num)
  }

  const formatEuro = (value: number) => {
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  const handleFileDrop = (e: React.DragEvent, fileType: string) => {
    e.preventDefault()
    setDragOver(null)
    
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      setUploadedFiles(prev => ({ ...prev, [fileType]: file }))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFiles(prev => ({ ...prev, [fileType]: file }))
    }
  }

  const handleUpdateDaily = async () => {
    if (!uploadedFiles.transactions) {
      setUpdateError('Le fichier transactions.csv est obligatoire')
      return
    }

    setUpdating(true)
    setUpdateError(null)
    setUpdateSuccess(null)

    try {
      const formData = new FormData()
      formData.append('transactions', uploadedFiles.transactions)
      if (uploadedFiles.clients) formData.append('clients', uploadedFiles.clients)
      if (uploadedFiles.produits) formData.append('produits', uploadedFiles.produits)
      formData.append('mode', 'daily')

      const response = await fetch(`${API_URL}/api/update-db`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      setUpdateSuccess(`✅ ${result.message} - ${result.inserted} transactions ajoutées, ${result.filtered || 0} ignorées (déjà présentes)`)
      if (result.maxDate) {
        setMaxDate(new Date(result.maxDate).toISOString().split('T')[0])
      }
      setUploadedFiles({})
      loadDbStats() // Rafraîchir les stats
    } catch (error: any) {
      setUpdateError(error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateWeekly = async () => {
    const required = ['transactions', 'clients', 'produits']
    const missing = required.filter(f => !uploadedFiles[f])
    
    if (missing.length > 0) {
      setUpdateError(`Fichiers manquants: ${missing.join(', ')}.csv`)
      return
    }

    if (!confirm('⚠️ ATTENTION: Cette opération va SUPPRIMER toutes les données existantes.\n\nTapez OK pour confirmer.')) {
      return
    }

    setUpdating(true)
    setUpdateError(null)
    setUpdateSuccess(null)

    try {
      const formData = new FormData()
      formData.append('transactions', uploadedFiles.transactions)
      formData.append('clients', uploadedFiles.clients)
      formData.append('produits', uploadedFiles.produits)
      if (uploadedFiles.depots) formData.append('depots', uploadedFiles.depots)
      formData.append('mode', 'weekly')

      const response = await fetch(`${API_URL}/api/update-db`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      setUpdateSuccess(`✅ ${result.message} - Base recréée avec ${result.total} enregistrements`)
      setUploadedFiles({})
      loadDbStats()
    } catch (error: any) {
      setUpdateError(error.message)
    } finally {
      setUpdating(false)
    }
  }

  const removeFile = (fileType: string) => {
    setUploadedFiles(prev => {
      const newFiles = { ...prev }
      delete newFiles[fileType]
      return newFiles
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-gradient-to-br from-zinc-500 to-zinc-700 rounded-2xl">
            <SettingsIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Paramètres</h2>
            <p className="text-zinc-400">Configuration et maintenance de l'application</p>
          </div>
        </div>
      </div>

      {cacheCleared && (
        <div className="glass rounded-2xl p-4 border border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-semibold">Cache vidé avec succès !</p>
              <p className="text-sm text-zinc-400">Rechargement de la page...</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques Base de Données */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Base de Données</h3>
        </div>

        {dbStats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Chiffre d'Affaires</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatEuro(dbStats.totalCA)}</p>
              <p className="text-sm text-zinc-400 mt-1">Année 2025</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Transactions</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(dbStats.totalTransactions)}</p>
              <p className="text-sm text-zinc-400 mt-1">Total enregistré</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
                <p className="text-xs text-zinc-500 font-semibold uppercase">Clients</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(dbStats.totalClients)}</p>
              <p className="text-sm text-zinc-400 mt-1">Clients uniques</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        {maxDate && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-blue-400">Dernière transaction</p>
                <p className="text-xs text-zinc-400 mt-1">Données à jour jusqu'au {maxDate}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">Prisma ORM</p>
                <p className="text-xs text-zinc-500">+ Neon PostgreSQL</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              Connecté
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white mb-1">Mise à jour des données</p>
              <p className="text-xs text-zinc-500">Glissez-déposez vos fichiers CSV pour mettre à jour la base</p>
            </div>
          </div>

          {/* Bannière info scripts */}
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Database className="w-5 h-5 text-blue-400 mt-0.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-400 mb-1">📦 Fichiers volumineux ?</p>
                <p className="text-xs text-zinc-400 mb-2">
                  Pour les exports Sage (&gt;5 MB), utilise les scripts Terminal (beaucoup plus rapide) :
                </p>
                <code className="text-xs font-mono text-emerald-400 bg-zinc-900 px-2 py-1 rounded">
                  ./scripts/update-workflow.sh
                </code>
                <a 
                  href="https://github.com/starfeu1331-jpg/MS-v2/blob/main/GUIDE_MISE_A_JOUR.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 text-xs text-blue-400 hover:underline"
                >
                  📖 Guide complet
                </a>
              </div>
            </div>
          </div>

          {updateSuccess && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-400">{updateSuccess}</p>
              </div>
            </div>
          )}

          {updateError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{updateError}</p>
              </div>
            </div>
          )}
          
          {/* Zones de drop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {['transactions', 'clients', 'produits', 'depots'].map((fileType) => (
              <div
                key={fileType}
                onDragOver={(e) => { e.preventDefault(); setDragOver(fileType) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleFileDrop(e, fileType)}
                className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                  dragOver === fileType 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : uploadedFiles[fileType]
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e, fileType)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Download className={`w-6 h-6 mx-auto mb-2 ${
                  uploadedFiles[fileType] ? 'text-green-400' : 'text-zinc-500'
                }`} />
                <p className="text-xs font-semibold text-white capitalize">{fileType}.csv</p>
                {uploadedFiles[fileType] ? (
                  <div className="mt-2">
                    <p className="text-xs text-green-400 truncate">{uploadedFiles[fileType].name}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(fileType) }}
                      className="mt-1 text-xs text-red-400 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 mt-1">
                    {fileType === 'depots' ? 'Optionnel' : fileType === 'transactions' ? 'Obligatoire' : 'Requis'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Boutons d'action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleUpdateDaily}
              disabled={!uploadedFiles.transactions || updating}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Mise à jour en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Mise à jour Quotidienne
                </>
              )}
            </button>

            <button
              onClick={handleUpdateWeekly}
              disabled={!uploadedFiles.transactions || !uploadedFiles.clients || !uploadedFiles.produits || updating}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Recréation en cours...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Mise à jour Hebdomadaire
                </>
              )}
            </button>
          </div>

          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-300 mb-1">Mode de mise à jour</p>
                <ul className="text-xs text-zinc-400 leading-relaxed space-y-1">
                  <li>• <strong className="text-white">Quotidienne</strong> : Ajoute les nouvelles transactions (fichier transactions.csv obligatoire)</li>
                  <li>• <strong className="text-white">Hebdomadaire</strong> : Recrée toute la base (tous les fichiers requis sauf depots)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration API */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Server className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Configuration API</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
            <label className="block text-sm font-semibold text-zinc-300 mb-3">URL de l'API</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type={showApiUrl ? 'text' : 'password'}
                  value={API_URL}
                  readOnly
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono text-sm"
                />
              </div>
              <button
                onClick={() => setShowApiUrl(!showApiUrl)}
                className="p-3 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                {showApiUrl ? <EyeOff className="w-5 h-5 text-zinc-400" /> : <Eye className="w-5 h-5 text-zinc-400" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Variable d'environnement: VITE_API_URL</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <p className="text-sm font-semibold text-white">Cache Duration</p>
              </div>
              <p className="text-2xl font-bold text-yellow-400">5 min</p>
              <p className="text-xs text-zinc-500 mt-1">Durée de mise en cache des données</p>
            </div>

            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <p className="text-sm font-semibold text-white">APIs Actives</p>
              </div>
              <p className="text-2xl font-bold text-cyan-400">10</p>
              <p className="text-xs text-zinc-500 mt-1">Dashboard, RFM, Search, Stores, etc.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gestion du Cache */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <RefreshCw className="w-6 h-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Gestion du Cache</h3>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-300 mb-1">À propos du cache</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Les données sont mises en cache pendant 5 minutes pour améliorer les performances. 
                Si vous constatez des données obsolètes, utilisez ce bouton pour forcer le rechargement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={clearAllCaches}
            disabled={cacheCleared}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            Vider tous les caches
          </button>

          <button
            onClick={loadDbStats}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-zinc-800 border border-zinc-700 text-white font-semibold rounded-xl hover:bg-zinc-700 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Rafraîchir les stats
          </button>
        </div>
      </div>

      {/* Modules Disponibles */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">Modules Disponibles</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Dashboard', status: 'active', color: 'blue' },
            { name: 'Recherche', status: 'active', color: 'purple' },
            { name: 'RFM Analysis', status: 'active', color: 'pink' },
            { name: 'Sous-familles', status: 'active', color: 'cyan' },
            { name: 'Cross-Selling', status: 'active', color: 'emerald' },
            { name: 'Cohortes', status: 'active', color: 'orange' },
            { name: 'ABC Analysis', status: 'active', color: 'yellow' },
            { name: 'Performance Magasins', status: 'active', color: 'blue' },
            { name: 'Prévisions', status: 'active', color: 'purple' },
            { name: 'Réseaux Sociaux', status: 'active', color: 'pink' },
            { name: 'Exports', status: 'active', color: 'green' },
            { name: 'King Quentin', status: 'disabled', color: 'zinc' }
          ].map((module) => (
            <div
              key={module.name}
              className={`bg-zinc-900/50 rounded-xl p-4 border ${
                module.status === 'active' ? 'border-zinc-800' : 'border-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    module.status === 'active' ? `bg-${module.color}-400 animate-pulse` : 'bg-zinc-700'
                  }`}></div>
                  <p className={`text-sm font-semibold ${
                    module.status === 'active' ? 'text-white' : 'text-zinc-600'
                  }`}>
                    {module.name}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  module.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {module.status === 'active' ? 'Actif' : 'Désactivé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Version & Info */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="text-center space-y-2">
          <p className="text-zinc-500 text-sm">Decor Analytics v2.0</p>
          <p className="text-zinc-600 text-xs">Propulsé par Prisma + Neon PostgreSQL + Vercel</p>
          <p className="text-zinc-700 text-xs">© 2025 - Tous droits réservés</p>
        </div>
      </div>
    </div>
  )
}
