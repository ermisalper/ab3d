// Optional local browser check: node tests/cappatex-browser-check.mjs
// Serves synthetic images and the real upload normalizer. No API, accounts or secrets.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import ts from "typescript";

const client = ts.transpileModule(readFileSync(new URL("../app/cappatex-upload-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const page = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>CAPPATEX · Lokaler Bildtest</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px;background:#f6f1e8;color:#183628}button{padding:14px;font:inherit}article{background:white;padding:20px;margin:20px 0}img{max-width:180px;max-height:220px;image-rendering:pixelated;border:1px solid #999}pre{white-space:pre-wrap}output{display:block}</style>
<h1>CAPPATEX · Lokaler Bildtest</h1><p>Nur synthetische Testbilder. Keine KI, kein Produkt, keine Bestellung und keine externe Anfrage.</p>
<button id="run">PNG und gedrehtes JPG prüfen</button><output id="result" role="status">Bereit</output><section id="images"></section>
<script type="module">
import { prepareCustomerImage } from '/client.js';
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const blob=(canvas,type)=>new Promise(resolve=>canvas.toBlob(resolve,type));
document.querySelector('#run').onclick=async()=>{
  const out=document.querySelector('#result'); document.querySelector('#images').replaceChildren(); out.textContent='Prüfung läuft …';
  try {
    const canvas=document.createElement('canvas');canvas.width=9;canvas.height=5;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#de6030';ctx.fillRect(0,0,4,5);ctx.fillStyle='#174432';ctx.fillRect(4,0,4,5);
    const png=await blob(canvas,'image/png');
    const jpeg=new Uint8Array(await (await blob(canvas,'image/jpeg')).arrayBuffer());
    const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,77,77,0,42,0,0,0,8,0,1,1,18,0,3,0,0,0,1,0,6,0,0,0,0,0,0]);
    const rotated=new Blob([jpeg.subarray(0,2),exif,jpeg.subarray(2)],{type:'image/jpeg'});
    for(const fixture of [{name:'Transparente PNG-Kante',blob:png,width:9,height:5},{name:'JPG mit EXIF-Drehung 6',blob:rotated,width:5,height:9}]){
      const output=await prepareCustomerImage(new File([fixture.blob],'local-test.'+(fixture.blob.type==='image/png'?'png':'jpg'),{type:fixture.blob.type}));
      const img=new Image();img.src=URL.createObjectURL(output);await img.decode();
      check(output.type==='image/png','Kein PNG');check(img.naturalWidth===fixture.width&&img.naturalHeight===fixture.height,'Orientierung oder Abmessungen falsch');
      if(fixture.blob.type==='image/png') {const probe=document.createElement('canvas');probe.width=9;probe.height=5;const pc=probe.getContext('2d');pc.drawImage(img,0,0);check(pc.getImageData(8,0,1,1).data[3]===0,'Transparenz verloren');check(pc.getImageData(0,0,1,1).data[0]===222,'Farbe verändert');}
      const card=document.createElement('article');const title=document.createElement('h2');title.textContent=fixture.name+' · bestanden';const info=document.createElement('p');info.textContent='PNG-Druckdatei: '+img.naturalWidth+' × '+img.naturalHeight+' px';card.append(title,info,img);document.querySelector('#images').append(card);
    }
    const rejected=await prepareCustomerImage(new File(['x'],'invalid.svg',{type:'image/svg+xml'})).then(()=>false,()=>true);check(rejected,'SVG wurde nicht abgelehnt');
    out.textContent='3 Prüfungen bestanden: PNG-Farbe/Transparenz, JPG-Ausrichtung, Ablehnung nicht unterstützter Formate.';
  } catch(error) {out.textContent='FEHLER: '+error.message;}
};
</script></html>`;
createServer((request, response) => {
  const isClient = request.url === "/client.js";
  if (request.method !== "GET" || (!isClient && request.url !== "/")) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": isClient ? "text/javascript" : "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(isClient ? client : page);
}).listen(3011, "127.0.0.1", () => console.log("Local-only CAPPATEX image check: http://127.0.0.1:3011/"));
