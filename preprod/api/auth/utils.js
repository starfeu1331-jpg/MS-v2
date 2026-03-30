import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const buf = await scryptAsync(password, salt, 64)
  return `${buf.toString('hex')}.${salt}`
}

export async function verifyPassword(password, hash) {
  const [hashedPassword, salt] = hash.split('.')
  if (!hashedPassword || !salt) return false
  const buf = await scryptAsync(password, salt, 64)
  const hashedBuf = Buffer.from(hashedPassword, 'hex')
  return timingSafeEqual(hashedBuf, buf)
}

export function generateToken() {
  return randomBytes(32).toString('hex')
}

export function sessionExpiry() {
  const d = new Date()
  d.setHours(d.getHours() + 8)
  return d
}

export async function logAction(prisma, { userId = null, userEmail = null, userName = null, action, resource = null, details = null, ip = null }) {
  try {
    const detailsJson = details ? JSON.stringify(details) : null
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_logs (id, user_id, user_email, user_name, action, resource, details, ip, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, $7, NOW())`,
      userId, userEmail, userName, action, resource, detailsJson, ip
    )
  } catch (e) {
    console.error('Log error:', e.message)
  }
}
