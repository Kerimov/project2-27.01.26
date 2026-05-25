import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function clientHasSystemSetting(client: PrismaClient): boolean {
  return typeof (client as PrismaClient & { systemSetting?: unknown }).systemSetting?.upsert === 'function'
}

function getPrismaClient(): PrismaClient {
  if (global.prisma && clientHasSystemSetting(global.prisma)) {
    return global.prisma
  }
  const client = prismaClientSingleton()
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = client
  }
  return client
}

export const prisma = getPrismaClient()
