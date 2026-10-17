import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../../db/account";
import { entryForViewer } from "../../../../gallery-storage";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params,user=await getChatGPTUser(),url=new URL(request.url);
  const entry=await entryForViewer(id,user?.email,Boolean(user&&isOwnerEmail(user.email)));
  const missing=()=>new Response("Nicht verfügbar.",{status:404,headers:{"Cache-Control":"no-store"}});
  if(!entry)return missing();
  const view=url.searchParams.get("view"),taskId=url.searchParams.get("taskId");
  let key=view==="thumbnail"?entry.thumbnail_key:view==="model"&&entry.studio==="ab3d"?entry.asset_key:null;
  if(taskId){
    if(entry.email!==user?.email||view!=="model"||!/^[a-zA-Z0-9-]{8,80}$/.test(taskId))return missing();
    const version=await env.DB.prepare("SELECT asset_key FROM gallery_task_links WHERE entry_id=? AND task_id=? AND state='ready'").bind(id,taskId).first<{asset_key:string}>();
    key=version?.asset_key||null;
  }
  if(!key)return missing();
  const object=await env.BUCKET.get(key,{range:request.headers});if(!object)return missing();
  const headers=new Headers({"Content-Type":view==="model"?"model/gltf-binary":entry.thumbnail_type||"image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes"});
  let status=200;
  if(object.range&&"offset" in object.range&&"length" in object.range){
    const {offset,length}=object.range;
    if(typeof offset==="number"&&typeof length==="number"){headers.set("Content-Range",`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set("Content-Length",String(length));status=206;}
  }else if(typeof object.size==="number")headers.set("Content-Length",String(object.size));
  return new Response(object.body||await object.arrayBuffer(),{status,headers});
}
