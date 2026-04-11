import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"

  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    // Use libsql adapter for Turso/remote databases
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    const { createClient } = require('@libsql/client')
    const libsql = createClient({ url: dbUrl })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
