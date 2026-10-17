import assert from "node:assert/strict";
import { after,afterEach,beforeEach,test } from "node:test";
import { existsSync,readFileSync,readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { encode } from "fast-png";

const user="creator@example.test",operator="operator@example.test",other="other@example.test",origin="https://ab3d.example.test";
const runtime={env:{},actor:user};globalThis.__galleryOffline=runtime;
const hooks=registerHooks({resolve(s,c,n){
  if(["cloudflare:workers","next/headers","next/navigation"].includes(s))return {url:`gallery-fixture:${s}`,shortCircuit:true};
  if(s.startsWith(".")&&c.parentURL?.startsWith("file:")){const u=new URL(s+".ts",c.parentURL);if(existsSync(u))return n(u.href,c);}return n(s,c);
},load(u,c,n){const src={
  "gallery-fixture:cloudflare:workers":"export const env=globalThis.__galleryOffline.env;",
  "gallery-fixture:next/headers":"export async function headers(){return new Headers(globalThis.__galleryOffline.actor?{'oai-authenticated-user-email':globalThis.__galleryOffline.actor}:{});}",
  "gallery-fixture:next/navigation":"export function redirect(){throw new Error('Unexpected redirect');}",
}[u];return src?{format:"module",source:src,shortCircuit:true}:n(u,c);}});
const {GET:list}=await import("../app/api/creations/route.ts");
const {GET:detail,POST:edit}=await import("../app/api/creations/[id]/route.ts");
const {GET:asset}=await import("../app/api/creations/[id]/asset/route.ts");
const {POST:meshPost,GET:meshGet}=await import("../app/api/meshy/route.ts");
const {POST:upload}=await import("../app/api/cappatex/upload/route.ts");
const {POST:generate}=await import("../app/api/cappatex/route.ts");
const {parseGalleryChoice}=await import("../app/gallery-policy.ts");
const {meshAssetUrl}=await import("../app/gallery-media.ts");

class D1 {
  constructor(){this.db=new DatabaseSync(":memory:");this.db.exec("PRAGMA foreign_keys=ON");
    for(const name of readdirSync(new URL("../drizzle/",import.meta.url)).filter(n=>n.endsWith(".sql")).sort())this.db.exec(readFileSync(new URL(`../drizzle/${name}`,import.meta.url),"utf8"));}
  prepare(query){const db=this.db;const statement=(args=[])=>({bind:(...a)=>statement(a),first:async()=>{const row=db.prepare(query).get(...args);return row?{...row}:null;},
    all:async()=>({success:true,results:db.prepare(query).all(...args).map(r=>({...r}))}),
    runSync(){const r=db.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},async run(){return this.runSync();}});return statement();}
  async batch(statements){this.db.exec("BEGIN");try{const rs=statements.map(s=>s.runSync());this.db.exec("COMMIT");return rs;}catch(e){this.db.exec("ROLLBACK");throw e;}}
}
class R2 {
  files=new Map();puts=0;
  async put(key,source,options){const bytes=source instanceof ReadableStream?new Uint8Array(await new Response(source).arrayBuffer()):new Uint8Array(source);this.files.set(key,{bytes,type:options.httpMetadata.contentType});this.puts++;}
  async get(key,options){const f=this.files.get(key);if(!f)return null;let bytes=f.bytes,range;
    const requested=options?.range?.get("range");if(requested){const m=/^bytes=(\d+)-(\d+)$/.exec(requested);if(m){const offset=Number(m[1]),end=Math.min(bytes.length-1,Number(m[2]));range={offset,length:end-offset+1};bytes=bytes.slice(offset,end+1);}}
    return {size:f.bytes.length,range,arrayBuffer:async()=>bytes.slice().buffer,body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
  }
}
function glb(json={asset:{version:"2.0"},scenes:[{nodes:[]}],scene:0}){
  const text=JSON.stringify(json),padded=text+" ".repeat((4-text.length%4)%4),body=new TextEncoder().encode(padded),bytes=new Uint8Array(20+body.length),v=new DataView(bytes.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.length,true);v.setUint32(12,body.length,true);v.setUint32(16,0x4e4f534a,true);bytes.set(body,20);return bytes;
}
const png=encode({width:32,height:32,channels:4,depth:8,data:new Uint8Array(32*32*4).fill(255)});
const image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const originalFetch=globalThis.fetch,previousEnv={...process.env};let database,bucket,requests,tasks,modelBytes,thumbBytes,oversize,expired;
beforeEach(()=>{
  database=new D1();bucket=new R2();Object.assign(runtime.env,{DB:database,BUCKET:bucket});runtime.actor=user;requests=[];tasks=new Map();modelBytes=glb();thumbBytes=png;oversize=false;expired=false;
  Object.assign(process.env,{MESHY_API_KEY:"offline-placeholder",AB3D_OWNER_EMAILS:operator,AB3D_UNLIMITED_EMAILS:"",CAPPATEX_UPLOAD_ENABLED:"true",CAPPATEX_GENERATION_ENABLED:"true",CAPPATEX_GENERATION_AUDIENCE:"owner",CAPPATEX_GENERATION_ALLOWED_EMAILS:user,OPENAI_API_KEY:"offline-placeholder"});
  for(const email of [user,operator,other])database.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,40,'complete','active',0,0)").run(email);
  globalThis.fetch=async(url,init={})=>{
    const u=new URL(url),method=init.method||"GET";requests.push({url:u.href,method,body:init.body?JSON.parse(init.body):null});
    if(u.origin==="https://api.meshy.ai"){
      if(method==="POST"){const id=`task-fixture-${tasks.size+10000000}`;tasks.set(id,{id,status:"SUCCEEDED",progress:100,model_urls:{glb:"https://assets.meshy.ai/fixture/model.glb"},thumbnail_url:"https://assets.meshy.ai/fixture/preview.png"});return Response.json({result:id});}
      if(expired)return Response.json({message:"Fixture expired asset"},{status:404});
      const task=tasks.get(u.pathname.split("/").at(-1));if(task)return Response.json(task);
      return Response.json({balance:400});
    }
    if(u.origin==="https://assets.meshy.ai"){
      assert.equal(init.headers?.Authorization,undefined,"Private API keys must never be sent to asset hosts");
      const bytes=u.pathname.endsWith(".glb")?modelBytes:thumbBytes;
      return new Response(bytes,{headers:{"content-length":String(oversize?400_000_001:bytes.length)}});
    }
    throw new Error(`Live network prohibited in gallery test: ${u.origin}`);
  };
});
afterEach(()=>{database.db.close();globalThis.fetch=originalFetch;for(const k of ["MESHY_API_KEY","AB3D_OWNER_EMAILS","AB3D_UNLIMITED_EMAILS","CAPPATEX_UPLOAD_ENABLED","CAPPATEX_GENERATION_ENABLED","CAPPATEX_GENERATION_AUDIENCE","CAPPATEX_GENERATION_ALLOWED_EMAILS","OPENAI_API_KEY"]){if(previousEnv[k]===undefined)delete process.env[k];else process.env[k]=previousEnv[k];}});
after(()=>{hooks.deregister();delete globalThis.__galleryOffline;});
const choice=(visibility="private",studio="ab3d")=>({version:"gallery-2026-10-17-v1",visibility,category:studio==="ab3d"?"figuren":"natur",title:"Local fixture — do not publish",rightsConfirmed:visibility==="public"});
const context=id=>({params:Promise.resolve({id})});
const own=()=>database.db.prepare("SELECT token_balance FROM accounts WHERE email=?").get(user).token_balance;
const entry=id=>({...database.db.prepare("SELECT * FROM gallery_entries WHERE id=?").get(id)});
const providerPosts=()=>requests.filter(r=>r.method==="POST");
const postMesh=body=>meshPost(new Request(`${origin}/api/meshy`,{method:"POST",headers:{origin,host:"ab3d.example.test","Content-Type":"application/json"},body:JSON.stringify(body)}));
const listItems=async(q="")=>list(new Request(`${origin}/api/creations?${q}`));
const getDetail=async id=>detail(new Request(`${origin}/api/creations/${id}`),context(id));
const getAsset=async(id,view="thumbnail",headers={})=>asset(new Request(`${origin}/api/creations/${id}/asset?view=${view}`,{headers}),context(id));
const change=async(id,action,extra={})=>edit(new Request(`${origin}/api/creations/${id}`,{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({action,revision:entry(id).revision,...extra})}),context(id));
async function createModel(visibility="private",extra={}){
  const r=await postMesh({action:"create",type:"image",quality:"fast",imageDatas:[image],galleryChoice:choice(visibility),...extra});assert.equal(r.status,200);
  const task=await r.json();const e=database.db.prepare("SELECT entry_id FROM gallery_task_links WHERE task_id=?").get(task.taskId);return {taskId:task.taskId,id:e.entry_id};
}
const finish=async(taskId,type="image")=>meshGet(new Request(`${origin}/api/meshy?taskId=${taskId}&type=${type}`));
async function createArtwork(visibility="private"){
  const r=await upload(new Request(`${origin}/api/cappatex/upload`,{method:"POST",headers:{origin,"Content-Type":"image/png","X-Cappatex-Image-Rights":"confirmed","X-Gallery-Choice":encodeURIComponent(JSON.stringify(choice(visibility,"cappatex")))},body:png}));
  assert.equal(r.status,200);return r.json();
}

test("all new paid entry points reject missing, ambiguous and invalid gallery choice before charging",async()=>{
  for(const galleryChoice of [undefined,{}, {...choice(),visibility:""},{...choice("public"),rightsConfirmed:false},{...choice(),version:"old"}]){
    for(const action of ["create","transform-image","creative-prototype"]){
      const r=await postMesh({action,type:"image",quality:"fast",imageDatas:[image],imageData:image,prompt:"A clearly visible fixture toy animal",templateId:"chibi",galleryChoice});assert.equal(r.status,409);
    }
    const r=await generate(new Request(`${origin}/api/cappatex`,{method:"POST",headers:{origin,host:"ab3d.example.test","Content-Type":"application/json"},body:JSON.stringify({prompt:"A clearly visible fixture flower",style:"Minimal",canvas:"square",confirmGeneration:true,galleryChoice})}));assert.equal(r.status,409);
  }
  assert.equal(providerPosts().length,0);assert.equal(own(),40);
  assert.equal(database.db.prepare("SELECT COUNT(*) n FROM gallery_entries").get().n,0);
});
test("gallery persistence must be ready before a paid provider request",async()=>{
  database.db.exec("DROP TABLE gallery_task_links;DROP TABLE gallery_entries");
  const r=await postMesh({action:"create",type:"image",imageDatas:[image],galleryChoice:choice()});assert.equal(r.status,503);
  assert.equal(providerPosts().length,0);assert.equal(own(),40);
});
test("public request stays private until archive completion and operator approval",async()=>{
  const m=await createModel("public");assert.equal(entry(m.id).visibility,"private");assert.equal(entry(m.id).consent_version,"gallery-2026-10-17-v1");assert.equal(entry(m.id).rights_confirmed,1);
  assert.equal((await finish(m.taskId)).status,200);assert.equal(entry(m.id).state,"ready");assert.equal(entry(m.id).visibility,"pending");
  runtime.actor=null;assert.deepEqual((await(await listItems("studio=ab3d")).json()).items,[]);assert.equal((await getDetail(m.id)).status,404);assert.equal((await getAsset(m.id,"model")).status,404);
  runtime.actor=operator;const queue=await(await listItems("scope=review")).json();assert.equal(queue.items.length,1);assert.equal(queue.items[0].email,undefined);
  assert.equal((await change(m.id,"approve")).status,200);runtime.actor=null;
  const publicItems=await(await listItems("studio=ab3d&category=figuren")).json();assert.equal(publicItems.items.length,1);
  assert.doesNotMatch(JSON.stringify(publicItems),/creator@example|asset_key|consent_version|sourceId|prompt/);
  const d=await(await getDetail(m.id)).json();assert.equal(d.mine,false);assert.deepEqual(d.versions,[]);
  const a=await getAsset(m.id,"model");assert.equal(a.status,200);assert.deepEqual(new Uint8Array(await a.arrayBuffer()),modelBytes);
  const partial=await getAsset(m.id,"model",{Range:"bytes=0-11"});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,12);assert.match(partial.headers.get("content-range"),/^bytes 0-11\//);
  assert.equal((await getAsset(m.id,"original")).status,404);assert.equal(providerPosts().length,1);
});
test("private files remain private, including operator access; archived GLB survives provider expiry",async()=>{
  const m=await createModel();await finish(m.taskId);assert.equal(entry(m.id).visibility,"private");
  for(const actor of [null,other,operator]){runtime.actor=actor;assert.equal((await getDetail(m.id)).status,404);assert.equal((await getAsset(m.id,"model")).status,404);}
  runtime.actor=user;expired=true;requests.length=0;
  const response=await meshGet(new Request(`${origin}/api/meshy?taskId=${m.taskId}&type=image&format=glb`));assert.equal(response.status,200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),modelBytes);assert.equal(requests.length,0);
});
test("withdrawing a published entry immediately closes listing and file access",async()=>{
  const m=await createModel("public");await finish(m.taskId);runtime.actor=operator;await change(m.id,"approve");runtime.actor=user;
  assert.equal((await change(m.id,"withdraw")).status,200);assert.equal(entry(m.id).public_requested,0);
  runtime.actor=null;assert.deepEqual((await(await listItems()).json()).items,[]);const hidden=await getAsset(m.id,"model");assert.equal(hidden.status,404);assert.equal(hidden.headers.get("cache-control"),"no-store");
});
test("withdrawal wins even when moderation just increased the revision",async()=>{
  const m=await createModel("public");await finish(m.taskId);const revision=entry(m.id).revision;
  runtime.actor=operator;assert.equal((await change(m.id,"approve",{revision})).status,200);
  runtime.actor=user;assert.equal((await change(m.id,"withdraw",{revision})).status,200);
  assert.equal(entry(m.id).visibility,"withdrawn");runtime.actor=operator;assert.equal((await change(m.id,"approve",{revision})).status,404);
});
test("only the creator can request publication and only an operator can approve it",async()=>{
  const m=await createModel();await finish(m.taskId);
  const original=entry(m.id).initial_choice_json;assert.equal(JSON.parse(original).visibility,"private");
  assert.equal((await change(m.id,"approve")).status,403);
  assert.equal((await change(m.id,"choice",{choice:choice("public")})).status,200);assert.equal(entry(m.id).visibility,"pending");
  assert.equal(entry(m.id).initial_choice_json,original);
  runtime.actor=other;assert.equal((await change(m.id,"approve")).status,404);assert.equal((await listItems("scope=review")).status,403);
  runtime.actor=operator;assert.equal((await change(m.id,"reject")).status,200);assert.equal(entry(m.id).visibility,"rejected");
});
test("CAPPATEX publishes only the small preview and never its original print file",async()=>{
  const a=await createArtwork("public");assert.equal(entry(a.creationId).visibility,"pending");
  runtime.actor=operator;await change(a.creationId,"approve");runtime.actor=null;
  const response=await getAsset(a.creationId);assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/png");
  const bytes=new Uint8Array(await response.arrayBuffer()),v=new DataView(bytes.buffer);assert.equal(v.getUint32(16),8);assert.equal(v.getUint32(20),8);
  assert.equal((await getAsset(a.creationId,"model")).status,404);assert.equal((await getAsset(a.creationId,"original")).status,404);
  assert.equal(providerPosts().length,0);
});
test("historical artwork is imported privately and without inferred consent",async()=>{
  const a=await createArtwork();database.db.prepare("DELETE FROM gallery_entries WHERE id=?").run(a.creationId);
  const r=await(await listItems("scope=mine")).json();assert.equal(r.items.length,1);assert.equal(r.items[0].visibility,"private");
  const old=entry(r.items[0].id);assert.equal(old.consent_version,null);assert.equal(old.public_requested,0);
  await listItems("scope=mine");assert.equal(database.db.prepare("SELECT COUNT(*) n FROM gallery_entries").get().n,1);
});
test("historical Meshy task records are not falsely reported as archived files",async()=>{
  database.db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES ('historical-model-123',?,'image',1,'SUCCEEDED',0,0,0)").run(user);
  const r=await(await listItems("scope=mine")).json();assert.equal(r.items.length,1);assert.equal(r.items[0].state,"unarchived");assert.equal(r.items[0].modelUrl,null);assert.equal(r.items[0].visibility,"private");
  expired=true;assert.equal((await finish("historical-model-123")).status,404);assert.equal(bucket.files.size,0);
});
for(const failure of ["external-uri","svg-data-uri","invalid-glb","oversize","html-thumbnail"])test(`unsafe or incomplete ${failure} never becomes a public gallery item`,async()=>{
  const m=await createModel("public");
  if(failure==="external-uri")modelBytes=glb({asset:{version:"2.0"},buffers:[{uri:"https://untrusted.example/pixel",byteLength:4}]});
  if(failure==="svg-data-uri")modelBytes=glb({asset:{version:"2.0"},images:[{uri:"data:image/svg+xml;base64,PHN2Zy8+"}]});
  if(failure==="invalid-glb")modelBytes=Uint8Array.from({length:30},()=>1);
  if(failure==="oversize")oversize=true;
  if(failure==="html-thumbnail")thumbBytes=new TextEncoder().encode("<svg onload='bad()'/>");
  await finish(m.taskId);assert.equal(entry(m.id).state,"archive_error");assert.equal(entry(m.id).asset_key,null);assert.equal(entry(m.id).visibility,"private");
  runtime.actor=operator;assert.equal((await change(m.id,"approve")).status,404);assert.equal(providerPosts().length,1);
});
test("archive retry and repeated polls create no new paid tasks and preserve an archived file",async()=>{
  const m=await createModel("public");thumbBytes=new TextEncoder().encode("bad");await finish(m.taskId);assert.equal(entry(m.id).state,"archive_error");
  thumbBytes=png;await finish(m.taskId);assert.equal(entry(m.id).state,"ready");const count=bucket.puts;
  await Promise.all([finish(m.taskId),finish(m.taskId)]);assert.equal(bucket.puts,count);assert.equal(providerPosts().length,1);
});
test("child stages inherit consent and keep a single collection project",async()=>{
  const first=await createModel("private");await finish(first.taskId);
  database.db.prepare("UPDATE generation_tasks SET kind='text-preview' WHERE task_id=?").run(first.taskId);
  const refined=await postMesh({action:"refine",previewTaskId:first.taskId,galleryChoice:choice("public")});assert.equal(refined.status,200);
  const child=await refined.json();await finish(child.taskId,"text");
  assert.equal(database.db.prepare("SELECT COUNT(*) n FROM gallery_entries").get().n,1);
  assert.equal(entry(first.id).public_requested,0);assert.equal(entry(first.id).visibility,"private");
  const d=await(await getDetail(first.id)).json();assert.equal(d.versions.length,2);assert.ok(d.versions.every(v=>v.modelUrl));
});
test("text geometry remains private until the planned final texture stage is archived",async()=>{
  const {buildDesignPlan}=await import("../app/design-planner.ts");const answers={};let p=buildDesignPlan("planter","A wide planter for a small plant",answers);
  for(let i=0;i<4&&!p.complete;i++){for(const q of p.questions)answers[q.id] ||= q.options[0].value;p=buildDesignPlan("planter",p.customerIdea,answers);}
  assert.equal(p.complete,true);
  const r=await postMesh({action:"create",type:"text",quality:"quality",willRefine:true,galleryChoice:choice("public"),designPlan:{templateId:p.templateId,idea:p.customerIdea,answers,planVersion:p.planVersion}});
  assert.equal(r.status,200);const root=await r.json();await finish(root.taskId,"text");
  const e=database.db.prepare("SELECT * FROM gallery_entries").get();assert.equal(e.state,"preview_ready");assert.equal(e.visibility,"private");
  const r2=await postMesh({action:"refine",previewTaskId:root.taskId});assert.equal(r2.status,200);const final=await r2.json();await finish(final.taskId,"text");
  assert.equal(entry(e.id).state,"ready");assert.equal(entry(e.id).visibility,"pending");assert.equal(entry(e.id).result_task_id,final.taskId);
  assert.equal(database.db.prepare("SELECT COUNT(*) n FROM gallery_entries").get().n,1);
});
test("concurrent first completion polls reserve just one model archive",async()=>{
  const m=await createModel();await Promise.all([finish(m.taskId),finish(m.taskId)]);
  assert.equal(entry(m.id).state,"ready");assert.equal(bucket.puts,2);assert.equal(providerPosts().length,1);
});
test("a final texture stage can finish even if preview archiving failed",async()=>{
  const first=await createModel("public");
  database.db.prepare("UPDATE generation_tasks SET kind='text-preview' WHERE task_id=?").run(first.taskId);
  database.db.prepare("UPDATE gallery_task_links SET role='preview' WHERE task_id=?").run(first.taskId);
  thumbBytes=new TextEncoder().encode("bad");await finish(first.taskId);assert.equal(entry(first.id).state,"archive_error");
  const response=await postMesh({action:"refine",previewTaskId:first.taskId});assert.equal(response.status,200);
  const child=await response.json();thumbBytes=png;await finish(child.taskId,"text");
  assert.equal(entry(first.id).result_task_id,child.taskId);assert.equal(entry(first.id).state,"ready");assert.equal(entry(first.id).visibility,"pending");
});
test("failed provider tasks are not displayed as still preparing",async()=>{
  const first=await createModel();const {archiveMeshTask}=await import("../app/gallery-storage.ts");
  await archiveMeshTask(user,first.taskId,{status:"FAILED"});assert.equal(entry(first.id).state,"failed");assert.equal(entry(first.id).visibility,"private");
});
test("an explicit anonymous or cross-origin edit cannot change gallery visibility",async()=>{
  const a=await createArtwork();runtime.actor=null;assert.equal((await change(a.creationId,"withdraw")).status,401);
  runtime.actor=user;const r=await edit(new Request(`${origin}/api/creations/${a.creationId}`,{method:"POST",headers:{origin:"https://elsewhere.example"},body:JSON.stringify({action:"withdraw",revision:0})}),context(a.creationId));
  assert.equal(r.status,403);assert.equal(entry(a.creationId).visibility,"private");
});
test("public list filters and paginates without leaking internal columns",async()=>{
  for(let i=0;i<25;i++)database.db.prepare("INSERT INTO gallery_entries(id,email,studio,title,category,visibility,state,created_at,updated_at) VALUES (?,?,'cappatex',?,'natur','published','ready',?,0)").run(`GLD-fixture-${i.toString().padStart(12,"0")}`,user,i===24?"100% Alpine":"Local flower",i);
  runtime.actor=null;
  const first=await(await listItems("studio=cappatex&category=natur")).json();assert.equal(first.items.length,24);assert.equal(first.hasMore,true);
  const last=await(await listItems("studio=cappatex&page=2")).json();assert.equal(last.items.length,1);assert.equal(last.hasMore,false);
  const search=await(await listItems("studio=cappatex&q=100%25")).json();assert.equal(search.items.length,1);
  for(const query of ["studio=invalid","studio=ab3d&category=natur","page=-1","page=1001","scope=mine"])assert.ok((await listItems(query)).status>=400);
});
test("consent and asset URL validation reject coercion and secret-bearing external addresses",()=>{
  for(const v of [null,"yes",{...choice(),rightsConfirmed:"true"},{...choice(),title:"x".repeat(81)},{...choice(),category:"unverified"}])assert.throws(()=>parseGalleryChoice(v,"ab3d"));
  for(const u of ["http://assets.meshy.ai/model.glb","https://assets.meshy.ai.evil.example/model.glb","https://user:password@assets.meshy.ai/model.glb","https://assets.meshy.ai:444/model.glb"])assert.throws(()=>meshAssetUrl(u));
});
