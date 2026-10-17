import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";
import SiteHeader from "./site-header";
import CreationGallery from "./creation-gallery";
import type { GalleryStudio } from "./gallery-policy";
import { notFound, redirect } from "next/navigation";
import { isOwnerEmail } from "../db/account";
import { entryForViewer } from "./gallery-storage";
import { collectionPath, galleryReviewPath, galleryWorkPath } from "./gallery-routes";

export default async function GalleryShell({studio,scope="public",detailId}:{studio?:GalleryStudio;scope?:"public"|"mine"|"review";detailId?:string}) {
  let currentStudio=studio||"ab3d";
  const user=scope==="public"?await getChatGPTUser():await requireChatGPTUser(scope==="mine"?collectionPath(currentStudio):galleryReviewPath(currentStudio));
  if(detailId){
    const entry=await entryForViewer(detailId,user?.email,Boolean(user&&isOwnerEmail(user.email)));
    if(!entry||(studio&&entry.studio!==studio))notFound();
    currentStudio=entry.studio;
    // Keep existing shared links working while moving motifs into CAPPATEX.
    if(!studio&&currentStudio==="cappatex")redirect(galleryWorkPath(currentStudio,detailId));
  }
  return <main id="main-content" className="gallery-page"><SiteHeader area={currentStudio==="cappatex"?"cappatex":"objects"} userName={user?.fullName||user?.displayName||null}/>
    <div className="gallery-content"><CreationGallery key={`${currentStudio}-${scope}-${detailId||"list"}`} studio={currentStudio} scope={scope} detailId={detailId}/></div></main>;
}
