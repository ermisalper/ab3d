import GalleryShell from "../../../gallery-shell";
export const dynamic="force-dynamic";
export const metadata={title:"Gespeichertes Motiv | CAPPATEX",robots:{index:false,follow:false}};
export default async function Work({params}:{params:Promise<{id:string}>}){const {id}=await params;return <GalleryShell studio="cappatex" detailId={id}/>;}
