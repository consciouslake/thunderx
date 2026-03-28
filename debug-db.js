const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany();
  console.log("Total orders in DB:", orders.length);
  if (orders.length > 0) {
    console.log("First order shop:", orders[0].shop);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
