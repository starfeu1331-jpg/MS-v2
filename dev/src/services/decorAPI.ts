// Service pour interagir avec l'API Décor Discount
// Documentation: API Web Services Standard Proginov

// Utiliser le proxy local pour éviter les problèmes CORS
const API_BASE_URL = '/api'
const API_KEY = import.meta.env.VITE_DECOR_API_KEY || ''

export interface ClientContact {
  nom_cor: string
  prenom_cor: string
  internet: string
  civ_cor: string
  cod_cor: number
  no_corresp: number
}

export interface ClientInfo {
  nom_cli: string
  civilite: string
  adresse: string[]
  k_post2: string
  ville: string
  pays: string
  cod_cli: number
}

interface ProductInfo {
  cod_pro: number
  nom_pro: string
  nom_pr2: string
  refext: string
  refint: string
  px_refv: number
  famille: number
  s_famille: number
  pmp: number
}

/**
 * Récupère les informations d'un produit depuis l'API Décor Discount
 * @param codeProduit - Code produit (N° Produit du CSV)
 * @returns Informations du produit (nom, référence, prix, etc.)
 */
export async function getProductDetails(codeProduit: string | number): Promise<ProductInfo | null> {
  if (!API_KEY) {
    console.warn('⚠️ API Key Décor Discount non configurée')
    return null
  }

  try {
    const response = await fetch(`${API_BASE_URL}/product/${codeProduit}`, {
      headers: {
        'apikey': API_KEY,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null // Produit non trouvé
      }
      throw new Error(`Erreur API: ${response.status}`)
    }

    const data = await response.json()
    return data.product || null
  } catch (error) {
    console.error('❌ Erreur récupération produit:', error)
    return null
  }
}

/**
 * Récupère uniquement le contact principal d'un client (temporairement désactivé)
 * @param carte - Numéro de carte fidélité
 * @returns Contact principal avec nom, prénom, email
 */
export async function getMainContact(_carte: string): Promise<ClientContact | null> {
  // Temporairement désactivé en attendant de trouver le mapping carte -> cod_cli
  console.warn('⚠️ getMainContact désactivé - mapping carte non disponible dans API')
  return null
}
