import { getChatGPTUser } from "../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../db/account";
import { listProductionOperations } from "../../../../db/production-operations";
import { AB3D_PRIVATE_HEADERS as headers } from "../../../ab3d-operations";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden.", code: "unauthenticated" }, { status: 401, headers });
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Nur für AB3D freigegeben.", code: "forbidden" }, { status: 403, headers });
  try {
    const result = await listProductionOperations(new URL(request.url).searchParams);
    return result ? Response.json(result, { headers })
      : Response.json({ error: "Bitte prüfe Suchfilter und Seitenauswahl.", code: "invalid_request" }, { status: 400, headers });
  } catch {
    return Response.json({ error: "Die Auftragsübersicht ist vorübergehend nicht verfügbar.", code: "unavailable" }, { status: 503, headers });
  }
}
