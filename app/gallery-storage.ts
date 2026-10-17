import { env } from "cloudflare:workers";
import { parseGalleryChoice, type GalleryChoice, type GalleryStudio } from "./gallery-policy";
import { storeGalleryGlb, storeGalleryThumbnail } from "./gallery-media";

export type GalleryEntry = {
  id:string;email:string;studio:GalleryStudio;source_id:string|null;source_type:string|null;title:string;category:string;
  consent_version:string|null;consent_at:number|null;public_requested:number;rights_confirmed:number;visibility:string;state:string;
  result_task_id:string|null;thumbnail_key:string|null;thumbnail_type:string|null;asset_key:string|null;asset_bytes:number|null;
  revision:number;created_at:number;updated_at:number;
};
export const GALLERY_ID=/^(?:GL[MD]-[A-Za-z0-9-]{8,90}|legacy-(?:ab3d|cappatex)-[A-Za-z0-9-]{8,90})$/;

export async function reserveCreation(email:string,studio:GalleryStudio,choice:GalleryChoice,sourceId?:string,explicit=true) {
  const id=`${studio==="ab3d"?"GLM":"GLD"}-${crypto.randomUUID().replaceAll("-","")}`,now=Date.now();
  const statement=env.DB.prepare(`INSERT INTO gallery_entries
    (id,email,studio,source_id,title,category,consent_version,consent_at,initial_choice_json,public_requested,rights_confirmed,visibility,state,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,'private','creating',?,? ${studio==="cappatex"&&sourceId?"WHERE EXISTS(SELECT 1 FROM cappatex_designs WHERE id=? AND email=? AND status IN ('generating','uploading'))":""}`)
    .bind(id,email,studio,sourceId||null,choice.title,choice.category,explicit?choice.version:null,explicit?now:null,explicit?JSON.stringify({...choice,recordedAt:now}):null,choice.visibility==="public"?1:0,choice.rightsConfirmed?1:0,now,now,
      ...(studio==="cappatex"&&sourceId?[sourceId,email]:[]));
  return {id,statement};
}
export async function failCreation(id:string,email:string) {
  await env.DB.prepare("UPDATE gallery_entries SET state = 'failed',updated_at = ? WHERE id = ? AND email = ? AND state = 'creating'").bind(Date.now(),id,email).run();
}
export async function readyArtworkCreation(id:string,email:string,previewKey:string) {
  await env.DB.prepare(`UPDATE gallery_entries SET thumbnail_key = ?,thumbnail_type = 'image/png',state = 'ready',
    visibility = CASE WHEN public_requested = 1 AND rights_confirmed = 1 THEN 'pending' ELSE 'private' END,
    revision = revision + 1,updated_at = ? WHERE id = ? AND email = ? AND state = 'creating'`)
    .bind(previewKey,Date.now(),id,email).run();
}

export async function meshCreationIntent(email:string,parentTaskId:string|undefined,choice:unknown) {
  if(parentTaskId){
    const link=await env.DB.prepare(`SELECT l.entry_id FROM gallery_task_links l JOIN gallery_entries e ON e.id=l.entry_id WHERE l.task_id=? AND e.email=?`)
      .bind(parentTaskId,email).first<{entry_id:string}>();
    if(link)return link.entry_id;
    // Existing private tasks do not acquire public permission through a new child.
    await importLegacyCreations(email);
    const old=await env.DB.prepare("SELECT entry_id FROM gallery_task_links WHERE task_id=?").bind(parentTaskId).first<{entry_id:string}>();
    if(old)return old.entry_id;
    const inherited=await reserveCreation(email,"ab3d",{version:"",visibility:"private",category:"sonstiges",title:"Gespeichertes 3D-Modell",rightsConfirmed:false},undefined,false);
    await inherited.statement.run();return inherited.id;
  }
  const selected=parseGalleryChoice(choice,"ab3d");
  const created=await reserveCreation(email,"ab3d",selected);await created.statement.run();return created.id;
}
export async function linkMeshTask(entryId:string|null,email:string,taskId:string,taskType:string,role:string) {
  if(!entryId)return;
  const now=Date.now();
  const statements=[env.DB.prepare("INSERT INTO gallery_task_links (task_id,entry_id,task_type,role,state,updated_at) VALUES (?,?,?,?,'pending',?)").bind(taskId,entryId,taskType,role,now)];
  if(role==="result"||role==="preview")statements.push(env.DB.prepare("UPDATE gallery_entries SET source_id = COALESCE(source_id,?),source_type = ?,result_task_id = ?,state='creating',updated_at = ? WHERE id = ? AND email = ? AND state IN ('creating','preview_ready','archive_error')").bind(taskId,taskType,taskId,now,entryId,email));
  await env.DB.batch(statements);
}

/** Idempotent, bounded, private-only indexing. Old permissions are never inferred. */
export async function importLegacyCreations(email:string) {
  const now=Date.now();
  await env.DB.prepare(`UPDATE gallery_entries SET state='ready',thumbnail_type='image/png',
    thumbnail_key=(SELECT d.preview_key FROM cappatex_designs d WHERE d.id=gallery_entries.source_id AND d.email=gallery_entries.email),
    visibility=CASE WHEN public_requested=1 AND rights_confirmed=1 THEN 'pending' ELSE 'private' END,revision=revision+1,updated_at=?
    WHERE email=? AND studio='cappatex' AND state='creating' AND EXISTS(SELECT 1 FROM cappatex_designs d WHERE d.id=gallery_entries.source_id AND d.email=gallery_entries.email AND d.status='preview_ready' AND d.preview_key IS NOT NULL)`)
    .bind(now,email).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO gallery_entries
    (id,email,studio,source_id,source_type,title,category,visibility,state,thumbnail_key,thumbnail_type,created_at,updated_at)
    SELECT 'legacy-cappatex-'||d.id,d.email,'cappatex',d.id,'artwork','Gespeichertes Motiv','sonstiges','private','ready',d.preview_key,'image/png',d.created_at,?
    FROM cappatex_designs d WHERE d.email=? AND d.status='preview_ready' AND d.preview_key IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM gallery_entries e WHERE e.studio='cappatex' AND e.source_id=d.id) ORDER BY d.created_at DESC LIMIT 100`).bind(now,email).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO gallery_entries
    (id,email,studio,source_id,source_type,title,category,visibility,state,result_task_id,created_at,updated_at)
    SELECT 'legacy-ab3d-'||t.task_id,t.email,'ab3d',t.task_id,
    CASE WHEN t.kind IN ('text-preview','text-refine') THEN 'text' ELSE t.kind END,
    'Gespeichertes 3D-Modell','sonstiges','private','unarchived',t.task_id,t.created_at,?
    FROM generation_tasks t WHERE t.email=? AND t.kind NOT IN ('image-transform','print-analyze')
    AND t.kind NOT LIKE '%-prototype' AND NOT EXISTS(SELECT 1 FROM gallery_task_links l WHERE l.task_id=t.task_id)
    AND NOT EXISTS(SELECT 1 FROM gallery_entries e WHERE e.studio='ab3d' AND e.source_id=t.task_id)
    ORDER BY t.created_at DESC LIMIT 100`).bind(now,email).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO gallery_task_links(task_id,entry_id,task_type,role,state,updated_at)
    SELECT source_id,id,source_type,'result','pending',? FROM gallery_entries WHERE email=? AND studio='ab3d' AND id LIKE 'legacy-ab3d-%'`).bind(now,email).run();
}

/** A successful poll archives files; it never creates another paid provider task. */
export async function archiveMeshTask(email:string,taskId:string,data:Record<string,unknown>) {
  const link=await env.DB.prepare(`SELECT l.*,e.email FROM gallery_task_links l JOIN gallery_entries e ON e.id=l.entry_id WHERE l.task_id=? AND e.email=?`)
    .bind(taskId,email).first<{entry_id:string;role:string;state:string;task_type:string;asset_key:string|null}>();
  if(!link)return null;
  if(data.status==="FAILED"||data.status==="CANCELED"){
    await env.DB.batch([
      env.DB.prepare("UPDATE gallery_task_links SET state='error',updated_at=? WHERE task_id=? AND state!='ready'").bind(Date.now(),taskId),
      env.DB.prepare("UPDATE gallery_entries SET state='failed',updated_at=? WHERE id=? AND email=? AND state IN ('creating','unarchived','archive_error') AND (result_task_id=? OR result_task_id IS NULL)").bind(Date.now(),link.entry_id,email,taskId),
    ]);
    return link.entry_id;
  }
  if(data.status!=="SUCCEEDED")return link.entry_id;
  const urls=data.model_urls as {glb?:string}|undefined;
  if(!urls?.glb)return link.entry_id;
  if(link.state==="ready")return link.entry_id;
  const now=Date.now();
  const claim=await env.DB.prepare("UPDATE gallery_task_links SET state='saving',updated_at=? WHERE task_id=? AND (state IN ('pending','error') OR (state='saving' AND updated_at < ?))")
    .bind(now,taskId,now-300_000).run();
  if(!claim.meta.changes)return link.entry_id;
  try {
    const key=`gallery/models/${taskId}/model.glb`,thumbKey=`gallery/models/${taskId}/thumbnail`;
    const length=await storeGalleryGlb(urls.glb,key);
    const type=await storeGalleryThumbnail(data.thumbnail_url,thumbKey);
    await env.DB.batch([
      env.DB.prepare("UPDATE gallery_task_links SET state='ready',asset_key=?,asset_bytes=?,thumbnail_key=?,thumbnail_type=?,updated_at=? WHERE task_id=? AND state='saving'")
        .bind(key,length,thumbKey,type,Date.now(),taskId),
      env.DB.prepare(`UPDATE gallery_entries SET state=?,asset_key=?,asset_bytes=?,thumbnail_key=?,thumbnail_type=?,
        visibility=CASE WHEN ?='result' AND public_requested=1 AND rights_confirmed=1 THEN 'pending' ELSE 'private' END,revision=revision+1,updated_at=?
        WHERE id=? AND email=? AND result_task_id=? AND state IN ('creating','unarchived','archive_error')`)
        .bind(link.role==="preview"?"preview_ready":"ready",key,length,thumbKey,type,link.role,Date.now(),link.entry_id,email,taskId),
    ]);
  }catch {
    await env.DB.prepare("UPDATE gallery_task_links SET state='error',updated_at=? WHERE task_id=? AND state='saving'").bind(Date.now(),taskId).run().catch(()=>{});
    await env.DB.prepare("UPDATE gallery_entries SET state='archive_error',updated_at=? WHERE id=? AND email=? AND result_task_id=? AND state!='ready'")
      .bind(Date.now(),link.entry_id,email,taskId).run().catch(()=>{});
  }
  return link.entry_id;
}

export async function entryForViewer(id:string,email?:string|null,owner=false) {
  if(!GALLERY_ID.test(id))return null;
  const e=await env.DB.prepare("SELECT * FROM gallery_entries WHERE id=?").bind(id).first<GalleryEntry>();
  if(!e)return null;
  if(e.email===email||(owner&&e.visibility==="pending")||(e.visibility==="published"&&e.state==="ready"))return e;
  return null;
}
export function gallerySummary(e:GalleryEntry,privateView=false) {
  return {id:e.id,studio:e.studio,title:e.title,category:e.category,createdAt:e.created_at,
    thumbnailUrl:e.thumbnail_key?`/api/creations/${e.id}/asset?view=thumbnail`:null,
    modelUrl:e.asset_key&&e.studio==="ab3d"?`/api/creations/${e.id}/asset?view=model`:null,
    ...(privateView?{visibility:e.visibility,state:e.state,revision:e.revision,sourceId:e.source_id,sourceType:e.source_type,
      resultTaskId:e.result_task_id,canRequestPublic:Boolean(e.consent_version&&e.public_requested&&e.rights_confirmed)}:{}),
  };
}
export type GallerySummary=ReturnType<typeof gallerySummary>;
