import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ awb: string }> }
) {
  const db = getDb();
  try {
    const resolvedParams = await params;
    const awb = resolvedParams.awb;

    if (!awb) {
      return NextResponse.json({ error: "AWB is required" }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { awb },
      include: {
        trackingEvents: {
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "No shipment found for this ID" }, { status: 404 });
    }

    // Mask sensitive data for public tracking
    const maskedOrder = {
      shopifyOrderName: order.shopifyOrderName,
      status: order.status,
      awb: order.awb,
      courier: order.courier,
      // Partial masking for privacy
      customerName: order.customerName.split(" ")[0] + " " + (order.customerName.split(" ")[1]?.[0] || "") + ".",
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      trackingEvents: order.trackingEvents.map((event) => ({
        id: event.id,
        status: event.status,
        location: event.location,
        description: event.description,
        timestamp: event.timestamp,
      })),
    };

    return NextResponse.json(maskedOrder);
  } catch (error) {
    console.error("Public Track Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
