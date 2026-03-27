import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/web-api";

let shopifyInstance: ReturnType<typeof shopifyApi> | null = null;

export const getShopify = () => {
  if (!shopifyInstance) {
    shopifyInstance = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY || "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      scopes: ["read_orders", "write_fulfillments", "read_fulfillments"],
      hostName: process.env.APP_URL?.replace(/https?:\/\//, "") || "localhost:3000",
      apiVersion: ApiVersion.October24, // Using a widely supported stable version
      isEmbeddedApp: false,
    });
  }
  return shopifyInstance;
};
