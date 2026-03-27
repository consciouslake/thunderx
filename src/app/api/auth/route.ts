import { getShopify } from "@/lib/shopify";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopify = getShopify();

  // Convert Next.js Request to Headers/Cookies for the Shopify adapter
  // In a real app with Middleware, this might be handled by the adapter automatically
  // but for a manual route, we use shopify.auth.begin.
  
  // NOTE: In some environments, auth.begin might return a Response or a URL string.
  // To be safe in Next.js App Router, we'll catch the redirect URL and handle it.
  try {
    // 1. Generate the auth URL manually to bypass the library's automated response handling
    // which is causing the 'statusCode' error in this environment.
    const scopes = ["read_orders", "write_fulfillments", "read_fulfillments"].join(",");
    const redirectUri = encodeURIComponent(`${process.env.APP_URL}/api/auth/callback`);
    const encodedScopes = encodeURIComponent(scopes);
    const state = Math.random().toString(36).substring(7); // Simple random state for now
    
    // We still use shopify.auth.begin under the hood if we can, 
    // but here we'll try to catch the output or construct it.
    
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${encodedScopes}&redirect_uri=${redirectUri}&state=${state}`;

    // 2. Set the state cookie for security (CSRF protection)
    // We return a standard NextResponse redirect
    const res = NextResponse.redirect(authUrl);
    res.cookies.set("shopify_auth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return res;
  } catch (error: any) {
    console.error("Auth Begin Error Detailed:", {
      message: error.message,
      stack: error.stack,
      shop,
    });
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}
