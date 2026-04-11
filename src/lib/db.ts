import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"

  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    // For Turso/libSQL URLs, use the adapter
    let PrismaLibSQL: any, createClient: any
    try {
      const adapterModule = require('@prisma/adapter-libsql')
      const libsqlModule = require('@libsql/client')
      PrismaLibSQL = adapterModule.PrismaLibSQL || adapterModule.PrismaLibSql
      createClient = libsqlModule.createClient
    } catch {
      // If adapter packages not installed, fall through to datasourceUrl override
      console.warn('[db] libsql adapter not available, using datasourceUrl override')
    }

    if (PrismaLibSQL && createClient) {
      const libsql = createClient({ url: dbUrl })
      const adapter = new PrismaLibSQL(libsql)
      return new PrismaClient({ adapter })
    }
  }

  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
