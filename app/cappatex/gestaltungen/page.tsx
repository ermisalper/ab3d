import { requireChatGPTUser } from "../../chatgpt-auth";
import SiteHeader from "../../site-header";
import Preparations, { type PreparationHistoryFilters } from "./preparations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meine Gestaltungen | CAPPATEX", robots: { index: false, follow: false } };

export default async function PreparationsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireChatGPTUser("/cappatex/gestaltungen");
  const params = await searchParams || {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sides = typeof params.sides === "string" ? params.sides : "all";
  const valid = q.length <= 80 && !Array.isArray(params.q) && !Array.isArray(params.sides) && ["all", "front", "back", "both"].includes(sides);
  const filters: PreparationHistoryFilters = valid ? { q, sides: sides as PreparationHistoryFilters["sides"] } : { q: "", sides: "all" };
  return <main id="main-content" className="gallery-page gallery-page-cappatex">
    <SiteHeader area="cappatex" userName={user.fullName || user.displayName || null} />
    <div className="gallery-content"><Preparations key={JSON.stringify([filters, valid])} initialFilters={filters} initialError={valid ? "" : "Diese Suchfilter sind ungültig. Bitte setze die Filter zurück oder starte eine neue Suche."} /></div>
  </main>;
}
