// Service API pour communiquer avec le backend PostgreSQL
const API_URL = 'http://localhost:3000/api'

export interface DashboardData {
  kpis: {
    caTotal: number
    nbTransactions: number
    nbClients: number
    panierMoyen: number
    caMagasin: number
    caWeb: number
    txMagasin: number
    txWeb: number
  }
  topProduits: Array<{
    code: string
    famille: string
    nom: string
    ca: number
    volume: number
  }>
  topMagasins: Array<{
    code: string
    nom: string
    zone: string
    ca: number
    volume: number
    nbTickets: number
  }>
  evolutionMensuelle: Array<{
    mois: string
    ca: number
    transactions: number
  }>
}

export async function fetchDashboardData(year: number): Promise<DashboardData> {
  const response = await fetch(`${API_URL}/dashboard/${year}`)
  if (!response.ok) {
    throw new Error(`Erreur API: ${response.statusText}`)
  }
  return response.json()
}

export async function fetchHealthCheck() {
  const response = await fetch(`${API_URL}/health`)
  if (!response.ok) {
    throw new Error('Backend non disponible')
  }
  return response.json()
}

export async function fetchStats() {
  const response = await fetch(`${API_URL}/stats`)
  if (!response.ok) {
    throw new Error(`Erreur API: ${response.statusText}`)
  }
  return response.json()
}
