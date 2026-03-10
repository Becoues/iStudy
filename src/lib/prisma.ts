import path from "path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Resolve database path as absolute, relative to project root (process.cwd())
const dbPath = path.resolve(process.cwd(), "data", "istudy.db");
const dbUrl = process.env.DATABASE_URL || `file:${dbPath}`;

const adapter = new PrismaBetterSqlite3({ url: dbUrl });

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
