import GalleryShell from "../gallery-shell";
export const dynamic="force-dynamic";
export const metadata={title:"Meine 3D-Modelle | AB3D",robots:{index:false,follow:false}};
export default function Collection(){return <GalleryShell studio="ab3d" scope="mine"/>;}
