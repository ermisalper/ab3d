import { env } from "cloudflare:workers";
import { boundedBody } from "./cappatex-upload";

const MAX_MODEL_BYTES = 400_000_000;
export function meshAssetUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid_gallery_asset");
  const u = new URL(value);
  if (u.protocol !== "https:" || u.hostname !== "assets.meshy.ai" || u.username || u.password || (u.port && u.port !== "443")) throw new Error("invalid_gallery_asset");
  return u.href;
}

function bytesTogether(chunks: Uint8Array[], length: number) {
  const bytes = new Uint8Array(length);let offset=0;
  for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}

/** Validate the bounded JSON prefix, then stream the original self-contained GLB. */
export async function storeGalleryGlb(url: unknown, key: string) {
  const response=await fetch(meshAssetUrl(url),{redirect:"error",signal:AbortSignal.timeout(120_000)});
  const length=Number(response.headers.get("content-length"));
  if(!response.ok||!response.body||!Number.isSafeInteger(length)||length<28||length>MAX_MODEL_BYTES)throw new Error("unsupported_gallery_model");
  const reader=response.body.getReader(), chunks:Uint8Array[]=[];
  let prefixLength=0, needed=20;
  try {
    while(prefixLength<needed){
      const {done,value}=await reader.read();if(done||!value||value.length>8_500_000||chunks.length>8192)throw new Error("invalid_gallery_glb");
      chunks.push(value);prefixLength+=value.length;
      if(needed===20&&prefixLength>=20){
        const header=bytesTogether(chunks,prefixLength),v=new DataView(header.buffer);
        if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==length
          ||v.getUint32(16,true)!==0x4e4f534a)throw new Error("invalid_gallery_glb");
        const jsonLength=v.getUint32(12,true);
        if(!jsonLength||jsonLength>8_000_000||jsonLength%4||20+jsonLength>length)throw new Error("invalid_gallery_glb");
        needed=20+jsonLength;
      }
    }
    if(prefixLength>length)throw new Error("invalid_gallery_glb");
    const json=JSON.parse(new TextDecoder().decode(bytesTogether(chunks,prefixLength).subarray(20,needed)));
    const embedded=(list:unknown,allowed:RegExp)=>Array.isArray(list)&&list.every(item=>
      item&&typeof item==="object"&&(item.uri===undefined||(typeof item.uri==="string"&&allowed.test(item.uri))));
    if(json.asset?.version!=="2.0"
      ||!embedded(json.buffers||[],/^data:application\/(?:octet-stream|gltf-buffer);base64,/i)
      ||!embedded(json.images||[],/^data:image\/(?:png|jpeg|webp|ktx2);base64,/i))throw new Error("external_gallery_resources");
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  let total=prefixLength;
  const stream=new ReadableStream<Uint8Array>({
    start(c){for(const part of chunks)c.enqueue(part);},
    async pull(c){try{const {done,value}=await reader.read();if(done){if(total!==length)throw new Error("invalid_gallery_length");c.close();return;}
      total+=value.length;if(total>length)throw new Error("invalid_gallery_length");c.enqueue(value);
    }catch(error){c.error(error);await reader.cancel().catch(()=>{});}},
    cancel(){return reader.cancel();},
  });
  // R2 requires a known stream length. Node fixtures use the same bounded stream.
  const Fixed=(globalThis as unknown as {FixedLengthStream?:new(n:number)=>TransformStream<Uint8Array,Uint8Array>}).FixedLengthStream;
  const body=Fixed?stream.pipeThrough(new Fixed(length)):stream;
  await env.BUCKET.put(key,body,{httpMetadata:{contentType:"model/gltf-binary"}});
  return length;
}

export async function storeGalleryThumbnail(url: unknown,key: string) {
  const response=await fetch(meshAssetUrl(url),{redirect:"error",signal:AbortSignal.timeout(30_000)});
  if(!response.ok||!response.body)throw new Error("invalid_gallery_thumbnail");
  const bytes=await boundedBody({headers:response.headers,body:response.body} as Request,4_000_000);
  let type="";
  if(bytes[0]===137&&new TextDecoder().decode(bytes.subarray(1,4))==="PNG")type="image/png";
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type="image/jpeg";
  else if(new TextDecoder().decode(bytes.subarray(0,4))==="RIFF"&&new TextDecoder().decode(bytes.subarray(8,12))==="WEBP")type="image/webp";
  if(!type)throw new Error("invalid_gallery_thumbnail");
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});return type;
}
