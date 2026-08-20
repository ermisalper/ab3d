import { getChatGPTUser } from "../../chatgpt-auth";
import { buildDesignPlan } from "../../design-planner";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

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

async function safetyIdentifier(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function extractOutputText(data: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  return data.output?.flatMap((item) => item.content || []).find((content) => content.type === "output_text")?.text?.trim();
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Unzulässige Anfrage." }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 12_000) {
      return Response.json({ error: "Der Produktwunsch ist zu umfangreich." }, { status: 413 });
    }

    const body = await request.json() as {
      templateId?: string;
      idea?: string;
      answers?: Record<string, string>;
    };
    const templateId = String(body.templateId || "").slice(0, 40);
    const idea = String(body.idea || "").trim().slice(0, 240);
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    if (!templateId || idea.length < 6) {
      return Response.json({ error: "Beschreibe deine Produktidee bitte in mindestens sechs Zeichen." }, { status: 400 });
    }

    const plan = buildDesignPlan(templateId, idea, answers);
    const user = await getChatGPTUser();
    const apiKey = process.env.OPENAI_API_KEY;

    // The construction rules remain deterministic. AI may improve only the visual
    // interpretation after every required functional answer is present.
    if (!plan.complete || !user || !apiKey) {
      return Response.json({ plan, mode: "product-rules" }, { headers: { "Cache-Control": "no-store" } });
    }

    const identifier = await safetyIdentifier(user.email);
    const now = Date.now();
    const window = requestWindows.get(identifier);
    if (window && window.resetAt > now && window.count >= RATE_LIMIT) {
      return Response.json({ plan, mode: "product-rules" }, { headers: { "Cache-Control": "no-store" } });
    }
    requestWindows.set(identifier, window && window.resetAt > now
      ? { ...window, count: window.count + 1 }
      : { count: 1, resetAt: now + RATE_WINDOW_MS });

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_DESIGN_AGENT_MODEL || "gpt-5.6-luna",
        instructions: `Du bist der AB3D Produktplaner für additive Fertigung. Formuliere aus dem Kundenwunsch und dem bereits validierten technischen Plan eine präzise deutsche Zusammenfassung und eine kurze englische visuelle Designabsicht. Du darfst keine technischen Anforderungen entfernen, keine Normerfüllung, elektrische Sicherheit oder Druckbarkeit garantieren und keine Elektronik als druckbares Kunststoffteil beschreiben. Keine Marken erwähnen.`,
        input: JSON.stringify({ customerIdea: plan.customerIdea, answers: plan.answers, manufacturing: plan.manufacturing, specifications: plan.specifications }),
        reasoning: { effort: "low" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "ab3d_design_intent",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string", maxLength: 420 },
                visual_intent: { type: "string", maxLength: 500 },
              },
              required: ["summary", "visual_intent"],
            },
          },
        },
        max_output_tokens: 420,
        safety_identifier: identifier,
      }),
    });

    if (!response.ok) return Response.json({ plan, mode: "product-rules" }, { headers: { "Cache-Control": "no-store" } });
    const output = extractOutputText(await response.json());
    if (!output) return Response.json({ plan, mode: "product-rules" }, { headers: { "Cache-Control": "no-store" } });
    const enhanced = JSON.parse(output) as { summary?: string; visual_intent?: string };
    const summary = String(enhanced.summary || "").trim().slice(0, 420);
    const visualIntent = String(enhanced.visual_intent || "").trim().slice(0, 500);
    return Response.json({
      plan: {
        ...plan,
        summary: summary || plan.summary,
        technicalBrief: visualIntent ? `${plan.technicalBrief} Personalized visual intent: ${visualIntent}` : plan.technicalBrief,
      },
      mode: "ai",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Der Produktplaner konnte die Idee nicht verarbeiten. Bitte versuche es erneut." }, { status: 500 });
  }
}
