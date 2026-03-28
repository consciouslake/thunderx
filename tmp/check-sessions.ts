import { PrismaClient } from "@prisma/client";

// Manually passing the URL to check Supabase
const url = "postgres://postgres.vrxcafwpmduhlhztxrwk:tGKgiFJ6netCo013@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url,
    },
  },
});

async function main() {
  console.log("Checking for Shopify sessions in SUPABASE...");
  try {
    const sessions = await prisma.session.findMany();
    if (sessions.length === 0) {
      console.log("No sessions found in Supabase.");
    } else {
      console.log(`Found ${sessions.length} session(s):`);
      sessions.forEach((s: any) => {
        console.log(`- Shop: ${s.shop}`);
        console.log(`  Access Token: ${s.accessToken ? s.accessToken.substring(0, 15) + "..." : "MISSING"}`);
        console.log(`  Scope: ${s.scope}`);
      });
    }
  } catch (error) {
    console.error("Error querying Supabase:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
