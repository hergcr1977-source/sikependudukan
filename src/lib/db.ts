import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"
  
  // Debug: log the DATABASE_URL (masked) to help diagnose connection issues
  if (dbUrl.includes('@')) {
    const parts = dbUrl.split('://')
    const proto = parts[0]
    const rest = parts[1] || ''
    const atIdx = rest.lastIndexOf('@')
    const host = atIdx > 0 ? rest.substring(atIdx + 1) : rest
    console.log(`[db] DATABASE_URL protocol: ${proto}, host: ${host}`)
  } else {
    console.log(`[db] DATABASE_URL: ${dbUrl.substring(0, 30)}...`)
  }

  // For remote Turso connections (libsql://), use the Prisma LibSQL adapter
  // which connects via @libsql/client's pure-JS HTTP/WebSocket transport.
  // We convert libsql:// to https:// to avoid the native libsql addon entirely.
  if (dbUrl.startsWith('libsql://')) {
    console.log('[db] Using libsql adapter with HTTPS conversion')
    // Convert libsql://user:pass@host -> https://user:pass@host
    const httpsUrl = dbUrl.replace('libsql://', 'https://')
    const libsql = createClient({ url: httpsUrl })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({
      adapter,
      datasourceUrl: 'file:/tmp/prisma.db', // dummy file: URL to pass Prisma validation
    })
  }

  console.log('[db] Using standard PrismaClient (no adapter)')
  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
