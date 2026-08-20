import { getChatGPTUser } from "../../chatgpt-auth";
import { env } from "cloudflare:workers";
import {
  accountCapabilities,
  chargeTokens,
  ensureAccount,
  getOwnedTask,
  getTokenBalance,
  hasUnlimitedTokens,
  isOwnerEmail,
  recordTask,
  refundTokens,
  updateTaskStatus,
} from "../../../db/account";
import { buildDesignPlan, buildServerMeshPrompt } from "../../design-planner";

const MESHY_API = "https://api.meshy.ai/openapi";
const TASK_ID = /^[a-zA-Z0-9-]{8,80}$/;
const MAX_PROMPT_LENGTH = 600;
const MAX_IMAGE_DATA_LENGTH = 11_500_000;
const TASK_ENDPOINTS = {
  text: "/v2/text-to-3d",
  image: "/v1/image-to-3d",
  "image-transform": "/v1/image-to-image",
  resize: "/v1/resize",
  convert: "/v1/convert",
  "print-analyze": "/v1/print/analyze",
  "print-repair": "/v1/print/repair",
} as const;
type TaskType = keyof typeof TASK_ENDPOINTS;
type ModelTaskType = Exclude<TaskType, "image-transform" | "print-analyze">;

function getApiKey() {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY_NOT_CONFIGURED");
  return key;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function meshyFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${MESHY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({ message: "Die Design Engine lieferte keine lesbare Antwort." }));
  if (!response.ok) {
    const detail = String(data?.message || data?.detail || data?.error || "Der Designauftrag ist fehlgeschlagen.")
      .replace(/meshy/gi, "AB3D Design Engine");
    const messages: Record<number, string> = {
      400: `Die Design Engine konnte die Eingabe nicht verarbeiten: ${detail}`,
      401: "Die Design Engine ist nicht korrekt autorisiert. Bitte AB3D informieren.",
      402: "Für diese Generierung ist momentan kein Verarbeitungsguthaben verfügbar.",
      429: "Die Design Engine ist momentan ausgelastet. Bitte versuche es in einigen Minuten erneut.",
    };
    return { ok: false as const, status: response.status, error: messages[response.status] || String(detail) };
  }
  return { ok: true as const, data };
}

async function authenticatedAccount() {
  const user = await getChatGPTUser();
  if (!user) return null;
  await ensureAccount(user.email, user.fullName);
  return user;
}

async function ownedModelUrl(options: {
  email: string;
  taskId?: string;
  taskType?: string;
  format?: "glb" | "stl" | "3mf";
}) {
  const taskId = options.taskId || "";
  const taskType = options.taskType || "";
  const format = options.format || "glb";
  if (!TASK_ID.test(taskId) || !["text", "image", "resize", "convert", "print-repair"].includes(taskType)) {
    return { ok: false as const, status: 400, error: "Ungültige Modellquelle." };
  }
  const modelTaskType = taskType as ModelTaskType;
  const ownedTask = await getOwnedTask(taskId, options.email);
  if (!ownedTask || ownedTask.status !== "SUCCEEDED") {
    return { ok: false as const, status: 403, error: "Dieses Modell ist noch nicht fertig oder gehört nicht zu deinem Konto." };
  }
  const task = await meshyFetch(`${TASK_ENDPOINTS[modelTaskType]}/${taskId}`);
  if (!task.ok) return task;
  const modelUrl = task.data?.model_urls?.[format];
  if (typeof modelUrl !== "string" || !modelUrl.startsWith("https://assets.meshy.ai/")) {
    return { ok: false as const, status: 404, error: `Für dieses Modell ist keine ${format.toUpperCase()}-Datei verfügbar.` };
  }
  return { ok: true as const, modelUrl };
}

async function chargeOrReply(email: string, amount: number, reason: string) {
  try {
    return { ok: true as const, balance: await chargeTokens(email, amount, reason) };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_TOKENS") {
      return {
        ok: false as const,
        response: Response.json({
          error: "Du hast nicht genügend Design-Tokens. Wähle im Konto einen passenden Plan.",
          code: "INSUFFICIENT_TOKENS",
        }, { status: 402 }),
      };
    }
    throw error;
  }
}

async function beginChargedTask(options: {
  email: string;
  amount: number;
  reason: string;
  refundReason: string;
  path: string;
  payload: Record<string, unknown>;
  kind: string;
  parentTaskId?: string;
}) {
  const tokenCost = hasUnlimitedTokens(options.email) ? 0 : options.amount;
  const charge = await chargeOrReply(options.email, options.amount, options.reason);
  if (!charge.ok) return { ok: false as const, response: charge.response };

  const result = await meshyFetch(options.path, {
    method: "POST",
    body: JSON.stringify(options.payload),
  });
  if (!result.ok) {
    if (tokenCost > 0) await refundUnstartedCharge(options.email, tokenCost, options.refundReason);
    return {
      ok: false as const,
      response: Response.json(
        { error: result.error, tokenBalance: await getTokenBalance(options.email) },
        { status: result.status },
      ),
    };
  }

  await recordTask(result.data.result, options.email, options.kind, tokenCost, options.parentTaskId);
  return {
    ok: true as const,
    taskId: result.data.result as string,
    tokenBalance: charge.balance,
  };
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Unzulässige Anfrage." }, { status: 403 });
    const user = await authenticatedAccount();
    if (!user) return Response.json({ error: "Bitte melde dich an, um den KI-Generator zu verwenden." }, { status: 401 });
    const account = await ensureAccount(user.email, user.fullName);
    if (!accountCapabilities(account).canUse3d) {
      return Response.json({ error: "Das 3D Design Studio ist im 3D-Studio- oder Complete-Abo enthalten." }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_DATA_LENGTH + 30_000) {
      return Response.json({ error: "Die Bilddatei ist zu gross." }, { status: 413 });
    }

    const body = await request.json() as {
      action?: "create" | "refine" | "transform-image" | "resize" | "analyze" | "repair" | "convert";
      type?: "text" | "image";
      prompt?: string;
      texturePrompt?: string;
      imageData?: string;
      inputTaskId?: string;
      printReady?: boolean;
      quality?: "fast" | "quality";
      willRefine?: boolean;
      previewTaskId?: string;
      modelTaskId?: string;
      sourceTaskId?: string;
      sourceTaskType?: string;
      sourceFormat?: "glb" | "stl" | "3mf";
      heightCm?: number;
      designPlan?: {
        templateId?: string;
        idea?: string;
        answers?: Record<string, string>;
        planVersion?: string;
      };
      visualDirection?: {
        style?: string;
        surface?: string;
        colorMood?: string;
      };
    };

    if (["analyze", "repair", "convert"].includes(body.action || "")) {
      const source = await ownedModelUrl({
        email: user.email,
        taskId: body.sourceTaskId,
        taskType: body.sourceTaskType,
        format: body.sourceFormat || "glb",
      });
      if (!source.ok) return Response.json({ error: source.error }, { status: source.status });

      if (body.action === "analyze") {
        const result = await meshyFetch("/v1/print/analyze", {
          method: "POST",
          body: JSON.stringify({ model_url: source.modelUrl }),
        });
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
        await recordTask(result.data.result, user.email, "print-analyze", 0, body.sourceTaskId);
        return Response.json({ taskId: result.data.result, type: "print-analyze", tokenBalance: await getTokenBalance(user.email) });
      }

      const isRepair = body.action === "repair";
      const task = await beginChargedTask({
        email: user.email,
        amount: 1,
        reason: isRepair ? "Druckgeometrie reparieren" : "Druckformate erstellen",
        refundReason: isRepair ? "Druckreparatur nicht gestartet" : "Dateikonvertierung nicht gestartet",
        path: isRepair ? "/v1/print/repair" : "/v1/convert",
        payload: isRepair
          ? { model_url: source.modelUrl, alpha_thumbnail: true }
          : { model_url: source.modelUrl, target_formats: ["stl", "3mf"] },
        kind: isRepair ? "print-repair" : "convert",
        parentTaskId: body.sourceTaskId,
      });
      if (!task.ok) return task.response;
      return Response.json({ taskId: task.taskId, type: isRepair ? "print-repair" : "convert", tokenBalance: task.tokenBalance });
    }

    if (body.action === "transform-image") {
      const imageData = body.imageData || "";
      const prompt = body.prompt?.trim() || "";
      if (!validImage(imageData)) {
        return Response.json({ error: "Bitte verwende ein gültiges JPG- oder PNG-Bild bis 8 MB." }, { status: 400 });
      }
      if (prompt.length < 12 || prompt.length > MAX_PROMPT_LENGTH) {
        return Response.json({ error: "Beschreibe die gewünschte Interpretation mit 12 bis 600 Zeichen." }, { status: 400 });
      }
      if (!hasUnlimitedTokens(user.email) && await getTokenBalance(user.email) < 3) {
        return Response.json({
          error: "Für kreative Bildinterpretation und das anschliessende 3D-Modell brauchst du 3 Tokens.",
          code: "INSUFFICIENT_TOKENS",
        }, { status: 402 });
      }
      const task = await beginChargedTask({
        email: user.email,
        amount: 1,
        reason: "Kreative Bildinterpretation",
        refundReason: "Bildinterpretation nicht gestartet",
        path: "/v1/image-to-image",
        payload: {
          ai_model: "nano-banana",
          prompt,
          reference_image_urls: [imageData],
          generate_multi_view: false,
          aspect_ratio: "1:1",
        },
        kind: "image-transform",
      });
      if (!task.ok) return task.response;
      return Response.json({ taskId: task.taskId, type: "image-transform", tokenBalance: task.tokenBalance });
    }

    if (body.action === "resize") {
      const heightCm = Number(body.heightCm);
      if (!Number.isFinite(heightCm) || heightCm < 5 || heightCm > 80) return Response.json({ error: "Bitte wähle eine Höhe zwischen 5 und 80 cm." }, { status: 400 });
      const source = await ownedModelUrl({
        email: user.email,
        taskId: body.sourceTaskId || body.modelTaskId,
        taskType: body.sourceTaskType || "text",
        format: "glb",
      });
      if (!source.ok) return Response.json({ error: source.error }, { status: source.status });
      const task = await beginChargedTask({
        email: user.email,
        amount: 1,
        reason: `Modell auf ${heightCm} cm skalieren`,
        refundReason: "Skalierung nicht gestartet",
        path: "/v1/resize",
        payload: {
          model_url: source.modelUrl,
          resize_height: Math.round(heightCm * 10) / 1000,
          origin_at: "bottom",
        },
        kind: "resize",
        parentTaskId: body.sourceTaskId || body.modelTaskId,
      });
      if (!task.ok) return task.response;
      return Response.json({ taskId: task.taskId, type: "resize", tokenBalance: task.tokenBalance });
    }

    if (body.action === "refine") {
      if (!body.previewTaskId || !TASK_ID.test(body.previewTaskId)) {
        return Response.json({ error: "Ungültige Vorschau-ID." }, { status: 400 });
      }
      const parent = await getOwnedTask(body.previewTaskId, user.email);
      if (!parent) return Response.json({ error: "Diese Vorschau gehört nicht zu deinem Konto." }, { status: 403 });

      const task = await beginChargedTask({
        email: user.email,
        amount: 1,
        reason: "Textur-Generierung",
        refundReason: "Textur-Auftrag nicht gestartet",
        path: "/v2/text-to-3d",
        payload: {
          mode: "refine",
          preview_task_id: body.previewTaskId,
          ai_model: "latest",
          enable_pbr: true,
          texture_resolution: "2k",
          remove_lighting: true,
          ...(body.texturePrompt?.trim() ? { texture_prompt: body.texturePrompt.trim().slice(0, MAX_PROMPT_LENGTH) } : {}),
          target_formats: ["glb"],
        },
        kind: "text-refine",
        parentTaskId: body.previewTaskId,
      });
      if (!task.ok) return task.response;
      return Response.json({ taskId: task.taskId, type: "text", tokenBalance: task.tokenBalance });
    }

    if (body.action !== "create" || !["text", "image"].includes(body.type || "")) {
      return Response.json({ error: "Ungültiger Generierungsauftrag." }, { status: 400 });
    }

    if (body.type === "text") {
      const submittedPlan = body.designPlan;
      if (!submittedPlan || submittedPlan.planVersion !== "ab3d-print-plan-v2") {
        return Response.json({ error: "Bitte schliesse zuerst den AB3D Produktplaner ab." }, { status: 400 });
      }
      const validatedPlan = buildDesignPlan(
        String(submittedPlan.templateId || "").slice(0, 40),
        String(submittedPlan.idea || "").slice(0, 240),
        submittedPlan.answers && typeof submittedPlan.answers === "object" ? submittedPlan.answers : {},
      );
      if (!validatedPlan.complete) {
        return Response.json({ error: "Im Produktplan fehlen noch funktionale Angaben." }, { status: 400 });
      }
      const prompt = buildServerMeshPrompt(validatedPlan, {
        style: String(body.visualDirection?.style || "").slice(0, 120),
        surface: String(body.visualDirection?.surface || "").slice(0, 120),
        colorMood: String(body.visualDirection?.colorMood || "").slice(0, 80),
        printReady: body.printReady,
      }).slice(0, MAX_PROMPT_LENGTH);
      const quality = body.quality === "quality" ? "quality" : "fast";
      if (prompt.length < 12 || prompt.length > MAX_PROMPT_LENGTH) {
        return Response.json({ error: "Der Prompt muss zwischen 12 und 600 Zeichen enthalten." }, { status: 400 });
      }
      if (!hasUnlimitedTokens(user.email) && body.willRefine && await getTokenBalance(user.email) < 2) {
        return Response.json({
          error: "Für Geometrie und Textur brauchst du zusammen 2 Tokens.",
          code: "INSUFFICIENT_TOKENS",
        }, { status: 402 });
      }
      const task = await beginChargedTask({
        email: user.email,
        amount: 1,
        reason: "Text-zu-3D-Geometrie",
        refundReason: "Text-Auftrag nicht gestartet",
        path: "/v2/text-to-3d",
        payload: {
          mode: "preview",
          prompt,
          model_type: "standard",
          ai_model: "latest",
          should_remesh: quality === "quality" && Boolean(body.printReady),
          moderation: true,
          target_formats: ["glb"],
          alpha_thumbnail: true,
          origin_at: "bottom",
        },
        kind: "text-preview",
      });
      if (!task.ok) return task.response;
      return Response.json({ taskId: task.taskId, type: "text", tokenBalance: task.tokenBalance });
    }

    const imageData = body.imageData || "";
    const inputTaskId = body.inputTaskId || "";
    const quality = body.quality === "quality" ? "quality" : "fast";
    const texturePrompt = body.texturePrompt?.trim().slice(0, MAX_PROMPT_LENGTH) || "";
    if (!inputTaskId && !validImage(imageData)) {
      return Response.json({ error: "Bitte verwende ein gültiges JPG- oder PNG-Bild bis 8 MB." }, { status: 400 });
    }
    if (inputTaskId) {
      if (!TASK_ID.test(inputTaskId)) return Response.json({ error: "Ungültige Bild-Auftrags-ID." }, { status: 400 });
      const parent = await getOwnedTask(inputTaskId, user.email);
      if (!parent || parent.status !== "SUCCEEDED") {
        return Response.json({ error: "Die kreative Bildinterpretation ist noch nicht fertig oder gehört nicht zu dir." }, { status: 403 });
      }
    }
    const task = await beginChargedTask({
      email: user.email,
      amount: quality === "quality" ? 2 : 1,
      reason: "Bild-zu-3D mit Textur",
      refundReason: "Bild-Auftrag nicht gestartet",
      path: "/v1/image-to-3d",
      payload: {
        ...(inputTaskId ? { input_task_id: inputTaskId } : { image_url: imageData }),
        model_type: "standard",
        ai_model: "latest",
        should_remesh: quality === "quality" && Boolean(body.printReady),
        ...(quality === "quality" && body.printReady ? { target_polycount: 100000 } : {}),
        should_texture: quality === "quality",
        ...(quality === "quality" ? { enable_pbr: true, texture_resolution: "2k", remove_lighting: true } : {}),
        image_enhancement: true,
        ...(quality === "quality" && texturePrompt ? { texture_prompt: texturePrompt } : {}),
        target_formats: ["glb"],
        alpha_thumbnail: true,
        origin_at: "bottom",
      },
      kind: "image",
      parentTaskId: inputTaskId || undefined,
    });
    if (!task.ok) return task.response;
    return Response.json({ taskId: task.taskId, type: "image", tokenBalance: task.tokenBalance });
  } catch (error) {
    const message = error instanceof Error && error.message === "MESHY_API_KEY_NOT_CONFIGURED"
      ? "Der KI-Generator ist noch nicht aktiviert."
      : "Der KI-Dienst konnte nicht erreicht werden. Bitte versuche es erneut.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedAccount();
    if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

    const url = new URL(request.url);
    if (url.searchParams.get("health") === "1") {
      const health = await meshyFetch("/v1/balance");
      if (!health.ok) return Response.json({ error: health.error, service: "ab3d-design-engine" }, { status: health.status });
      return Response.json({ ok: true, service: "ab3d-design-engine" }, { headers: { "Cache-Control": "private, no-store" } });
    }

    let taskId = url.searchParams.get("taskId") || "";
    let type = url.searchParams.get("type") as TaskType | null;
    let ownershipEmail = user.email;
    const productionOrderId = url.searchParams.get("productionOrderId") || "";
    const requestedFormat = url.searchParams.get("format") as "glb" | "stl" | "3mf" | null;

    if (productionOrderId) {
      const order = await env.DB.prepare(
        `SELECT email, status, source_task_id AS sourceTaskId, source_task_type AS sourceTaskType
         FROM production_orders WHERE id = ?`,
      ).bind(productionOrderId).first<{ email: string; status: string; sourceTaskId: string; sourceTaskType: TaskType }>();
      if (!order || (order.email !== user.email && !isOwnerEmail(user.email))) {
        return Response.json({ error: "Dieser Produktionsauftrag ist nicht verfügbar." }, { status: 403 });
      }
      if (order.email === user.email && !isOwnerEmail(user.email)) {
        const account = await ensureAccount(user.email, user.fullName);
        if (!accountCapabilities(account).canDownload3d) {
          return Response.json({ error: "STL- und 3MF-Downloads sind im 3D-Studio- oder Complete-Abo enthalten." }, { status: 403 });
        }
      } else if (isOwnerEmail(user.email) && !["paid", "production", "shipped"].includes(order.status)) {
        return Response.json({ error: "Die Produktionsdatei wird nach bestätigter Zahlung freigeschaltet." }, { status: 403 });
      }
      taskId = order.sourceTaskId;
      type = order.sourceTaskType;
      ownershipEmail = order.email;
    } else if (requestedFormat === "stl" || requestedFormat === "3mf") {
      const account = await ensureAccount(user.email, user.fullName);
      if (!accountCapabilities(account).canDownload3d) {
        return Response.json({ error: "STL- und 3MF-Downloads sind im 3D-Studio- oder Complete-Abo enthalten." }, { status: 403 });
      }
    }

    if (!TASK_ID.test(taskId) || !type || !(type in TASK_ENDPOINTS)) {
      return Response.json({ error: "Ungültige Task-Abfrage." }, { status: 400 });
    }
    const ownedTask = await getOwnedTask(taskId, ownershipEmail);
    if (!ownedTask) return Response.json({ error: "Dieser Auftrag gehört nicht zu deinem Konto." }, { status: 403 });

    const result = await meshyFetch(`${TASK_ENDPOINTS[type]}/${taskId}`);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

    if (requestedFormat) {
      if (!["glb", "stl", "3mf"].includes(requestedFormat)) return Response.json({ error: "Ungültiges Dateiformat." }, { status: 400 });
      const assetUrl = result.data?.model_urls?.[requestedFormat];
      if (typeof assetUrl !== "string" || !assetUrl.startsWith("https://assets.meshy.ai/")) return Response.json({ error: "Diese Datei ist nicht verfügbar." }, { status: 404 });
      const asset = await fetch(assetUrl);
      if (!asset.ok || !asset.body) return Response.json({ error: "Die Modelldatei konnte nicht geladen werden." }, { status: 502 });
      return new Response(asset.body, {
        headers: {
          "Content-Type": asset.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": `${requestedFormat === "glb" ? "inline" : "attachment"}; filename="ab3d-${taskId.slice(0, 8)}.${requestedFormat}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const status = String(result.data.status || "PENDING");
    await updateTaskStatus(taskId, user.email, status);
    let tokenBalance = await getTokenBalance(user.email);
    if (status === "FAILED" || status === "CANCELED") {
      tokenBalance = await refundTokens(user.email, taskId, ownedTask.tokenCost, "Fehlgeschlagene KI-Generierung");
    }
    return Response.json({ ...result.data, tokenBalance }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message === "MESHY_API_KEY_NOT_CONFIGURED"
      ? "Die AB3D Design Engine ist noch nicht konfiguriert."
      : "Der Status der Design Engine konnte nicht geladen werden.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function validImage(imageData: string) {
  const hasValidMagicBytes =
    /^data:image\/png;base64,iVBORw0KGgo/i.test(imageData) ||
    /^data:image\/jpeg;base64,\/9j\//i.test(imageData);
  return hasValidMagicBytes && imageData.length <= MAX_IMAGE_DATA_LENGTH;
}

async function refundUnstartedCharge(email: string, amount: number, reason: string) {
  const { env } = await import("cloudflare:workers");
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE accounts SET token_balance = token_balance + ?, updated_at = ? WHERE email = ?").bind(amount, now, email),
    env.DB.prepare("INSERT INTO token_ledger (email, delta, reason, created_at) VALUES (?, ?, ?, ?)").bind(email, amount, reason, now),
  ]);
}
