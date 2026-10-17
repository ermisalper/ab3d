import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { generationAccess } from "../../cappatex-generation-access";
import Operations from "./operations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Betriebsprüfung | CAPPATEX", robots: { index: false, follow: false } };
export default async function OperationsPage() {
  const user = await requireChatGPTUser("/cappatex/betrieb");
  if (!generationAccess(user.email, "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed) redirect("/konto");
  return <main id="main-content" className="account-page" style={{ maxWidth: 1000, margin: "32px auto", padding: "0 20px" }}>
    <nav className="account-nav" aria-label="Betreiberbereich"><Link href="/konto">← Mein Konto</Link><Link href="/cappatex">CAPPATEX Studio</Link></nav>
    <p className="eyebrow">Nur für den Betreiber</p><h1>Bestellungen im Blick</h1>
    <p>Prüfe Freigaben und Aufträge, die deine Aufmerksamkeit brauchen. Hier werden keine Bestellungen oder Produktionsaufträge ausgelöst.</p>
    <Operations />
  </main>;
}
