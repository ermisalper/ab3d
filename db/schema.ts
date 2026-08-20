import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  tokenBalance: integer("token_balance").notNull().default(2),
  plan: text("plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  requestedPlan: text("requested_plan"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const tokenLedger = sqliteTable(
  "token_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().references(() => accounts.email),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    taskId: text("task_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("token_ledger_email_idx").on(table.email)],
);

export const generationTasks = sqliteTable(
  "generation_tasks",
  {
    taskId: text("task_id").primaryKey(),
    email: text("email").notNull().references(() => accounts.email),
    kind: text("kind").notNull(),
    tokenCost: integer("token_cost").notNull(),
    status: text("status").notNull().default("PENDING"),
    refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
    parentTaskId: text("parent_task_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("generation_tasks_email_idx").on(table.email)],
);

export const subscriptionRequests = sqliteTable(
  "subscription_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().references(() => accounts.email),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("subscription_requests_email_idx").on(table.email)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().references(() => accounts.email),
    status: text("status").notNull().default("inquiry"),
    customerName: text("customer_name").notNull(),
    phone: text("phone"),
    street: text("street").notNull(),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull().default("CH"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("CHF"),
    itemsJson: text("items_json").notNull(),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("orders_email_created_idx").on(table.email, table.createdAt)],
);

export const checkoutSessions = sqliteTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey(),
    accountEmail: text("account_email"),
    shopifyCartId: text("shopify_cart_id").notNull().unique(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("checkout_created"),
    itemsJson: text("items_json").notNull(),
    estimatedTotalCents: integer("estimated_total_cents").notNull(),
    currency: text("currency").notNull().default("CHF"),
    legalVersion: text("legal_version").notNull(),
    shopifyOrderId: text("shopify_order_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("checkout_sessions_email_created_idx").on(table.accountEmail, table.createdAt),
    index("checkout_sessions_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const shopifyOrders = sqliteTable(
  "shopify_orders",
  {
    orderId: text("order_id").primaryKey(),
    orderName: text("order_name"),
    customerEmail: text("customer_email"),
    customerName: text("customer_name").notNull(),
    phone: text("phone"),
    address1: text("address1").notNull(),
    address2: text("address2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    region: text("region"),
    country: text("country").notNull(),
    financialStatus: text("financial_status").notNull(),
    fulfillmentStatus: text("fulfillment_status"),
    channel: text("channel").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull(),
    itemsJson: text("items_json").notNull(),
    legalVersion: text("legal_version"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("shopify_orders_email_created_idx").on(table.customerEmail, table.createdAt),
    index("shopify_orders_status_created_idx").on(table.financialStatus, table.createdAt),
  ],
);

export const productionOrders = sqliteTable(
  "production_orders",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().references(() => accounts.email),
    status: text("status").notNull().default("awaiting_payment"),
    sourceTaskId: text("source_task_id").notNull().references(() => generationTasks.taskId),
    sourceTaskType: text("source_task_type").notNull().default("convert"),
    templateName: text("template_name").notNull(),
    heightMm: integer("height_mm").notNull(),
    material: text("material").notNull(),
    finish: text("finish").notNull(),
    quantity: integer("quantity").notNull().default(1),
    estimatedTotalCents: integer("estimated_total_cents").notNull(),
    currency: text("currency").notNull().default("CHF"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("production_orders_email_created_idx").on(table.email, table.createdAt),
    index("production_orders_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const cappatexDesigns = sqliteTable(
  "cappatex_designs",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().references(() => accounts.email),
    prompt: text("prompt").notNull(),
    productionPrompt: text("production_prompt").notNull(),
    style: text("style").notNull(),
    productKey: text("product_key").notNull(),
    previewBase64: text("preview_base64").notNull(),
    previewFormat: text("preview_format").notNull().default("webp"),
    printifyProductId: text("printify_product_id"),
    printifyVariantId: integer("printify_variant_id"),
    printifyBlueprintId: integer("printify_blueprint_id"),
    printifyProviderId: integer("printify_provider_id"),
    shopifyVariantId: text("shopify_variant_id"),
    shopifyCartId: text("shopify_cart_id"),
    shopifyOrderId: text("shopify_order_id"),
    printifyOrderId: text("printify_order_id"),
    placementJson: text("placement_json"),
    status: text("status").notNull().default("preview_ready"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("cappatex_designs_email_created_idx").on(table.email, table.createdAt),
    index("cappatex_designs_shopify_order_idx").on(table.shopifyOrderId),
  ],
);

export const cappatexWebhookEvents = sqliteTable("cappatex_webhook_events", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  receivedAt: integer("received_at").notNull(),
});
