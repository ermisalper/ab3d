import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { placementGeometry, profileIsVerified } from "../app/cappatex-print-profile.ts";
import { snapshotId, validatePaidLine, verifyShopifyHmac } from "../app/cappatex-snapshot.ts";
import { sha256, pngSize, encodeBase64 } from "../app/cappatex-artwork.ts";
import { CLAIM_FULFILLMENT, BEGIN_CREATE, FINISH_CREATE, createDraftOnce } from "../db/cappatex-fulfillment.ts";
import { RESERVE_DESIGN, DEBIT_DESIGN, LOG_DESIGN, REFUND_DESIGN, LOG_REFUND, FINISH_FAILURE } from "../db/cappatex-generation.ts";
import { draftProductPayload, draftMatchesSnapshot } from "../app/cappatex-printify-draft.ts";

// Entirely synthetic fixtures. These IDs and measurements are never sold or put in the profile registry.
const area = { position:"front", decorationMethod:"dtg", widthPx:4500,heightPx:5400,widthMm:381,heightMm:457.2,minDpi:300,minScale:0.1,maxScale:1 };
const variant = { printifyVariantId:1, shopifyVariantId:"gid://shopify/ProductVariant/2",sku:"TEST-ONLY",color:"White",size:"M",area,
  mockup:{url:"https://example.test/blank.png",width:1000,height:1000,left:200,top:200,printWidth:300,printHeight:360},
  shipping:["CH","LI"].map(country=>({country,method:1,currency:"USD",firstCents:100,additionalCents:50})) };
const profile = { id:"test-only",version:"1",verifiedAt:"2026-10-01T00:00:00Z",validUntil:"2026-11-01T00:00:00Z",shopId:"test",
  printifyProductId:"test-product",blueprintId:1,providerId:2,shopifyProductId:"gid://shopify/Product/3",kind:"tshirt",name:"Test fixture",
  evidence:["test fixture"],fulfillment:{route:"ab3d-api",nativeImportUnlinked:true,manualApproval:true},variants:[variant] };
const now = Date.parse("2026-10-08T00:00:00Z");

test("square 1024 preview fails resolution at large print size", () => {
  const result=placementGeometry(area,{width:1024,height:1024},{x:.5,y:.5,scale:.72});
  assert.equal(result.boundsOk,true); assert.equal(result.resolutionOk,false);
  assert.ok(Math.abs(result.dpi-94.8148)<.01);
});
test("landscape artwork keeps its true aspect, width and 300 DPI", () => {
  const result=placementGeometry(area,{width:3600,height:1800},{x:.5,y:.5,scale:.8});
  assert.equal(result.ok,true); assert.ok(Math.abs(result.widthMm-304.8)<1e-8); assert.ok(Math.abs(result.heightMm-152.4)<1e-8);
  assert.equal(result.dpi,300);
});
test("portrait clipping, overflow, nonfinite data and changed scale are rejected", () => {
  assert.equal(placementGeometry(area,{width:1000,height:2000},{x:.5,y:.5,scale:.8}).boundsOk,false);
  for(const placement of [{x:0,y:.5,scale:.5},{x:.5,y:.5,scale:1.1},{x:.5,y:NaN,scale:.5}])
    assert.equal(placementGeometry(area,{width:4500,height:5400},placement).ok,false);
});
test("profiles require both countries, exact shop, future expiry and unlink/manual evidence", () => {
  assert.equal(profileIsVerified(profile,"test",now),true);
  assert.equal(profileIsVerified(profile,"different-shop",now),false);
  for(const changed of [
    {...profile,validUntil:"2026-10-07"}, {...profile,fulfillment:{...profile.fulfillment,nativeImportUnlinked:false}},
    {...profile,fulfillment:{...profile.fulfillment,manualApproval:false}},
    {...profile,variants:[{...variant,shipping:variant.shipping.slice(0,1)}]},
    {...profile,variants:[variant,variant]},
    {...profile,variants:[{...variant,area:{...area,heightMm:228.6}}]},
  ]) assert.equal(profileIsVerified(changed,"test",now),false);
});
const sid="CPS-"+"a".repeat(32);
const snapshot={id:sid,email:"owner@example.test",profile,variant,quantity:2,country:"CH",currency:"CHF",unitPriceCents:3000};
const line={id:4,product_id:3,variant_id:2,sku:"TEST-ONLY",quantity:2,price:"30.00",properties:[{name:"CAPPATEX_SNAPSHOT_ID",value:sid}]};
const order={email:"owner@example.test",country:"CH",currency:"CHF"};
test("paid lines cannot alter variant, quantity, identity, SKU or destination", () => {
  assert.equal(validatePaidLine(snapshot,line,order),true);
  for(const changed of [{...line,quantity:3},{...line,variant_id:999},{...line,product_id:999},{...line,sku:"wrong"},{...line,price:"29.00"}])
    assert.equal(validatePaidLine(snapshot,changed,order),false);
  assert.equal(validatePaidLine(snapshot,line,{...order,country:"LI"}),false);
  assert.equal(validatePaidLine(snapshot,line,{...order,email:"someone@example.test"}),false);
  assert.equal(snapshotId({...line,properties:[...line.properties,...line.properties]}),null);
});
test("paid prices reject fractional cents and malformed decimal money", () => {
  for(const price of ["29.999","30.001","3e1","","NaN","Infinity","-30.00","9007199254740991"])
    assert.equal(validatePaidLine(snapshot,{...line,price},order),false,price);
  for(const price of ["30","30.0","30.00","30.0000"])
    assert.equal(validatePaidLine(snapshot,{...line,price},order),true,price);
});
test("discounted paid lines require manual review even when the original unit price matches", () => {
  assert.equal(validatePaidLine(snapshot,{...line,total_discount:"0.00",discount_allocations:[]},order),true);
  assert.equal(validatePaidLine(snapshot,{...line,discount_allocations:[{amount:"0.00"}]},order),true);
  for(const discount of [
    {total_discount:"1.00"}, {total_discount:"0.001"}, {total_discount:""}, {total_discount:null},
    {discount_allocations:[{amount:"6.00"}]},
    {total_discount:"0.00",discount_allocations:[{amount:"0.01"}]},
    {discount_allocations:[{amount:"0.00"},{amount:"0.01"}]},
    {discount_allocations:[{}]}, {discount_allocations:[null]}, {discount_allocations:null},
  ]) assert.equal(validatePaidLine(snapshot,{...line,...discount},order),false,JSON.stringify(discount));
});
test("Shopify HMAC verifies raw bytes and rejects changes or invalid encoding", async () => {
  const raw=new TextEncoder().encode('{"id":1}').buffer;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode("test-secret"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=encodeBase64(new Uint8Array(await crypto.subtle.sign("HMAC",key,raw)));
  assert.equal(await verifyShopifyHmac(raw,signature,"test-secret"),true);
  assert.equal(await verifyShopifyHmac(new TextEncoder().encode('{"id":2}').buffer,signature,"test-secret"),false);
  assert.equal(await verifyShopifyHmac(raw,"not base64!","test-secret"),false);
});
test("artwork hashes change with bytes and PNG dimensions come from actual header", async () => {
  const png=Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.write("IHDR",12); png.writeUInt32BE(2048,16); png.writeUInt32BE(3072,20);
  assert.deepEqual(pngSize(png),{width:2048,height:3072});
  assert.notEqual(await sha256(png),await sha256(Buffer.concat([png,Buffer.from([1])])));
  assert.throws(()=>pngSize(Buffer.from("not a PNG")));
});
function database(beforeLatest) {
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")).sort()) {
    if (file.startsWith("0006_")) beforeLatest?.(db);
    db.exec(readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8"));
  }
  db.prepare("INSERT INTO cappatex_fulfillments(id,external_id,input_sha256,state,created_at,updated_at) VALUES(?,?,?,'pending',0,0)").run("job","external","hash");
  return db;
}
function adapter(db, overrides={}) {
  return {
    claim:async()=>Boolean(db.prepare(CLAIM_FULFILLMENT).get(Date.now(),"job")),
    prepare:async()=>({bytes:"approved-artwork"}),
    beginCreate:async()=>Boolean(db.prepare(BEGIN_CREATE).get("request-hash",Date.now(),"job")),
    create:async()=>"printify-order",
    finish:async(id)=>{db.prepare(FINISH_CREATE).run(id,Date.now(),"job");},
    hold:async()=>{db.prepare("UPDATE cappatex_fulfillments SET state='manual_review' WHERE id='job'").run();},
    ...overrides
  };
}
test("simultaneous webhook claims create exactly one draft", async () => {
  const db=database(); let created=0;
  const a=adapter(db,{create:async()=>{created++;return"printify-order";}});
  await Promise.all([createDraftOnce(a),createDraftOnce(a),createDraftOnce(a)]);
  assert.equal(created,1);
  assert.equal(db.prepare("SELECT state FROM cappatex_fulfillments").get().state,"draft_ready");
  db.close();
});

function transaction(db, work) {
  db.exec("BEGIN");
  try { const result=work(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const testEmail="owner@example.test";
function reserve(db, id, exempt=false) {
  return transaction(db,()=>{
    const row=db.prepare(RESERVE_DESIGN).run(id,testEmail,"test motif","production prompt","Minimal","square",0,0,exempt?0:1,testEmail,exempt?1:0);
    db.prepare(DEBIT_DESIGN).run(0,testEmail,id);
    db.prepare(LOG_DESIGN).run(testEmail,id,0,id);
    return row.changes;
  });
}
function refund(db,id,status="generation_failed") {
  transaction(db,()=>{
    db.prepare(REFUND_DESIGN).run(testEmail,id);
    db.prepare(LOG_REFUND).run(testEmail,id,0,id);
    db.prepare(FINISH_FAILURE).run(status,0,id);
  });
}
test("generation reserves exactly one token and blocks concurrent or uncertain calls",()=>{
  const db=database();
  db.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,2,0,0)").run(testEmail);
  assert.equal(reserve(db,"first"),1);
  assert.throws(()=>reserve(db,"parallel"),/UNIQUE/);
  assert.equal(db.prepare("SELECT token_balance FROM accounts").get().token_balance,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n,1);
  refund(db,"first","generation_uncertain"); refund(db,"first","generation_uncertain");
  assert.equal(db.prepare("SELECT token_balance FROM accounts").get().token_balance,2);
  assert.throws(()=>reserve(db,"retry"),/UNIQUE/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n,2);
  db.close();
});
test("a saved successful generation is never refunded after a lost database response",()=>{
  const db=database();
  db.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,1,0,0)").run(testEmail);
  reserve(db,"success");
  db.exec("UPDATE cappatex_designs SET status='preview_ready' WHERE id='success'");
  refund(db,"success");
  assert.equal(db.prepare("SELECT token_balance FROM accounts").get().token_balance,0);
  assert.equal(db.prepare("SELECT token_refunded FROM cappatex_designs").get().token_refunded,0);
  assert.equal(reserve(db,"without-credit"),0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n,1);
  db.close();
});
test("explicit legacy repair precedes the schema-only migration and keeps paid retries blocked",()=>{
  const db=database(db=>{
    db.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,2,0,0)").run(testEmail);
    const insert=db.prepare("INSERT INTO cappatex_designs(id,email,prompt,production_prompt,style,product_key,preview_base64,status,created_at,updated_at) VALUES(?,?,'','','','','','generating',0,0)");
    insert.run("old-a",testEmail); insert.run("old-b",testEmail);
    db.exec(readFileSync(new URL("../scripts/sql/cappatex-legacy-generation-repair.sql",import.meta.url),"utf8"));
  });
  assert.deepEqual(db.prepare("SELECT status FROM cappatex_designs ORDER BY id").all().map(row=>row.status),["generation_uncertain","generation_legacy_review"]);
  assert.throws(()=>reserve(db,"new-call"),/UNIQUE/);
  db.close();
});
test("timeout and failure to save a successful response never repeat creation", async () => {
  for(const mode of ["timeout","db-failure"]) {
    const db=database(); let created=0;
    const a=adapter(db,{create:async()=>{created++;if(mode==="timeout") throw Error("timeout");return"remote-order";},
      finish:async()=>{throw Error("db unavailable");}});
    assert.equal(await createDraftOnce(a),"creation_uncertain");
    await createDraftOnce(a); assert.equal(created,1);
    assert.equal(db.prepare("SELECT state FROM cappatex_fulfillments").get().state,"creating");
    db.close();
  }
});
test("failed preparation makes no order and requires manual review", async () => {
  const db=database(); let created=0;
  assert.equal(await createDraftOnce(adapter(db,{prepare:async()=>{throw Error("bad artifact");},create:async()=>{created++;return"id";}})),"manual_review");
  assert.equal(created,0); db.close();
});
test("migrations keep snapshots independent and prevent a second order consuming them", () => {
  const db=database();
  db.prepare("INSERT INTO accounts(email,created_at,updated_at) VALUES('owner@example.test',0,0)").run();
  db.prepare("INSERT INTO cappatex_designs(id,email,prompt,production_prompt,style,product_key,preview_base64,created_at,updated_at) VALUES('design','owner@example.test','','','','','',0,0)").run();
  const insert=db.prepare("INSERT INTO cappatex_snapshots(id,email,design_id,payload_json,payload_sha256,created_at) VALUES(?,'owner@example.test','design',?,'hash',0)");
  insert.run("snapshot-a",JSON.stringify({placement:.3})); insert.run("snapshot-b",JSON.stringify({placement:.7}));
  db.prepare("INSERT INTO cappatex_fulfillment_lines(snapshot_id,fulfillment_id,shopify_line_id) VALUES('snapshot-a','job','line1')").run();
  assert.throws(()=>db.prepare("INSERT INTO cappatex_fulfillment_lines(snapshot_id,fulfillment_id,shopify_line_id) VALUES('snapshot-a','job','line2')").run(),/UNIQUE/);
  assert.deepEqual(db.prepare("SELECT payload_json FROM cappatex_snapshots ORDER BY id").all().map(r=>JSON.parse(r.payload_json).placement),[.3,.7]);
  db.close();
});

test("Printify draft references the original upload and rejects changed artwork, placement or background",()=>{
  const approved={...snapshot,placement:{x:.4,y:.6,scale:.3}};
  const payload=draftProductPayload(approved,"original-upload",2500);
  assert.deepEqual(payload.print_areas[0].placeholders[0].images,[{id:"original-upload",x:.4,y:.6,scale:.3,angle:0}]);
  assert.equal(JSON.stringify(payload).includes("preview_url"),false);
  const draft={...payload,id:"test-draft",visible:false,
    print_areas:payload.print_areas.map(area=>({...area,placeholders:area.placeholders.map(p=>({...p,decoration_method:"dtg"}))}))};
  assert.equal(draftMatchesSnapshot(draft,approved,"original-upload"),true);
  const withBackground=background=>({...draft,print_areas:draft.print_areas.map(area=>({...area,background}))});
  assert.equal(draftMatchesSnapshot(withBackground(null),approved,"original-upload"),true);
  assert.equal(draftMatchesSnapshot(withBackground("transparent"),approved,"original-upload"),true);
  for(const background of ["#fff","#f00","#ffffff","#ff0000",""," "," transparent ","unknown"])
    assert.equal(draftMatchesSnapshot(withBackground(background),approved,"original-upload"),false);
  assert.equal(draftMatchesSnapshot({...draft,visible:true},approved,"original-upload"),false);
  assert.equal(draftMatchesSnapshot(draft,{...approved,placement:{...approved.placement,scale:.5}},"original-upload"),false);
  assert.equal(draftMatchesSnapshot(draft,approved,"different-upload"),false);
  assert.equal(draftMatchesSnapshot(draft,{...approved,variant:{...variant,area:{...area,decorationMethod:"dtf"}}},"original-upload"),false);
});
