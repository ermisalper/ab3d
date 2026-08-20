import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import AccountDashboard from "./account-dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/konto");

  return (
    <main className="account-page" id="main-content">
      <header className="account-nav">
        <Link className="brand" href="/"><span>AB</span><b>3D</b></Link>
        <Link href="/">← Zurück zum Shop</Link>
        {/* The sign-out endpoint must be a full document request. */}
        <a href={chatGPTSignOutPath("/")}>Abmelden</a>
      </header>
      <AccountDashboard user={{ displayName: user.displayName, email: user.email }} />
    </main>
  );
}
