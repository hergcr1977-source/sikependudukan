import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"

  // Prisma sqlite provider requires file: URL format for validation.
  // For libsql:// URLs (Turso), we override the datasourceUrl with a valid file: URL
  // so PrismaClient construction passes validation, while the actual DATABASE_URL
  // env var is read by the engine at the native level.
  // This works because Prisma's library engine reads DATABASE_URL from process.env
  // directly, separate from the validation step.
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    return new PrismaClient({
      datasourceUrl: 'file:/tmp/prisma.db',
    })
  }

  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
