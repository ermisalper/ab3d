"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { creatorPlans, planName, tokenRules } from "../creator-plans";
import TokenShop from "./token-shop";

type Account = {
  email: string;
  tokenBalance: number;
  plan: string;
  subscriptionStatus: string;
  requestedPlan: string | null;
  unlimited: boolean;
  isOwner: boolean;
  capabilities: {
    canUse3d: boolean;
    canUseCappatex: boolean;
    canDownload3d: boolean;
    canDownloadHd: boolean;
  };
};

type Order = {
  id: string;
  status: string;
  source?: "legacy" | "shopify" | "checkout";
  totalCents: number;
  currency: string;
  itemsJson: string;
  createdAt: number;
};

const shopOrderStatuses: Record<string, string> = {
  checkout_created: "Checkout begonnen",
  inquiry: "In Prüfung",
  paid: "Bezahlt",
  refunded: "Rückerstattet",
  partially_refunded: "Teilweise rückerstattet",
  voided: "Storniert",
};

type ProductionOrder = {
  id: string;
  email: string;
  status: string;
  sourceTaskId: string;
  templateName: string;
  heightMm: number;
  material: string;
  finish: string;
  quantity: number;
  estimatedTotalCents: number;
  currency: string;
  createdAt: number;
};

const productionStatuses: Record<string, string> = {
  inquiry: "Unverbindliche Anfrage · AB3D prüft",
  awaiting_payment: "Zahlung ausstehend",
  paid: "Bezahlt · STL druckbereit",
  production: "In Produktion",
  shipped: "Versendet",
  cancelled: "Storniert",
};

function parseOrderItems(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed) ? parsed : record(parsed) && Array.isArray(parsed.items) ? parsed.items : [];
    return items.filter((item): item is { name: string; quantity: number } => record(item)
      && typeof item.name === "string" && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0);
  } catch {
    return [];
  }
}

type User = { displayName: string; email: string };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const readableError = (data: unknown, fallback: string) => record(data) && typeof data.error === "string" && data.error.length <= 1000 ? data.error : fallback;
const amount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const orderRows = (value: unknown): value is Order[] => Array.isArray(value) && value.length <= 100 && value.every(row => record(row)
  && typeof row.id === "string" && typeof row.status === "string" && typeof row.itemsJson === "string"
  && typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) && amount(row.totalCents) && amount(row.createdAt));
const productionRows = (value: unknown): value is ProductionOrder[] => Array.isArray(value) && value.length <= 100 && value.every(row => record(row)
  && ["id", "email", "status", "sourceTaskId", "templateName", "material", "finish"].every(key => typeof row[key] === "string")
  && typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) && amount(row.estimatedTotalCents) && amount(row.createdAt)
  && amount(row.heightMm) && Number(row.heightMm) > 0 && amount(row.quantity) && Number(row.quantity) > 0);
function checkedAccount(data: unknown, email: string): Account | null {
  if (!record(data) || !record(data.account)) return null;
  const account = data.account;
  if (account.email !== email || !Number.isSafeInteger(account.tokenBalance) || Number(account.tokenBalance) < 0
    || typeof account.plan !== "string" || !account.plan || typeof account.subscriptionStatus !== "string"
    || !(account.requestedPlan === null || typeof account.requestedPlan === "string")
    || typeof account.unlimited !== "boolean" || typeof account.isOwner !== "boolean" || !record(account.capabilities)
    || !["canUse3d", "canUseCappatex", "canDownload3d", "canDownloadHd"].every(key => typeof (account.capabilities as Record<string, unknown>)[key] === "boolean")) return null;
  return account as unknown as Account;
}

export default function AccountDashboard({ user }: { user: User }) {
  return <OwnedAccountDashboard key={user.email} user={user} />;
}

function OwnedAccountDashboard({ user }: { user: User }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [accountError, setAccountError] = useState("");
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionError, setProductionError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const lifetime = useRef<AbortController | null>(null);
  const accountRevision = useRef(0), productionRevision = useRef(0);
  const planPending = useRef(false), statusPending = useRef(false);
  const current = (controller: AbortController) => lifetime.current === controller && !controller.signal.aborted;
  const signal = (controller: AbortController) => AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);

  const loadProductionOrders = async (owner = account?.isOwner || false) => {
    const controller = lifetime.current, revision = ++productionRevision.current;
    if (!controller || !current(controller)) return false;
    setProductionLoading(true); setProductionError("");
    try {
      const response = await fetch(`/api/production-orders${owner ? "?scope=production" : ""}`, { cache: "no-store", signal: signal(controller) });
      const data: unknown = await response.json();
      if (response.status !== 200 || !record(data) || !productionRows(data.orders)) throw new Error("unverified_orders");
      if (!current(controller) || revision !== productionRevision.current) return false;
      setProductionOrders(data.orders); return true;
    } catch {
      if (current(controller) && revision === productionRevision.current) setProductionError("Deine 3D-Anfragen konnten nicht aktualisiert werden. Bitte lade den Kontostatus erneut.");
      return false;
    } finally {
      if (current(controller) && revision === productionRevision.current) setProductionLoading(false);
    }
  };

  const loadAccount = async () => {
    const controller = lifetime.current, revision = ++accountRevision.current;
    if (!controller || !current(controller)) return false;
    setLoading(true); setAccountError("");
    try {
      const response = await fetch("/api/account", { cache: "no-store", signal: signal(controller) });
      const data: unknown = await response.json(), verified = checkedAccount(data, user.email);
      if (response.status !== 200 || !verified) throw new Error("unverified_account");
      if (!current(controller) || revision !== accountRevision.current) return false;
      setAccount(verified);
      void loadProductionOrders(verified.isOwner);
      return true;
    } catch {
      if (current(controller) && revision === accountRevision.current) {
        setAccountError("Dein Kontostatus und Guthaben konnten nicht aktualisiert werden. Frühere Angaben sind möglicherweise nicht mehr aktuell.");
        if (!account) { setProductionLoading(false); setProductionError("Deine 3D-Anfragen können erst nach bestätigtem Kontozugriff geladen werden."); }
      }
      return false;
    } finally {
      if (current(controller) && revision === accountRevision.current) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    void loadAccount();
    void fetch("/api/orders", { cache: "no-store", signal: signal(controller) })
      .then(async response => {
        const data: unknown = await response.json();
        if (response.status !== 200 || !record(data) || !orderRows(data.orders)) throw new Error("unverified_orders");
        if (current(controller)) setOrders(data.orders);
      })
      .catch(() => { if (current(controller)) setOrdersError("Deine Shop-Bestellungen konnten nicht geladen werden. Bitte lade die Seite erneut."); })
      .finally(() => { if (current(controller)) setOrdersLoading(false); });
    return () => controller.abort();
  // The email key owns this lifecycle; mutations refresh it explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPlan = async (plan: string) => {
    const controller = lifetime.current;
    if (!controller || !current(controller) || planPending.current) return;
    planPending.current = true; setBusyPlan(plan); setMessage("");
    const unconfirmed = "Die Abo-Anfrage konnte nicht bestätigt werden. Bitte lade den Kontostatus neu, bevor du sie erneut anfragst.";
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }), signal: signal(controller) });
      const data: unknown = await response.json();
      if (!current(controller)) return;
      if (response.status !== 200 || !record(data) || data.ok !== true || !record(data.request)
        || data.request.plan !== plan || data.request.status !== "pending" || typeof data.message !== "string") {
        setMessage(readableError(data, unconfirmed)); return;
      }
      setMessage(data.message);
      await loadAccount();
    } catch { if (current(controller)) setMessage(unconfirmed); }
    finally { planPending.current = false; if (current(controller)) setBusyPlan(""); }
  };

  const updateProductionStatus = async (id: string, status: string) => {
    const controller = lifetime.current;
    if (!controller || !current(controller) || statusPending.current || !account?.isOwner) return;
    statusPending.current = true; setBusyOrder(id); setMessage("");
    const unconfirmed = "Die Statusänderung konnte nicht bestätigt werden. Bitte lade den Kontostatus neu, bevor du sie erneut ausführst.";
    try {
      const response = await fetch("/api/production-orders", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }), signal: signal(controller) });
      const data: unknown = await response.json();
      if (!current(controller)) return;
      if (response.status !== 200 || !record(data) || data.ok !== true || typeof data.message !== "string") {
        setMessage(readableError(data, unconfirmed)); return;
      }
      setMessage(data.message); await loadProductionOrders(true);
    } catch { if (current(controller)) setMessage(unconfirmed); }
    finally { statusPending.current = false; if (current(controller)) setBusyOrder(""); }
  };

  const canDownloadProductionFile = (order: ProductionOrder) => {
    if (account?.isOwner) return ["paid", "production", "shipped"].includes(order.status);
    return Boolean(account?.capabilities.canDownload3d);
  };

  return (
    <div className="account-wrap">
      <section className="account-hero">
        <p className="eyebrow">AB3D Creator Account</p>
        <h1>Hallo, {user.displayName.split(" ")[0]}.</h1>
        <p>Verwalte deine Design-Tokens, Abos, Bestellungen und druckfertigen Dateien an einem Ort.</p>
        <div className="account-identity">{user.email}</div>
      </section>

      <section className="token-overview">
        <div>
          <span>Verfügbare Design-Tokens</span>
          <b>{loading ? "—" : account?.unlimited ? "∞" : account?.tokenBalance ?? "Ungeprüft"}</b>
          <small>{account?.unlimited ? "Launch-Pass aktiv · aktuell kein Token-Abzug." : "Vor jedem Auftrag siehst du den exakten Tokenpreis."}</small>
          <a className="token-topup-link" href="#tokens-kaufen">Tokens nachkaufen →</a>
        </div>
        <div>
          <span>Aktueller Plan</span>
          <b className="plan-name">{account ? planName(account.plan) : "Ungeprüft"}</b>
          <small>Status: {!account ? "Ungeprüft" : account.subscriptionStatus === "active" ? "Aktiv" : account.subscriptionStatus === "trialing" ? "Testphase" : account.subscriptionStatus === "pending" ? "Angefragt" : "Kostenlos"}</small>
          {account?.requestedPlan && <small>Separat angefragt: {planName(account.requestedPlan)} · Prüfung ausstehend</small>}
        </div>
        <Link className="button primary" href="/#studio">Neues 3D-Design</Link>
      </section>
      {accountError && <p className="account-message" role="alert">{accountError}</p>}
      <button type="button" disabled={loading || Boolean(busyPlan) || Boolean(busyOrder)} onClick={() => void loadAccount()}>Kontostatus neu laden</button>

      <TokenShop email={user.email} onRefreshBalance={loadAccount} />

      <section className="token-guide" aria-labelledby="token-guide-title">
        <div><p className="eyebrow">Einfach erklärt</p><h2 id="token-guide-title">Was kostet wie viele Tokens?</h2></div>
        <div className="token-rule-grid">
          {tokenRules.map(([tokens, use]) => <article key={tokens}><b>{tokens}</b><span>{use}</span></article>)}
        </div>
        <p>Tokens werden nur bei gestarteten KI- oder Druckaufbereitungen eingesetzt. Eine physische Bestellung enthält die interne Produktionsdatei für AB3D – du brauchst dafür kein Abo.</p>
      </section>

      <section className="order-history" id="3d-anfragen">
        <div className="section-heading">
          <div><p className="eyebrow">3D-Anfragen & Fertigung</p><h2>{account?.isOwner ? "Anfragen und Druckaufträge." : "Deine 3D-Anfragen."}</h2></div>
          <p>Neue Anfragen sind unverbindlich: AB3D prüft Modell, Herstellbarkeit und Richtpreis. Sie lösen keine Zahlung oder Produktion aus. Frühere Fertigungsaufträge behalten ihren bisherigen Status.</p>
        </div>
        {account?.isOwner && <p><Link className="button secondary" href="/betrieb">Alle AB3D-Anfragen prüfen →</Link></p>}
        {productionError && <p role="alert">{productionError}</p>}
        {productionOrders.length ? (
          <div className="production-order-list">
            {productionOrders.map((order) => (
              <article key={order.id}>
                <div className="production-order-main">
                  <span>{new Date(order.createdAt).toLocaleDateString("de-CH")} · {order.id}</span>
                  <h3>{order.templateName}</h3>
                  <p>{order.quantity}× · {order.heightMm / 10} cm · {order.material} · {order.finish}</p>
                  {account?.isOwner && <small>Kunde: {order.email}</small>}
                </div>
                <div className="production-order-actions">
                  <span className={`order-status status-${order.status}`}>{productionStatuses[order.status] || order.status}</span>
                  <strong>{order.status === "inquiry" ? "Richtpreis: " : ""}{new Intl.NumberFormat("de-CH", { style: "currency", currency: order.currency }).format(order.estimatedTotalCents / 100)}</strong>
                  {canDownloadProductionFile(order) ? (
                    <a className="production-file-link" href={`/api/meshy?format=stl&productionOrderId=${encodeURIComponent(order.id)}`} download>STL herunterladen</a>
                  ) : account?.isOwner ? (
                    <small>{order.status === "inquiry" ? "Anfrage wird persönlich geprüft; keine Produktionsfreigabe." : "STL nach Zahlungsfreigabe verfügbar"}</small>
                  ) : (
                    <Link className="production-file-link" href="#plaene">Eigenen STL-Download freischalten</Link>
                  )}
                  {account?.isOwner && (
                    <div className="production-status-buttons">
                      {order.status === "awaiting_payment" && <button disabled={Boolean(busyOrder)} onClick={() => updateProductionStatus(order.id, "paid")}>Zahlung bestätigen</button>}
                      {order.status === "paid" && <button disabled={Boolean(busyOrder)} onClick={() => updateProductionStatus(order.id, "production")}>Produktion starten</button>}
                      {order.status === "production" && <button disabled={Boolean(busyOrder)} onClick={() => updateProductionStatus(order.id, "shipped")}>Als versendet markieren</button>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : productionLoading ? <p role="status">Deine 3D-Anfragen werden geladen …</p> : !productionError && <div className="no-orders">Noch keine individuelle 3D-Anfrage. <Link href="/#studio">3D-Design erstellen →</Link></div>}
      </section>

      <section className="order-history">
        <div className="section-heading">
          <div><p className="eyebrow">Shop-Bestellungen</p><h2>Deine Objekte.</h2></div>
          <p>Deine auf AB3D gestarteten Checkouts und die von Shopify bestätigten Bestellungen.</p>
        </div>
        {ordersError && <p role="alert">{ordersError}</p>}
        {orders.length ? (
          <div className="order-list">
            {orders.map((order) => {
              const items = parseOrderItems(order.itemsJson);
              return (
                <article key={order.id}>
                  <div><span>{new Date(order.createdAt).toLocaleDateString("de-CH")}</span><b>{order.id}</b><small>{items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}</small></div>
                  <div><span className={`order-status status-${order.status}`}>{shopOrderStatuses[order.status] || order.status}</span><strong>{new Intl.NumberFormat("de-CH", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</strong></div>
                </article>
              );
            })}
          </div>
        ) : ordersLoading ? <p role="status">Deine Shop-Bestellungen werden geladen …</p> : !ordersError && <div className="no-orders">Noch keine Shop-Bestellung gespeichert. <Link href="/#kollektion">Kollektion entdecken →</Link></div>}
      </section>

      <section className="plans-section" id="plaene">
        <div className="section-heading">
          <div><p className="eyebrow">Einzeln oder gemeinsam</p><h2>Das passende Creator-Abo.</h2></div>
          <p>3D Studio für eigene 3D-Dateien, CAPPATEX für tragbare Motive oder Complete für beide Bereiche mit gemeinsamem Guthaben.</p>
        </div>
        <div className="plan-grid">
          {creatorPlans.map((plan) => (
            <article className={`plan-card ${plan.popular ? "popular" : ""}`} key={plan.id}>
              {plan.popular && <span className="plan-badge">Bestes Gesamtpaket</span>}
              <p>{plan.name}</p>
              <h3>{plan.price}<small>{plan.cadence}</small></h3>
              <strong>{plan.tokens}</strong>
              <span className="plan-audience">{plan.audience}</span>
              <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              {plan.id === "free" ? (
                <button disabled>Explorer ist inklusive</button>
              ) : (
                <button onClick={() => requestPlan(plan.id)} disabled={!account || loading || Boolean(busyPlan)}>
                  {busyPlan === plan.id ? "Wird gespeichert …" : account?.requestedPlan === plan.id ? "Angefragt ✓" : `${plan.name} anfragen`}
                </button>
              )}
            </article>
          ))}
        </div>
        {message && <div className="account-message" role="status">{message}</div>}
        <p className="billing-note">Die Auswahl wird aktuell als Abo-Anfrage gespeichert. Eine Belastung erfolgt erst nach deiner ausdrücklichen Zahlungsfreigabe.</p>
      </section>
    </div>
  );
}
