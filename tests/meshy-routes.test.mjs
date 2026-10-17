import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// These handlers and account operations are real; identities, D1 and all provider
// responses are local fixtures. No test can delegate fetch to a live API.
const fixture = { env: {}, actor: "meshy-owner@example.test", requests: [], resultStatus: 200 };
globalThis.__meshyOfflineUpdate = fixture;
const hook = registerHooks({
  resolve(s,c,next) {
    if (s === "cloudflare:workers" || s === "next/headers" || s === "next/navigation") return {url:`meshy-fixture:${s}`,shortCircuit:true};
    if (s.startsWith(".") && c.parentURL?.startsWith("file:")) {
      const u = new URL(`${s}.ts`,c.parentURL); if (existsSync(u)) return next(u.href,c);
    }
    return next(s,c);
  },
  load(u,c,next) {
    const src = {
      "meshy-fixture:cloudflare:workers": "export const env = globalThis.__meshyOfflineUpdate.env;",
      "meshy-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__meshyOfflineUpdate.actor?{'oai-authenticated-user-email':globalThis.__meshyOfflineUpdate.actor}:{});}",
      "meshy-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[u];
    return src ? {format:"module",source:src,shortCircuit:true} : next(u,c);
  },
});
const { POST, GET } = await import("../app/api/meshy/route.ts");
const { buildDesignPlan } = await import("../app/design-planner.ts");
const { printReportVerified, printSize } = await import("../app/meshy-policy.ts");

class OfflineD1 {
  constructor() {
    this.sql = new DatabaseSync(":memory:");
    this.sql.exec("PRAGMA foreign_keys = ON");
    for (const f of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")).sort())
      this.sql.exec(readFileSync(new URL(`../drizzle/${f}`,import.meta.url),"utf8"));
  }
  prepare(query) {
    const db = this.sql;
    const make = (args=[]) => ({bind:(...a)=>make(a),
      first:async()=>{const r=db.prepare(query).get(...args);return r?{...r}:null;},
      all:async()=>({success:true,results:db.prepare(query).all(...args)}),
      runSync(){const r=db.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},
      async run(){return this.runSync();},
    });
    return make();
  }
  async batch(statements) {
    this.sql.exec("BEGIN");
    try { const results=statements.map(s=>s.runSync());this.sql.exec("COMMIT");return results; }
    catch(e){this.sql.exec("ROLLBACK");throw e;}
  }
}
const oldFetch=globalThis.fetch, oldEnv={...process.env};
const origin="https://ab3d.example.test", email="meshy-owner@example.test";
const image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
let database;
beforeEach(()=>{
  database=new OfflineD1();fixture.env.DB=database;fixture.actor=email;fixture.requests=[];fixture.resultStatus=200;
  process.env.MESHY_API_KEY="offline-placeholder-never-a-real-key";
  process.env.AB3D_UNLIMITED_EMAILS="";process.env.AB3D_OWNER_EMAILS="";
  database.sql.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,20,'3d-studio','active',0,0)").run(email);
  globalThis.fetch=async (url,init={})=>{
    assert.ok(String(url).startsWith("https://api.meshy.ai/openapi/"),"Only offline Meshy fixtures are allowed");
    const request={url:String(url),method:init.method||"GET",body:init.body?JSON.parse(init.body):null};fixture.requests.push(request);
    if(request.method==="POST")return fixture.resultStatus===200
      ? Response.json({result:`fixture-task-${String(fixture.requests.length).padStart(8,"0")}`})
      : Response.json({message:"Fixture upstream rejection"},{status:fixture.resultStatus});
    if(String(url).endsWith("/balance"))return Response.json({balance:200,monthly_credits:100,permanent_credits:100});
    return Response.json({id:String(url).split("/").at(-1),status:"SUCCEEDED",progress:100,
      model_urls:{glb:"https://assets.meshy.ai/fixture/model.glb"}});
  };
});
afterEach(()=>{
  database.sql.close();globalThis.fetch=oldFetch;
  for(const k of ["MESHY_API_KEY","AB3D_UNLIMITED_EMAILS","AB3D_OWNER_EMAILS"]){
    if(oldEnv[k]===undefined)delete process.env[k];else process.env[k]=oldEnv[k];
  }
});
after(()=>{hook.deregister();delete globalThis.__meshyOfflineUpdate;});
const post=body=>POST(new Request(`${origin}/api/meshy`,{method:"POST",headers:{origin,host:"ab3d.example.test","Content-Type":"application/json"},body:JSON.stringify({galleryChoice:{version:"gallery-2026-10-17-v1",visibility:"private",category:"sonstiges",title:"Local fixture",rightsConfirmed:false},...body})}));
const balance=()=>database.sql.prepare("SELECT token_balance FROM accounts WHERE email=?").get(email).token_balance;
const posts=()=>fixture.requests.filter(r=>r.method==="POST");
function source(id,kind="text-preview",status="SUCCEEDED",owner=email){
  database.sql.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,?,1,?,0,0,0)").run(id,owner,kind,status);
}
function textPlan(){
  const answers={};let p=buildDesignPlan("planter","Ein breiter Blumentopf für eine kleine Sukkulente",answers);
  for(let round=0;round<4&&!p.complete;round++){
    for(const q of p.questions)answers[q.id] ||= q.options[0].value;
    p=buildDesignPlan("planter",p.customerIdea,answers);
  }
  assert.equal(p.complete,true);return {templateId:p.templateId,idea:p.customerIdea,answers,planVersion:p.planVersion};
}

for(const quality of ["quality","fast"])test(`text ${quality} uses the verified model and canonical API path`,async()=>{
  const r=await post({action:"create",type:"text",quality,designPlan:textPlan()});assert.equal(r.status,200);
  const req=posts()[0];assert.equal(req.url,"https://api.meshy.ai/openapi/v2/text-to-3d");assert.equal(req.body.mode,"preview");
  assert.equal(req.body.ai_model,quality==="fast"?"meshy-t2.5":"meshy-7.1");
  if(quality==="fast"){assert.equal(req.body.model_type,"smart-topology");assert.equal(req.body.target_polycount,15000);assert.equal(req.body.topology,"triangle");assert.equal(req.body.geometry_resolution,undefined);}
  else {assert.equal(req.body.geometry_resolution,"standard");assert.equal(req.body.should_remesh,false);}
  assert.equal(req.body.ultra_mode,undefined);assert.deepEqual(req.body.target_formats,["glb"]);assert.equal(balance(),19);
});

for(const quality of ["quality","fast"])for(const count of [1,2,4])test(`${count} image(s), ${quality}: only compatible model options are sent`,async()=>{
  const r=await post({action:"create",type:"image",quality,imageDatas:Array(count).fill(image)});assert.equal(r.status,200);
  const req=posts()[0], b=req.body;
  assert.ok(req.url.endsWith(count===1?"/image-to-3d":"/multi-image-to-3d"));
  assert.equal(b.ai_model,quality==="fast"&&count===1?"meshy-t2.5":"meshy-7.1");
  assert.equal(b.should_texture,quality==="quality");assert.equal(b.texture_resolution,quality==="quality"?"2k":undefined);
  if(count===1&&quality==="fast"){assert.equal(b.image_enhancement,undefined);assert.equal(b.should_remesh,undefined);assert.equal(b.remove_lighting,undefined);}
  else {assert.equal(b.geometry_resolution,"standard");assert.equal(b.image_enhancement,false);}
  assert.equal(balance(),quality==="quality"?18:19);
});

test("refining an existing preview inherits its original model",async()=>{
  source("legacy-preview-1234");
  const r=await post({action:"refine",previewTaskId:"legacy-preview-1234"});assert.equal(r.status,200);
  const b=posts()[0].body;assert.equal(b.mode,"refine");assert.equal(b.ai_model,undefined);
  assert.equal(b.remove_lighting,undefined);assert.equal(b.texture_resolution,"2k");assert.equal(balance(),19);
});
test("omitted quality retains the legacy image preview cost instead of enabling texturing",async()=>{
  const r=await post({action:"create",type:"image",imageDatas:[image]});assert.equal(r.status,200);
  assert.equal(posts()[0].body.should_texture,false);assert.equal(posts()[0].body.ai_model,"meshy-t2.5");assert.equal(balance(),19);
});
test("refine and image transformation require the correct completed owned parent",async()=>{
  source("pending-preview-1234","text-preview","PENDING");source("wrong-kind-source-1234","resize");
  for(const body of [{action:"refine",previewTaskId:"pending-preview-1234"},{action:"refine",previewTaskId:"wrong-kind-source-1234"},
    {action:"refine",previewTaskId:"foreign-preview-1234"},{action:"create",type:"image",inputTaskId:"wrong-kind-source-1234"}])
    assert.equal((await post(body)).status,403);
  assert.equal(posts().length,0);assert.equal(balance(),20);
});
test("generated multi-view references use Meshy 7.1 instead of unsupported Smart Topology",async()=>{
  source("transformed-views-1234","image-transform");
  const r=await post({action:"create",type:"image",quality:"fast",inputTaskId:"transformed-views-1234"});assert.equal(r.status,200);
  const b=posts()[0].body;assert.equal(b.ai_model,"meshy-7.1");assert.equal(b.model_type,undefined);assert.equal(b.image_enhancement,undefined);
});
test("invalid or excessive input images are rejected without a paid provider request",async()=>{
  for(const imageDatas of [[],Array(5).fill(image),[image,42],["bad-image"]])assert.equal((await post({action:"create",type:"image",imageDatas})).status,400);
  assert.equal(posts().length,0);assert.equal(balance(),20);
});
test("upstream rejection refunds the unstarted charge and is never retried",async()=>{
  fixture.resultStatus=429;
  const r=await post({action:"create",type:"image",quality:"quality",imageDatas:[image]});assert.equal(r.status,429);
  assert.equal(balance(),20);assert.equal(posts().length,1);
});

for(const action of ["analyze","repair"])for(const heightCm of [2,18,80])test(`${action} includes FDM and the actual ${heightCm} cm print size`,async()=>{
  source("owned-model-1234","resize");
  const r=await post({action,sourceTaskId:"owned-model-1234",sourceTaskType:"resize",heightCm});assert.equal(r.status,200);
  const b=posts()[0].body;assert.equal(b.printer_type,"fdm");assert.equal(b.intended_print_height_mm,heightCm*10);
  assert.equal(b.intended_print_longest_side_mm,undefined);assert.equal(balance(),action==="analyze"?20:19);
});
test("size-dependent checks reject missing, string, non-GLB and out-of-range sizes",async()=>{
  source("owned-model-1234","resize");
  for(const action of ["analyze","repair"])for(const heightCm of [undefined,"18",1,81,null])assert.equal((await post({action,sourceTaskId:"owned-model-1234",sourceTaskType:"resize",heightCm})).status,400);
  assert.equal((await post({action:"analyze",sourceTaskId:"owned-model-1234",sourceTaskType:"resize",heightCm:18,sourceFormat:"stl"})).status,400);
  assert.equal(posts().length,0);assert.equal(balance(),20);
});
test("unowned model cannot be analyzed or repaired; health is read-only and hides balance",async()=>{
  assert.equal((await post({action:"repair",sourceTaskId:"foreign-model-1234",sourceTaskType:"resize",heightCm:18})).status,403);
  const r=await GET(new Request(`${origin}/api/meshy?health=1`));assert.equal(r.status,200);
  assert.equal((await r.json()).balance,undefined);assert.equal(posts().length,0);assert.equal(balance(),20);
});

test("only a healthy, measured FDM report for the chosen height approves a print package",()=>{
  const report={status:"healthy",issue_count:0,error_count:0,warning_count:0,
    metrics:{is_watertight:true,volume:12,non_manifold_edges:0,degenerate_faces:0,holes:0},
    intended_print:{printer_type:"fdm",height_mm:180,wall_thickness_mm:1},
    thin_walls:{status:"healthy",has_thin_walls:false}};
  assert.equal(printReportVerified(report,18),true);
  assert.equal(printReportVerified({...report,thin_walls:{status:"healthy",has_thin_walls:true}},18),true,"Tiny corners must use the provider verdict, not trigger an unnecessary repair");
  for(const changed of [{status:"warning"},{status:"unknown"},{thin_walls:undefined},{intended_print:undefined},
    {thin_walls:{status:"error",has_thin_walls:true}}, {thin_walls:{status:"unknown",has_thin_walls:null}},
    {intended_print:{printer_type:"sla",height_mm:180,wall_thickness_mm:.8}}, {intended_print:{printer_type:"fdm",height_mm:150,wall_thickness_mm:1}},
    {metrics:{...report.metrics,is_watertight:false}},{metrics:{...report.metrics,holes:2}}])
    assert.equal(printReportVerified({...report,...changed},18),false);
  assert.deepEqual(printSize(2),{printer_type:"fdm",intended_print_height_mm:20});
});
