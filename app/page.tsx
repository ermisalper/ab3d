import ShopExperience from "./shop-experience";
import { getChatGPTUser } from "./chatgpt-auth";
import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "./shopify-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, catalog] = await Promise.all([
    getChatGPTUser(),
    fetchShopifyCollection(SHOPIFY_COLLECTIONS.ab3d).catch((error) => {
      console.error("AB3D Shopify catalog unavailable", { type: error instanceof Error ? error.message : "unknown" });
      return null;
    }),
  ]);
  return <ShopExperience user={user ? { displayName: user.displayName, email: user.email } : null} products={catalog?.products || []} />;
}
