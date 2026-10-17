import { requireChatGPTUser } from "../../chatgpt-auth";
import SiteHeader from "../../site-header";
import Preparations from "./preparations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meine Gestaltungen | CAPPATEX", robots: { index: false, follow: false } };

export default async function PreparationsPage() {
  const user = await requireChatGPTUser("/cappatex/gestaltungen");
  return <main id="main-content" className="gallery-page gallery-page-cappatex">
    <SiteHeader area="cappatex" userName={user.fullName || user.displayName || null} />
    <div className="gallery-content"><Preparations /></div>
  </main>;
}
