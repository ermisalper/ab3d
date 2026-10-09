import test from "node:test";
import assert from "node:assert/strict";
import { decode, encode } from "fast-png";
import { createArtworkPreview } from "../app/cappatex-preview.ts";

test("preview keeps transparent edges, aspect and motif colors without changing the original",()=>{
  const pixels=new Uint8Array(8*4*4);
  for(let y=0;y<4;y++) for(let x=0;x<8;x++) {
    const i=(y*8+x)*4;
    if(x<2) pixels.set([240,60,20,255],i);
    else if(x<4) pixels.set([0,0,0,0],i);
    else pixels.set([20,80,240,255],i);
  }
  const original=encode({width:8,height:4,depth:8,channels:4,data:pixels});
  const before=original.slice();
  const preview=createArtworkPreview(original);
  assert.deepEqual(original,before);
  assert.deepEqual([preview.width,preview.height],[2,1]);
  assert.deepEqual([...decode(preview.bytes).data],[240,60,20,128,20,80,240,255]);
  assert.deepEqual(preview.bytes,createArtworkPreview(original).bytes);
});

test("preview rejects unsupported files, oversized geometry and corrupt pixels",()=>{
  const original=encode({width:8,height:4,depth:8,channels:4,data:new Uint8Array(128)});
  const corrupt=original.slice(); corrupt[corrupt.length-6]^=1;
  assert.throws(()=>createArtworkPreview(corrupt));
  assert.throws(()=>createArtworkPreview(new Uint8Array(20)));
  const oversized=original.slice(); new DataView(oversized.buffer).setUint32(16,8192);
  assert.throws(()=>createArtworkPreview(oversized),/unsupported/);
});
