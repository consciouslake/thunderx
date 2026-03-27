import { getShopify } from "@/lib/shopify";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopify = getShopify();
  const db = getDb();
  
  try {
    // 1. Get the session for this shop
    const session = await db.session.findFirst({
      where: { shop },
    });

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized. Please install the app." }, { status: 401 });
    }

    // Initialize a temporary authenticated client for this request
    const client = new shopify.clients.Graphql({
      session: session as any,
    });

    // 2. Fetch unfulfilled and paid orders from Shopify
    const graphqlQuery = `
      query {
        orders(first: 50, query: "fulfillment_status:unfulfilled financial_status:paid") {
          edges {
            node {
              id
              name
              email
              phone
              shippingAddress {
                name
                address1
                city
                province
                zip
                country
              }
              fulfillmentOrders(first: 1) {
                edges {
                  node {
                    id
                    status
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.request(graphqlQuery);
    const data = response.data as any;

    const shopifyOrders = data.orders.edges.map((e: any) => e.node);

    // 2. Upsert into local DB
    for (const o of shopifyOrders) {
      const fulfillmentOrderId = o.fulfillmentOrders.edges[0]?.node?.id;
      
      if (!fulfillmentOrderId) continue;

      await db.order.upsert({
        where: { shopifyOrderId: o.id },
        update: {
          fulfillmentOrderId: fulfillmentOrderId,
          shopifyOrderName: o.name,
          shop: shop, // Update shop just in case
        },
        create: {
          shopifyOrderId: o.id,
          shop: shop,
          shopifyOrderName: o.name,
          fulfillmentOrderId: fulfillmentOrderId,
          customerName: o.shippingAddress?.name ?? o.email ?? "Unknown",
          customerEmail: o.email ?? "",
          phone: o.phone ?? "",
          shippingAddress: o.shippingAddress?.address1 ?? "",
          city: o.shippingAddress?.city ?? "",
          state: o.shippingAddress?.province ?? "",
          pincode: o.shippingAddress?.zip ?? "",
        },
      });
    }

    // 3. Return synced orders from DB
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
