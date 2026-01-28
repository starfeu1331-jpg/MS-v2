import { TrendingUp, AlertTriangle, Activity, Zap } from 'lucide-react'
import { useState, Suspense } from 'react'
import { LazyLineChart as LineChart, LazyLine as Line, LazyXAxis as XAxis, LazyYAxis as YAxis, LazyCartesianGrid as CartesianGrid, LazyTooltip as Tooltip, LazyResponsiveContainer as ResponsiveContainer, ChartFallback } from '../utils/lazyRecharts'

interface ForecastAnomaliesProps {
  data: any
}

export default function ForecastAnomalies({ data }: ForecastAnomaliesProps) {
  const [channel, setChannel] = useState<'all' | 'mag' | 'web'>('all')
  
  if (!data || !data.saison) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  
  // Sélection des données selon le canal
  const saisonData = channel === 'all' ? data.saison :
                     channel === 'mag' ? data.saisonMag : data.saisonWeb
  
  // Préparer les données mensuelles
  const monthlyData = Object.entries(saisonData)
    .map(([month, familles]: [string, any]) => {
      const total = Object.values(familles).reduce((sum: number, ca: any) => sum + ca, 0)
      return { month, ca: total }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
  
  // Calcul de la moyenne mobile sur 3 mois
  const calculateMovingAverage = (data: any[], window: number) => {
    return data.map((item, idx) => {
      if (idx < window - 1) return { ...item, movingAvg: null }
      const sum = data.slice(idx - window + 1, idx + 1).reduce((s, d) => s + d.ca, 0)
      return { ...item, movingAvg: sum / window }
    })
  }
  
  const dataWithMA = calculateMovingAverage(monthlyData, 3)
  
  // Prévision simple (régression linéaire sur les 6 derniers mois)
  const forecastMonths = (data: any[], numMonths: number) => {
    if (data.length < 3) return []
    
    const recentData = data.slice(-6)
    const n = recentData.length
    const xValues = recentData.map((_, idx) => idx)
    const yValues = recentData.map(d => d.ca)
    
    const sumX = xValues.reduce((a, b) => a + b, 0)
    const sumY = yValues.reduce((a, b) => a + b, 0)
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    const forecasts = []
    for (let i = 1; i <= numMonths; i++) {
      const forecastCA = slope * (n + i - 1) + intercept
      forecasts.push({
        month: `Prév +${i}`,
        ca: null,
        forecast: Math.max(0, forecastCA),
        isForecast: true,
      })
    }
    
    return forecasts
  }
  
  const forecasts = forecastMonths(monthlyData, 3)
  const allData = [...dataWithMA, ...forecasts]
  
  // Détection d'anomalies (écart > 20% par rapport à la moyenne mobile)
  const anomalies = dataWithMA.filter(d => {
    if (!d.movingAvg) return false
    const deviation = Math.abs((d.ca - d.movingAvg) / d.movingAvg) * 100
    return deviation > 20
  }).map(d => {
    const deviation = ((d.ca - d.movingAvg!) / d.movingAvg!) * 100
    return {
      ...d,
      deviation,
      type: deviation > 0 ? 'positive' : 'negative',
    }
  })
  
  // Stats
  const avgCA = monthlyData.length > 0 ? monthlyData.reduce((sum, d) => sum + (Number(d.ca) || 0), 0) / monthlyData.length : 0
  const lastMonth = monthlyData[monthlyData.length - 1] || { ca: 0 }
  const prevMonth = monthlyData[monthlyData.length - 2] || { ca: 0 }
  const growth = monthlyData.length > 1 
    ? (((Number(lastMonth.ca) || 0) - (Number(prevMonth.ca) || 0)) / (Number(prevMonth.ca) || 1)) * 100
    : 0
  
  const avgForecast = forecasts.length > 0 ? forecasts.reduce((sum, f) => sum + (Number(f.forecast) || 0), 0) / forecasts.length : 0
  
  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Prévisions & Anomalies</h2>
            <p className="text-zinc-400">Analyse prédictive et détection d'écarts</p>
          </div>
        </div>
        
        {/* Filtres */}
        <div className="flex gap-2">
          <button
            onClick={() => setChannel('all')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              channel === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setChannel('mag')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              channel === 'mag'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Magasins
          </button>
          <button
            onClick={() => setChannel('web')}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              channel === 'web'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Web
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Moyen Mensuel</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(avgCA)}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Dernier Mois</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(Number(lastMonth.ca) || 0)}</p>
          </div>
          <div className={`bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800`}>
            <p className="text-xs text-zinc-500 font-semibold uppercase">Croissance M-1</p>
            <p className={`text-2xl font-bold mt-1 ${growth > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {growth > 0 ? '+' : ''}{(Number(growth) || 0).toFixed(1)}%
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Prévision Moy</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{formatEuro(avgForecast)}</p>
          </div>
        </div>
      </div>
      
      {/* Graphique avec prévisions */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Évolution & Prévisions (3 mois)</h3>
        </div>
        <Suspense fallback={<ChartFallback />}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={allData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={90} fontSize={10} stroke="#71717a" />
              <YAxis tickFormatter={formatEuro} stroke="#71717a" />
              <Tooltip 
                formatter={(value: any) => value ? formatEuro(value) : 'N/A'}
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  color: '#ffffff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="ca" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="CA Réel"
              />
              <Line 
                type="monotone" 
                dataKey="movingAvg" 
                stroke="#10b981" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Moyenne Mobile (3 mois)"
              />
              <Line 
                type="monotone" 
                dataKey="forecast" 
                stroke="#06b6d4" 
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={{ fill: '#06b6d4', r: 5 }}
                name="Prévision"
              />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
      
      {/* Anomalies détectées */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Anomalies Détectées</h3>
          <span className="text-sm text-zinc-500">(écart &gt; 20% vs moyenne mobile)</span>
        </div>
        
        {anomalies.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-6 bg-green-500/10 rounded-full mb-4">
              <Zap className="w-12 h-12 text-green-400" />
            </div>
            <p className="text-lg font-semibold text-zinc-400">Aucune anomalie détectée</p>
            <p className="text-sm text-zinc-600 mt-2">Les ventes sont stables</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.map((anomaly, idx) => (
              <div 
                key={idx} 
                className={`bg-${anomaly.type === 'positive' ? 'green' : 'red'}-500/10 rounded-2xl p-5 border border-${anomaly.type === 'positive' ? 'green' : 'red'}-500/20`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-3 py-1 rounded-full bg-${anomaly.type === 'positive' ? 'green' : 'red'}-500/20 text-${anomaly.type === 'positive' ? 'green' : 'red'}-400 font-bold text-sm`}>
                      {anomaly.month}
                    </span>
                    <span className="text-2xl">{anomaly.type === 'positive' ? '📈' : '📉'}</span>
                  </div>
                  <div className={`text-2xl font-black text-${anomaly.type === 'positive' ? 'green' : 'red'}-400`}>
                    {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}%
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">CA Réel:</span>
                    <span className="font-bold text-white">{formatEuro(anomaly.ca)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Moyenne Mobile:</span>
                    <span className="font-bold text-zinc-300">{formatEuro(anomaly.movingAvg!)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Type:</span>
                    <span className={`font-bold text-${anomaly.type === 'positive' ? 'green' : 'red'}-400`}>
                      {anomaly.type === 'positive' ? '🚀 Pic de ventes' : '⚠️ Baisse anormale'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
