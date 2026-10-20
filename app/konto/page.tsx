import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import AccountDashboard from "./account-dashboard";
import Link from "next/link";
import { generationAccess } from "../cappatex-generation-access";
import { isOwnerEmail } from "../../db/account";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/konto");

  return (
    <main className="account-page" id="main-content">
      <header className="account-nav">
        <Link className="brand" href="/"><span>AB</span><b>3D</b></Link>
        <Link href="/">← Zurück zum Shop</Link>
        <Link href="/sammlung">Meine 3D-Modelle</Link>
        <Link href="/cappatex/sammlung">Meine CAPPATEX-Motive</Link>
        <Link href="/cappatex/gestaltungen">Meine CAPPATEX-Gestaltungen</Link>
        {isOwnerEmail(user.email) && <Link href="/betrieb">AB3D Auftragsverwaltung</Link>}
        {generationAccess(user.email, "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed
          && <Link href="/cappatex/betrieb">CAPPATEX Betriebsprüfung</Link>}
        {/* The sign-out endpoint must be a full document request. */}
        <a href={chatGPTSignOutPath("/")}>Abmelden</a>
      </header>
      <AccountDashboard user={{ displayName: user.displayName, email: user.email }} />
    </main>
  );
}
