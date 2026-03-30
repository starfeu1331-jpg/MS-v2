/**
 * PIM Proxy API — Interactiv' Database
 * Protège les credentials PIM côté serveur et expose des endpoints REST.
 */

const PIM_API = process.env.PIM_API_URL || 'https://it2api.interactiv-database.fr'
const PIM_USERNAME = process.env.PIM_USERNAME
const PIM_PASSWORD = process.env.PIM_PASSWORD
const CHANNEL = 'proginov'
const LANG = 'fr'

// Token cache
let cachedToken = null
let tokenExpiresAt = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken
  const resp = await fetch(`${PIM_API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: PIM_USERNAME, password: PIM_PASSWORD })
  })
  if (!resp.ok) throw new Error('PIM login failed: ' + resp.status)
  const data = await resp.json()
  cachedToken = data.token
  // Refresh 10 min before expiry (token is 1h)
  tokenExpiresAt = Date.now() + 50 * 60 * 1000
  return cachedToken
}

async function pimFetch(path, options = {}) {
  const token = await getToken()
  const resp = await fetch(`${PIM_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`PIM ${path} → ${resp.status}: ${txt.slice(0, 200)}`)
  }
  return resp.json()
}

// ─── Categories ──────────────────────────────────────────────
const CATEGORY_CACHE = new Map()
const CATEGORY_CACHE_TTL = 30 * 60 * 1000 // 30 min

export async function categoriesHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const parentId = req.query.parentId
  if (!parentId) return res.status(400).json({ error: 'parentId required' })

  const cacheKey = `cat_${parentId}`
  const cached = CATEGORY_CACHE.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data)
  }

  const data = await pimFetch(`/api/pim/category/children/${parentId}`, {
    method: 'POST',
    body: JSON.stringify({ channelCode: CHANNEL, languageCode: LANG })
  })

  const categories = (data.content || []).map(c => ({
    id: c.category?.id || c.id,
    code: c.category?.code || c.code,
    name: c.category?.translations?.fr || c.category?.translations?.en || c.name || '',
    productCount: c.productCount || c.count || 0,
    children: c.children || [],
    hasChildren: (c.children || []).length > 0
  }))

  // Enrich with real product counts from product list API
  const enriched = await Promise.all(categories.map(async (cat) => {
    try {
      const countData = await pimFetch(`/api/pim/product/list/${CHANNEL}/${LANG}`, {
        method: 'POST',
        body: JSON.stringify({ channelCode: CHANNEL, languageCode: LANG, start: 0, length: 1, categoryCode: cat.code })
      })
      return { ...cat, productCount: countData.content?.totalRows || cat.productCount }
    } catch { return cat }
  }))

  const result = { categories: enriched }
  CATEGORY_CACHE.set(cacheKey, { data: result, expiresAt: Date.now() + CATEGORY_CACHE_TTL })
  res.json(result)
}

// ─── Product List ────────────────────────────────────────────
export async function productListHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    search = '',
    categoryCode,
    familyCodes,
    attributeFilters,
    start = 0,
    length = 50,
    sortBy = 'uniq_id',
    orderBy = 'ASC'
  } = req.body

  const body = {
    channelCode: CHANNEL,
    languageCode: LANG,
    start: Number(start),
    length: Math.min(Number(length), 200),
    sortBy,
    orderBy,
    detailed: true,
    getCategories: true
  }
  if (search) body.search = search
  if (categoryCode) body.categoryCode = categoryCode
  if (familyCodes?.length) body.listFamilyCodes = familyCodes
  if (attributeFilters?.length) body.listAttributeFilters = attributeFilters

  const data = await pimFetch(`/api/pim/product/list/${CHANNEL}/${LANG}`, {
    method: 'POST',
    body: JSON.stringify(body)
  })

  const rawProducts = data.content?.products || data.data || []
  const products = rawProducts.map(p => {
    const v = p.values || {}
    // Build categories from breadcrumb (skip root channel)
    const breadcrumb = (p.list_breadcrumb || [])[0] || []
    const cats = breadcrumb.filter(b => b.code !== 'proginov').map(b => ({
      id: b.id, code: b.code, name: b.translations?.fr || b.translations?.en || b.code
    }))
    return {
      id: String(p.uniq_id),
      code: v['001_code_produit'] || String(p.uniq_id),
      name: v['003_intitule'] || v['202_titre_produit'] || String(p.uniq_id),
      nameComplement: v['004_intitule_complementaire'] || '',
      refInterne: v['005_ref_interne'] || '',
      famille: p.family_translation || v['007_famille'] || '',
      familleCode: p.family_code || '',
      categories: cats,
      gammeColoristique: v['012_gamme_coloristique'] || '',
      fabrication: v['032_fabrication'] || '',
      fournisseur: v['011_fournisseur'] || '',
      destination: v['043_destination'] || '',
      epaisseur: v['042_epaisseur'] || '',
      largeur: v['041_largeur'] || '',
      prixVente: v['013_prix_vente'] || '',
      dateCreation: v['019_date_creation'] || '',
      composition: v['022_composition'] || '',
      marque: v['026_marque'] || '',
      aspect: v['029_aspect'] || '',
      sousFamille: v['009_ssfamille'] || v['008_sfamille'] || '',
      sousSousFamille: v['010_sssfamille'] || '',
      hasImages: !!(v['600_photo_detouree_1'] || v['621_photo_pim']),
      assets: []
    }
  })

  const total = data.content?.totalRows || data.recordsFiltered || data.recordsTotal || 0
  res.json({
    products,
    total,
    recordsTotal: total
  })
}

// ─── Product Detail ──────────────────────────────────────────
export async function productDetailHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const productId = req.params.productId
  if (!productId) return res.status(400).json({ error: 'productId required' })

  // Get product detail from PIM
  const data = await pimFetch(`/api/pim/product/list/${CHANNEL}/${LANG}`, {
    method: 'POST',
    body: JSON.stringify({
      channelCode: CHANNEL,
      languageCode: LANG,
      search: productId,
      start: 0,
      length: 1,
      detailed: true,
      getCategories: true
    })
  })

  const rawProducts = data.content?.products || data.data || []
  const p = rawProducts[0]
  if (!p) return res.status(404).json({ error: 'Product not found' })

  const v = p.values || {}
  // Collect all numbered attributes
  const allAttributes = {}
  for (const [key, value] of Object.entries(v)) {
    if (key.match(/^\d{3}_/) && value) {
      allAttributes[key] = value
    }
  }

  // Build categories from breadcrumb
  const breadcrumb = (p.list_breadcrumb || [])[0] || []
  const cats = breadcrumb.filter(b => b.code !== 'proginov').map(b => ({
    id: b.id, code: b.code, name: b.translations?.fr || b.translations?.en || b.code
  }))

  res.json({
    id: String(p.uniq_id),
    code: v['001_code_produit'] || String(p.uniq_id),
    name: v['003_intitule'] || v['202_titre_produit'] || String(p.uniq_id),
    nameComplement: v['004_intitule_complementaire'] || '',
    refInterne: v['005_ref_interne'] || '',
    famille: p.family_translation || v['007_famille'] || '',
    familleCode: p.family_code || '',
    categories: cats,
    attributes: allAttributes,
    assets: [],
    gammeColoristique: v['012_gamme_coloristique'] || '',
    fabrication: v['032_fabrication'] || '',
    fournisseur: v['011_fournisseur'] || '',
    destination: v['043_destination'] || '',
    epaisseur: v['042_epaisseur'] || '',
    largeur: v['041_largeur'] || '',
    prixVente: v['013_prix_vente'] || '',
    dateCreation: v['019_date_creation'] || '',
    composition: v['022_composition'] || '',
    marque: v['026_marque'] || '',
    aspect: v['029_aspect'] || ''
  })
}
