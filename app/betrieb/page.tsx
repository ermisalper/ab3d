import { redirect } from "next/navigation";
import { isOwnerEmail } from "../../db/account";
import { requireChatGPTUser } from "../chatgpt-auth";
import Operations from "./operations";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Auftragsverwaltung | AB3D",
  robots: { index: false, follow: false },
};

export default async function OperationsPage() {
  const user = await requireChatGPTUser("/betrieb");
  if (!isOwnerEmail(user.email)) redirect("/konto");
  return <main id="main-content" className="ab3d-operations">
    <header className="ab3d-ops-heading">
      <p className="eyebrow">Nur für den Betreiber · 3D-Druck</p>
      <h1>AB3D Auftragsverwaltung</h1>
      <p>Anfragen prüfen, Kundendaten ansehen und die nächsten Schritte festhalten.</p>
    </header>
    <Operations key={user.email} ownerEmail={user.email} />
  </main>;
}
