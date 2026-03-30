// Utilitaire pour calculer les segments RFM d'un client
// À utiliser dans le Dashboard pour afficher le segment sur chaque carte

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr === 'N/A') return null
  const [day, month, year] = dateStr.split('/')
  if (!day || !month || !year) return null
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

export interface RFMSegment {
  segment: string
  R: number
  F: number
  M: number
  RFM: number
  color: string
  icon: string
}

export function calculateClientRFM(clientData: any, allClientsData: any[] | Map<string, any>): RFMSegment | null {
  if (!clientData || !clientData.achats || clientData.achats.length === 0) return null
  
  // Convertir Map en array si nécessaire
  const allClientsArray = allClientsData instanceof Map 
    ? Array.from(allClientsData.values())
    : allClientsData
  
  const today = new Date()
  
  // Calculer les valeurs brutes du client
  let lastDate: Date | null = null
  for (const achat of clientData.achats) {
    const d = parseDate(achat.date)
    if (d && (!lastDate || d > lastDate)) lastDate = d
  }
  
  const recency = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 9999
  const frequency = clientData.achats.length
  const monetary = clientData.ca_total || 0
  
  // Collecter toutes les valeurs pour calculer les quintiles
  const allRecencies: number[] = []
  const allFrequencies: number[] = []
  const allMonetaries: number[] = []
  
  allClientsArray.forEach((client: any) => {
    if (!client.achats || client.achats.length === 0) return
    
    let clientLastDate: Date | null = null
    for (const achat of client.achats) {
      const d = parseDate(achat.date)
      if (d && (!clientLastDate || d > clientLastDate)) clientLastDate = d
    }
    
    const clientRecency = clientLastDate ? Math.floor((today.getTime() - clientLastDate.getTime()) / (1000 * 60 * 60 * 24)) : 9999
    const clientFrequency = client.achats.length
    const clientMonetary = client.ca_total || 0
    
    allRecencies.push(clientRecency)
    allFrequencies.push(clientFrequency)
    allMonetaries.push(clientMonetary)
  })
  
  // Trier les valeurs
  allRecencies.sort((a, b) => a - b)
  allFrequencies.sort((a, b) => b - a)
  allMonetaries.sort((a, b) => b - a)
  
  // Calculer les seuils de quintiles
  const getQuintileThresholds = (sortedValues: number[]) => {
    const len = sortedValues.length
    return [
      sortedValues[Math.floor(len * 0.2)],
      sortedValues[Math.floor(len * 0.4)],
      sortedValues[Math.floor(len * 0.6)],
      sortedValues[Math.floor(len * 0.8)]
    ]
  }
  
  const recencyThresholds = getQuintileThresholds(allRecencies)
  const frequencyThresholds = getQuintileThresholds(allFrequencies)
  const monetaryThresholds = getQuintileThresholds(allMonetaries)
  
  // Calculer les scores
  const getQuintile = (value: number, thresholds: number[], reverse = false) => {
    if (!reverse) {
      if (value >= thresholds[0]) return 5
      if (value >= thresholds[1]) return 4
      if (value >= thresholds[2]) return 3
      if (value >= thresholds[3]) return 2
      return 1
    } else {
      if (value <= thresholds[0]) return 5
      if (value <= thresholds[1]) return 4
      if (value <= thresholds[2]) return 3
      if (value <= thresholds[3]) return 2
      return 1
    }
  }
  
  const R = getQuintile(recency, recencyThresholds, true)
  const F = getQuintile(frequency, frequencyThresholds)
  const M = getQuintile(monetary, monetaryThresholds)
  const RFM = R * 100 + F * 10 + M
  
  // Déterminer le segment (ordre important: du plus spécifique au plus général)
  // Basé sur les critères stricts définis dans la documentation
  let segment = ''
  let color = ''
  let icon = ''
  
  if (R === 5 && F === 5 && M === 5) {
    segment = 'Ultra Champions'  // Excellence absolue
    color = 'purple'
    icon = '👑💎'
  } else if (R >= 4 && F >= 4 && M >= 4) {
    segment = 'Champions'  // Excellents partout
    color = 'emerald'
    icon = '👑'
  } else if (F >= 4) {
    // Tous les clients avec haute fréquence (F≥4)
    if (R <= 2) {
      segment = 'À Risque'  // Anciens bons clients (R≤2 ET F≥4)
      color = 'orange'
      icon = '⚠️'
    } else {
      segment = 'Loyaux'  // Clients fidèles (F≥4, pas Champions)
      color = 'blue'
      icon = '💎'
    }
  } else if (F <= 2 && R >= 4) {
    segment = 'Nouveaux'  // Clients récents avec peu d'achats
    color = 'cyan'
    icon = '✨'
  } else if (R <= 2) {
    segment = 'Perdus'  // Clients inactifs (R≤2, F<4)
    color = 'red'
    icon = '💔'
  } else {
    segment = 'Occasionnels'  // Tous les autres cas
    color = 'zinc'
    icon = '🎯'
  }
  
  return { segment, R, F, M, RFM, color, icon }
}
