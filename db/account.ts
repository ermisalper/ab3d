import { env } from "cloudflare:workers";
import { planCapabilities } from "../app/creator-plans";

export type AccountSummary = {
  email: string;
  displayName: string | null;
  tokenBalance: number;
  plan: string;
  subscriptionStatus: string;
  requestedPlan: string | null;
};

export function hasUnlimitedTokens(email: string) {
  return (process.env.AB3D_UNLIMITED_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

export function isOwnerEmail(email: string) {
  const owners = `${process.env.AB3D_OWNER_EMAILS || ""},${process.env.AB3D_UNLIMITED_EMAILS || ""}`
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email.trim().toLowerCase());
}

export function accountCapabilities(account: Pick<AccountSummary, "plan" | "subscriptionStatus" | "email">) {
  return planCapabilities(account.plan, account.subscriptionStatus, hasUnlimitedTokens(account.email));
}

export async function ensureAccount(email: string, displayName?: string | null): Promise<AccountSummary> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO accounts
      (email, display_name, token_balance, plan, subscription_status, created_at, updated_at)
     VALUES (?, ?, 4, 'free', 'inactive', ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       display_name = COALESCE(excluded.display_name, accounts.display_name),
       updated_at = excluded.updated_at`,
  ).bind(email, displayName || null, now, now).run();

  const row = await env.DB.prepare(
    `SELECT email, display_name AS displayName, token_balance AS tokenBalance,
            plan, subscription_status AS subscriptionStatus, requested_plan AS requestedPlan
     FROM accounts WHERE email = ?`,
  ).bind(email).first<AccountSummary>();
  if (!row) throw new Error("ACCOUNT_UNAVAILABLE");
  return row;
}

export async function chargeTokens(
  email: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (hasUnlimitedTokens(email)) return getTokenBalance(email);
  const now = Date.now();
  const updated = await env.DB.prepare(
    `UPDATE accounts
     SET token_balance = token_balance - ?, updated_at = ?
     WHERE email = ? AND token_balance >= ?`,
  ).bind(amount, now, email, amount).run();
  if (!updated.meta.changes) throw new Error("INSUFFICIENT_TOKENS");

  await env.DB.prepare(
    "INSERT INTO token_ledger (email, delta, reason, created_at) VALUES (?, ?, ?, ?)",
  ).bind(email, -amount, reason, now).run();

  return getTokenBalance(email);
}

export async function refundTokens(
  email: string,
  taskId: string,
  amount: number,
  reason: string,
): Promise<number> {
  const now = Date.now();
  const marked = await env.DB.prepare(
    "UPDATE generation_tasks SET refunded = 1, status = 'FAILED', updated_at = ? WHERE task_id = ? AND email = ? AND refunded = 0",
  ).bind(now, taskId, email).run();
  if (marked.meta.changes) {
    await env.DB.batch([
      env.DB.prepare("UPDATE accounts SET token_balance = token_balance + ?, updated_at = ? WHERE email = ?").bind(amount, now, email),
      env.DB.prepare("INSERT INTO token_ledger (email, delta, reason, task_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(email, amount, reason, taskId, now),
    ]);
  }
  return getTokenBalance(email);
}

export async function getTokenBalance(email: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT token_balance AS tokenBalance FROM accounts WHERE email = ?",
  ).bind(email).first<{ tokenBalance: number }>();
  return Number(row?.tokenBalance || 0);
}

export async function creditTokens(email: string, amount: number, reason: string, taskId?: string) {
  if (hasUnlimitedTokens(email)) return getTokenBalance(email);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE accounts SET token_balance = token_balance + ?, updated_at = ? WHERE email = ?").bind(amount, now, email),
    env.DB.prepare("INSERT INTO token_ledger (email, delta, reason, task_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(email, amount, reason, taskId || null, now),
  ]);
  return getTokenBalance(email);
}

export async function recordTask(
  taskId: string,
  email: string,
  kind: string,
  tokenCost: number,
  parentTaskId?: string,
) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO generation_tasks
      (task_id, email, kind, token_cost, status, refunded, parent_task_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)`,
  ).bind(taskId, email, kind, tokenCost, parentTaskId || null, now, now).run();
}

export async function getOwnedTask(taskId: string, email: string) {
  return env.DB.prepare(
    `SELECT task_id AS taskId, kind, token_cost AS tokenCost, status, refunded
     FROM generation_tasks WHERE task_id = ? AND email = ?`,
  ).bind(taskId, email).first<{
    taskId: string;
    kind: string;
    tokenCost: number;
    status: string;
    refunded: number;
  }>();
}

export async function updateTaskStatus(taskId: string, email: string, status: string) {
  await env.DB.prepare(
    "UPDATE generation_tasks SET status = ?, updated_at = ? WHERE task_id = ? AND email = ?",
  ).bind(status, Date.now(), taskId, email).run();
}
