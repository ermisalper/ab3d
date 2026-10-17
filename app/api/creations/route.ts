import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isOwnerEmail } from "../../../db/account";
import { GALLERY_CATEGORIES } from "../../gallery-policy";
import { gallerySummary, importLegacyCreations, type GalleryEntry } from "../../gallery-storage";

export async function GET(request:Request) {
  const headers={"Cache-Control":"private, no-store"};
  try {
    const url=new URL(request.url),scope=url.searchParams.get("scope")||"public",user=await getChatGPTUser();
    if(!["public","mine","review"].includes(scope))return Response.json({error:"Ungültige Galerie."},{status:400,headers});
    if(scope!=="public"&&!user)return Response.json({error:"Bitte melde dich an."},{status:401,headers});
    if(scope==="review"&&!isOwnerEmail(user!.email))return Response.json({error:"Keine Freigabeberechtigung."},{status:403,headers});
    if(scope==="mine")await importLegacyCreations(user!.email);
    const studio=url.searchParams.get("studio"),category=url.searchParams.get("category"),q=(url.searchParams.get("q")||"").trim().slice(0,80);
    if(studio&&!Object.hasOwn(GALLERY_CATEGORIES,studio))return Response.json({error:"Ungültiges Studio."},{status:400,headers});
    if(category&&(!studio||!Object.hasOwn(GALLERY_CATEGORIES[studio as "ab3d"|"cappatex"],category)))return Response.json({error:"Ungültige Kategorie."},{status:400,headers});
    const page=Number(url.searchParams.get("page")||1);if(!Number.isInteger(page)||page<1||page>1000)return Response.json({error:"Ungültige Seite."},{status:400,headers});
    const conditions=[scope==="mine"?"email=?":scope==="review"?"visibility='pending' AND state='ready'":"visibility='published' AND state='ready'"],args:unknown[]=scope==="mine"?[user!.email]:[];
    if(studio){conditions.push("studio=?");args.push(studio);}if(category){conditions.push("category=?");args.push(category);}
    if(q){conditions.push("title LIKE ? ESCAPE '\\'");args.push(`%${q.replace(/[\\%_]/g,"\\$&")}%`);}
    const rows=await env.DB.prepare(`SELECT * FROM gallery_entries WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?`)
      .bind(...args,(page-1)*24).all<GalleryEntry>();
    return Response.json({items:rows.results.slice(0,24).map(e=>gallerySummary(e,scope!=="public")),hasMore:rows.results.length>24,page,
      canReview:Boolean(user&&isOwnerEmail(user.email))},{headers});
  }catch{return Response.json({error:"Die Sammlung konnte nicht geladen werden. Bitte versuche es erneut."},{status:503,headers});}
}
