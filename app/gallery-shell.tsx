import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";
import SiteHeader from "./site-header";
import CreationGallery from "./creation-gallery";
import type { GalleryStudio } from "./gallery-policy";

export default async function GalleryShell({studio,scope="public",detailId}:{studio?:GalleryStudio;scope?:"public"|"mine"|"review";detailId?:string}) {
  const user=scope==="public"?await getChatGPTUser():await requireChatGPTUser(scope==="mine"?"/sammlung":"/galerie/pruefung");
  return <main id="main-content" className="gallery-page"><SiteHeader area={studio==="cappatex"?"cappatex":"objects"} userName={user?.fullName||user?.displayName||null}/>
    <div className="gallery-content"><CreationGallery key={`${studio||"both"}-${scope}-${detailId||"list"}`} studio={studio} scope={scope} detailId={detailId}/></div></main>;
}
