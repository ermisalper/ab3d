import GalleryShell from "../gallery-shell";
export const dynamic="force-dynamic";
export const metadata={title:"Meine Sammlung | AB3D",robots:{index:false,follow:false}};
export default function Collection(){return <GalleryShell scope="mine"/>;}
