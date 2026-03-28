import { getShopify } from "@/lib/shopify";
import { getDb } from "@/lib/db";
import { getCourierClient } from "@/lib/couriers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopify = getShopify();
  const db = getDb();
  try {
    const { orderId, courier = "delhivery" } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

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

    // 1. Get order from DB
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found in database" }, { status: 404 });
    }

    if (order.awb) {
      return NextResponse.json({ 
        errors: [
          { field: "fulfillmentOrderId", message: "Fulfillment order already fulfilled" }
        ] 
      }, { status: 400 });
    }

    // 2. Create shipment with courier → get AWB
    const courierClient = getCourierClient(courier);
    const { awb, trackingUrl } = await courierClient.createShipment({
      orderName: order.shopifyOrderName,
      customerName: order.customerName,
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      weight: order.weight ?? 0.5,
    });

    // 3. Push fulfillment + AWB to Shopify
    // We use fulfillmentCreateV2 mutation
    const mutation = `
      mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
            trackingInfo {
              number
              url
              company
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: [
            { fulfillmentOrderId: order.fulfillmentOrderId }
          ],
          trackingInfo: {
            number: awb,
            company: courier,
            url: trackingUrl,
          },
          notifyCustomer: true,
        }
      }
    });

    const data = response.data as any;

    if (data?.fulfillmentCreateV2?.userErrors?.length > 0) {
      console.error("Shopify Fulfillment Error:", data.fulfillmentCreateV2.userErrors);
      return NextResponse.json({ 
        errors: data.fulfillmentCreateV2.userErrors.map((err: any) => ({
          field: err.field?.join(".") || "fulfillment",
          message: err.message
        }))
      }, { status: 400 });
    }

    const shopifyFulfillmentId = data.fulfillmentCreateV2.fulfillment.id;

    // 4. Update DB with AWB + fulfillment ID
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        awb,
        trackingUrl,
        courier,
        shopifyFulfillmentId,
        status: "SHIPMENT_CREATED",
      }
    });

    return NextResponse.json({ 
      success: true, 
      awb, 
      trackingUrl 
    });

  } catch (error: any) {
    console.error("Fulfillment Error:", error);
    return NextResponse.json({ 
      errors: [{ field: "server", message: error.message || "Internal Server Error" }] 
    }, { status: 500 });
  }
}
