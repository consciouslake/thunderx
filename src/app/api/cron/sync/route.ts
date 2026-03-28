import { getCourierClient } from "@/lib/couriers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { getShopify } = await import("@/lib/shopify");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  
  try {
    const shopify = getShopify();
    // 1. Secure the cron endpoint
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Load all active sessions
    const sessions = await db.session.findMany();
    let totalSynced = 0;

    for (const session of sessions) {
      const client = new shopify.clients.Graphql({
        session: session as any,
      });

      // 3. Get all active (non-terminal) orders for THIS shop with an AWB
      const activeOrders = await db.order.findMany({
        where: {
          shop: session.shop,
          status: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] },
          awb: { not: null },
        },
      });

      for (const order of activeOrders) {
        try {
          if (!order.awb || !order.courier) continue;

          const courierClient = getCourierClient(order.courier);
          const { status, events } = await courierClient.getStatus(order.awb);

          // 4. Save new tracking events to DB
          for (const event of (events as any[])) {
            await db.trackingEvent.upsert({
              where: {
                orderId_timestamp: {
                  orderId: order.id,
                  timestamp: new Date(event.timestamp),
                },
              },
              update: {},
              create: {
                orderId: order.id,
                status: event.status,
                location: event.location,
                description: event.description,
                timestamp: new Date(event.timestamp),
              },
            });
          }

          // 5. Push updated tracking to Shopify
          if (order.shopifyFulfillmentId) {
            const mutation = `
              mutation updateTracking($fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!) {
                fulfillmentTrackingInfoUpdateV2(fulfillmentId: $fulfillmentId, trackingInfoInput: $trackingInfoInput) {
                  fulfillment { id status }
                  userErrors { field message }
                }
              }
            `;

            await client.request(mutation, {
              variables: {
                fulfillmentId: order.shopifyFulfillmentId,
                trackingInfoInput: {
                  number: order.awb,
                  company: order.courier,
                  url: order.trackingUrl,
                }
              }
            });
          }

          // 6. Update order status in local DB
          await db.order.update({
            where: { id: order.id },
            data: { 
              status: status as any,
              updatedAt: new Date() 
            },
          });

          totalSynced++;
        } catch (err) {
          console.error(`Failed to sync order ${order.shopifyOrderName} for ${session.shop}:`, err);
        }
      }
    }

    return NextResponse.json({ synced: totalSynced });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
