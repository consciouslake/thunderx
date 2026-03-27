import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { getDb } from "./db";

export const sessionStorage = new PrismaSessionStorage(getDb());
