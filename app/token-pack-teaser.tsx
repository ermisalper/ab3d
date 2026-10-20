import Link from "next/link";
import { TOKEN_PACKS } from "./token-packs";

export default function TokenPackTeaser({ signedIn }: { signedIn: boolean }) {
  return <div className="token-pack-teaser"><div><p className="eyebrow">Lieber ohne Abo?</p><h3>Tokens auch einzeln nachkaufen.</h3><p>Einmalige Pakete für weitere Ideen. Die Kaufverfügbarkeit siehst du in deinem Konto.</p></div>
    <ul>{TOKEN_PACKS.map(pack => <li key={pack.id}><strong>{pack.tokens} Tokens</strong><span>CHF {new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(pack.priceCents / 100)}</span></li>)}</ul>
    <Link className="button secondary" href={signedIn ? "/konto#tokens-kaufen" : "/signin-with-chatgpt?return_to=%2Fkonto%23tokens-kaufen"}>Tokenpakete ansehen →</Link>
  </div>;
}
