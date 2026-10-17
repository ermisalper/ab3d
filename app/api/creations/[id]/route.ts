import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../db/account";
import { boundedBody } from "../../../cappatex-upload";
import { parseGalleryChoice } from "../../../gallery-policy";
import { entryForViewer, gallerySummary } from "../../../gallery-storage";

const headers={"Cache-Control":"private, no-store"};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const user=await getChatGPTUser(),{id}=await params;
  const entry=await entryForViewer(id,user?.email,Boolean(user&&isOwnerEmail(user.email)));
  if(!entry)return Response.json({error:"Dieses Werk ist nicht verfügbar."},{status:404,headers});
  const mine=entry.email===user?.email,review=Boolean(user&&isOwnerEmail(user.email)&&entry.visibility==="pending");
  const versions=mine?await env.DB.prepare("SELECT task_id,task_type,state,updated_at FROM gallery_task_links WHERE entry_id=? ORDER BY updated_at DESC LIMIT 100").bind(id).all<{task_id:string;task_type:string;state:string;updated_at:number}>():null;
  return Response.json({...gallerySummary(entry,mine||review),mine,canReview:review,
    versions:versions?.results.map(v=>({taskId:v.task_id,type:v.task_type,state:v.state,createdAt:v.updated_at,
      modelUrl:v.state==="ready"?`/api/creations/${id}/asset?view=model&taskId=${v.task_id}`:null}))||[]},{headers});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Unzulässige Anfrage."},{status:403,headers});
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Bitte melde dich an."},{status:401,headers});
  const {id}=await params,entry=await entryForViewer(id,user.email,isOwnerEmail(user.email));
  if(!entry)return Response.json({error:"Dieses Werk ist nicht verfügbar."},{status:404,headers});
  let body;try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)));}catch{return Response.json({error:"Ungültige Auswahl."},{status:400,headers});}
  if(!body||typeof body!=="object"||!Number.isInteger(body.revision))return Response.json({error:"Bitte lade das Werk neu."},{status:409,headers});
  let change;
  if(body.action==="withdraw"&&entry.email===user.email){
    // Withdrawal always wins over a concurrent moderation decision.
    change=env.DB.prepare("UPDATE gallery_entries SET visibility='withdrawn',public_requested=0,revision=revision+1,updated_at=? WHERE id=? AND email=?")
      .bind(Date.now(),id,user.email);
  }else if(body.action==="choice"&&entry.email===user.email){
    let choice;try{choice=parseGalleryChoice(body.choice,entry.studio);}catch{return Response.json({error:"Bitte wähle ausdrücklich privat oder öffentlich und bestätige gegebenenfalls deine Rechte."},{status:400,headers});}
    if(entry.state!=="ready")return Response.json({error:"Bitte schliesse zuerst die Speicherung des Ergebnisses ab."},{status:409,headers});
    change=env.DB.prepare(`UPDATE gallery_entries SET title=?,category=?,consent_version=?,consent_at=?,initial_choice_json=COALESCE(initial_choice_json,?),public_requested=?,rights_confirmed=?,
      visibility=?,revision=revision+1,updated_at=? WHERE id=? AND email=? AND revision=?`)
      .bind(choice.title,choice.category,choice.version,Date.now(),JSON.stringify({...choice,recordedAt:Date.now()}),choice.visibility==="public"?1:0,choice.rightsConfirmed?1:0,
        choice.visibility==="public"?"pending":"private",Date.now(),id,user.email,body.revision);
  }else if(["approve","reject"].includes(body.action)&&isOwnerEmail(user.email)){
    change=env.DB.prepare(`UPDATE gallery_entries SET visibility=?,revision=revision+1,updated_at=?
      WHERE id=? AND revision=? AND visibility='pending' AND state='ready' AND public_requested=1 AND rights_confirmed=1 AND consent_version IS NOT NULL`)
      .bind(body.action==="approve"?"published":"rejected",Date.now(),id,body.revision);
  }else return Response.json({error:"Diese Änderung ist nicht erlaubt."},{status:403,headers});
  const result=await change.run();if(!result.meta.changes)return Response.json({error:"Der Stand wurde inzwischen geändert. Bitte lade das Werk neu."},{status:409,headers});
  return Response.json({ok:true},{headers});
}
