export class InternalLogisticsClient {
  /**
   * Generate a unique internal AWB (e.g., DAL-10001)
   */
  async createShipment(data: {
    orderName: string;
    customerName: string;
    phone: string | null;
    shippingAddress: string;
    city: string;
    state: string;
    pincode: string;
    weight: number;
  }) {
    console.log("Creating internal shipment for:", data.orderName);
    
    // Generate a clean professional AWB: TX + unique identifier
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
    const random = Math.floor(1000 + Math.random() * 9000);
    const awb = `TX-${dateStr}-${random}`;
    
    // We'll use the environment variable for the base URL
    const baseUrl = process.env.APP_URL || "https://daluci-logistics.vercel.app";
    
    return {
      awb,
      trackingUrl: `${baseUrl}/track/${awb}`, // Full tracking URL
    };
  }

  /**
   * Update the status of an order and push to Shopify
   */
  async updateStatus(orderId: string, newStatus: string, location?: string, description?: string) {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const { getShopify } = await import("@/lib/shopify");
    const shopify = getShopify();

    // 1. Get the order to find which shop it belongs to
    const initialOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { shop: true, shopifyFulfillmentId: true, awb: true }
    });

    if (!initialOrder) throw new Error("Order not found");

    // 2. Get the session for this shop
    const session = await db.session.findFirst({
      where: { shop: initialOrder.shop },
    });

    if (!session) throw new Error(`No session found for shop ${initialOrder.shop}`);

    const client = new shopify.clients.Graphql({
      session: session as any,
    });

    // 3. Update the local DB
    const order = await db.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as any,
        updatedAt: new Date(),
      },
    });

    // 4. Add tracking event
    await db.trackingEvent.create({
      data: {
        orderId,
        status: newStatus,
        location: location || "Internal Warehouse",
        description: description || `Status updated to ${newStatus.toLowerCase().replace(/_/g, " ")}`,
        timestamp: new Date(),
      },
    });

    // 5. Push tracking info update to Shopify
    if (order.shopifyFulfillmentId && order.awb) {
      const mutation = `
        mutation updateTracking(
          $fulfillmentId: ID!
          $trackingInfoInput: FulfillmentTrackingInput!
        ) {
          fulfillmentTrackingInfoUpdateV2(
            fulfillmentId: $fulfillmentId
            trackingInfoInput: $trackingInfoInput
          ) {
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
            company: "Internal Carrier",
            url: `${process.env.APP_URL || "https://daluci-logistics.vercel.app"}/track/${order.awb}`,
          }
        }
      });
    }

    return order;
  }

  /**
   * Mock getStatus for internal logistics (Satisfies sync job)
   */
  async getStatus(awb: string): Promise<{ status: string; events: any[] }> {
    return {
      status: "IN_TRANSIT",
      events: []
    };
  }
}
