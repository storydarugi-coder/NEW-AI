import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * DB 연결 가능 여부를 확인합니다.
 * Vercel serverless 등에서 DB 연결이 불가능하면 false를 반환합니다.
 */
export async function isDatabaseAvailable(): Promise<{ available: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { available: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { available: false, error: message };
  }
}
