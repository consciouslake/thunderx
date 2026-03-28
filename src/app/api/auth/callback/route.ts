import { getShopify } from "@/lib/shopify";
import { sessionStorage } from "@/lib/session-storage";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Session } from "@shopify/shopify-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const host = searchParams.get("host");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("shopify_auth_state")?.value;

  if (!code || !shop || !state) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  if (state !== storedState) {
    return NextResponse.json({ error: "State mismatch / CSRF detected" }, { status: 403 });
  }

  try {
    const shopify = getShopify();

    // 1. Manually exchange code for access token using fetch 
    // to bypass potential adapter issues in auth.callback
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("Token Exchange Failed:", tokenData);
      return NextResponse.json({ error: "Token exchange failed", details: tokenData }, { status: 500 });
    }

    console.log("✅ ACCESS TOKEN:", tokenData.access_token);

    // 2. Create and store the session
    const session = new Session({
      id: `offline_${shop}`,
      shop,
      state: state,
      isOnline: false,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
    });

    await sessionStorage.storeSession(session);

    // 3. Redirect to the dashboard
    const redirectUrl = `/?shop=${shop}${host ? `&host=${host}` : ""}`;
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error: any) {
    console.error("Auth Callback Error:", error);
    return NextResponse.json({ 
      error: "Authentication Failed", 
      message: error.message 
    }, { status: 500 });
  }
}
