import GalleryShell from "../../gallery-shell";
export const dynamic="force-dynamic";
export const metadata={title:"Meine Motive | CAPPATEX",robots:{index:false,follow:false}};
export default function Collection(){return <GalleryShell studio="cappatex" scope="mine"/>;}
