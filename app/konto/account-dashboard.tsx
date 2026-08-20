"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { creatorPlans, planName, tokenRules } from "../creator-plans";

type Account = {
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
  awaiting_payment: "Zahlung ausstehend",
  paid: "Bezahlt · STL druckbereit",
  production: "In Produktion",
  shipped: "Versendet",
  cancelled: "Storniert",
};

function parseOrderItems(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed as Array<{ name: string; quantity: number }>;
    if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) {
      return parsed.items as Array<{ name: string; quantity: number }>;
    }
    return [];
  } catch {
    return [];
  }
}

export default function AccountDashboard({ user }: { user: { displayName: string; email: string } }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);

  const loadProductionOrders = async (owner = account?.isOwner || false) => {
    const response = await fetch(`/api/production-orders${owner ? "?scope=production" : ""}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setProductionOrders(data.orders || []);
    }
  };

  const loadAccount = async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setAccount(data.account);
      await loadProductionOrders(Boolean(data.account.isOwner));
    } else {
      setMessage(data.error || "Konto konnte nicht geladen werden.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetch("/api/account", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(async ({ response, data }) => {
        if (!response.ok) throw new Error(data.error || "Konto konnte nicht geladen werden.");
        setAccount(data.account);
        await loadProductionOrders(Boolean(data.account.isOwner));
        setLoading(false);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Konto konnte nicht geladen werden.");
        setLoading(false);
      });
    void fetch("/api/orders", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { orders: [] })
      .then((data) => setOrders(data.orders || []))
      .catch(() => undefined);
  // The dashboard loads once for the authenticated session; mutations refresh it explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPlan = async (plan: string) => {
    setBusyPlan(plan);
    setMessage("");
    const response = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await response.json();
    setMessage(data.message || data.error);
    await loadAccount();
    setBusyPlan("");
  };

  const updateProductionStatus = async (id: string, status: string) => {
    setBusyOrder(id);
    setMessage("");
    const response = await fetch("/api/production-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await response.json();
    setMessage(data.message || data.error);
    if (response.ok) await loadProductionOrders(true);
    setBusyOrder("");
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
          <b>{loading ? "—" : account?.unlimited ? "∞" : account?.tokenBalance ?? 0}</b>
          <small>{account?.unlimited ? "Launch-Pass aktiv · aktuell kein Token-Abzug." : "Vor jedem Auftrag siehst du den exakten Tokenpreis."}</small>
        </div>
        <div>
          <span>Aktueller Plan</span>
          <b className="plan-name">{account ? planName(account.plan) : "Explorer"}</b>
          <small>Status: {account?.subscriptionStatus === "active" ? "Aktiv" : account?.subscriptionStatus === "pending" ? "Angefragt" : "Kostenlos"}</small>
        </div>
        <Link className="button primary" href="/#studio">Neues 3D-Design</Link>
      </section>

      <section className="token-guide" aria-labelledby="token-guide-title">
        <div><p className="eyebrow">Einfach erklärt</p><h2 id="token-guide-title">Was kostet wie viele Tokens?</h2></div>
        <div className="token-rule-grid">
          {tokenRules.map(([tokens, use]) => <article key={tokens}><b>{tokens}</b><span>{use}</span></article>)}
        </div>
        <p>Tokens werden nur bei gestarteten KI- oder Druckaufbereitungen eingesetzt. Eine physische Bestellung enthält die interne Produktionsdatei für AB3D – du brauchst dafür kein Abo.</p>
      </section>

      <section className="order-history">
        <div className="section-heading">
          <div><p className="eyebrow">Fertigungsaufträge</p><h2>{account?.isOwner ? "Druckwarteschlange." : "Deine 3D-Aufträge."}</h2></div>
          <p>Nach bestätigter Zahlung wird die STL für AB3D freigeschaltet. Eigene STL-Downloads sind im 3D-Studio- und Complete-Abo enthalten.</p>
        </div>
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
                  <strong>{new Intl.NumberFormat("de-CH", { style: "currency", currency: order.currency }).format(order.estimatedTotalCents / 100)}</strong>
                  {canDownloadProductionFile(order) ? (
                    <a className="production-file-link" href={`/api/meshy?format=stl&productionOrderId=${encodeURIComponent(order.id)}`} download>STL herunterladen</a>
                  ) : account?.isOwner ? (
                    <small>STL nach Zahlungsfreigabe verfügbar</small>
                  ) : (
                    <Link className="production-file-link" href="#plaene">Eigenen STL-Download freischalten</Link>
                  )}
                  {account?.isOwner && (
                    <div className="production-status-buttons">
                      {order.status === "awaiting_payment" && <button disabled={busyOrder === order.id} onClick={() => updateProductionStatus(order.id, "paid")}>Zahlung bestätigen</button>}
                      {order.status === "paid" && <button disabled={busyOrder === order.id} onClick={() => updateProductionStatus(order.id, "production")}>Produktion starten</button>}
                      {order.status === "production" && <button disabled={busyOrder === order.id} onClick={() => updateProductionStatus(order.id, "shipped")}>Als versendet markieren</button>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="no-orders">Noch kein individueller Fertigungsauftrag. <Link href="/#studio">3D-Design erstellen →</Link></div>}
      </section>

      <section className="order-history">
        <div className="section-heading">
          <div><p className="eyebrow">Shop-Bestellungen</p><h2>Deine Objekte.</h2></div>
          <p>Deine auf AB3D gestarteten Checkouts und die von Shopify bestätigten Bestellungen.</p>
        </div>
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
        ) : <div className="no-orders">Noch keine Shop-Bestellung gespeichert. <Link href="/#kollektion">Kollektion entdecken →</Link></div>}
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
                <button onClick={() => requestPlan(plan.id)} disabled={Boolean(busyPlan)}>
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
