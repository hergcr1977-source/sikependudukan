import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"

  // For remote Turso connections (libsql://), use the Prisma LibSQL adapter
  // which connects via @libsql/client's pure-JS HTTP/WebSocket transport.
  // We convert libsql:// to https:// to avoid the native libsql addon entirely.
  if (dbUrl.startsWith('libsql://')) {
    // Convert libsql://user:pass@host -> https://user:pass@host
    const httpsUrl = dbUrl.replace('libsql://', 'https://')
    const libsql = createClient({ url: httpsUrl })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({
      adapter,
      datasourceUrl: 'file:/tmp/prisma.db', // dummy file: URL to pass Prisma validation
    })
  }

  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
