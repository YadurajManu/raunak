import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {db} from "../src/server/db/client";
import {storage} from "../src/server/providers/storage/s3";
import {updateImage,deleteImage} from "../src/server/media/service";
import {mediaQueue,mediaConnection,producerConnection} from "../worker/queues";
async function main() {
  const id=randomUUID();
  const user=await db.user.create({data:{firebaseUid:`media-smoke-${id}`,email:`media-smoke-${id}@example.invalid`}});
  let orgId:string|undefined,eventId:string|undefined,imageId:string|undefined;
  try {
    const org=await db.organization.create({data:{name:"Private media verification",slug:`media-smoke-${id}`,members:{create:{userId:user.id,role:"OWNER"}}}});orgId=org.id;
    const event=await db.event.create({data:{orgId,title:"Private media verification",slug:`media-smoke-${id}`,startsAt:new Date(),endsAt:new Date(Date.now()+3600000)}});eventId=event.id;
    assert.equal(event.status,"DRAFT");
    const bytes=await sharp({create:{width:512,height:288,channels:3,background:"#ff5635"}}).png().toBuffer();
    const key=`orgs/${org.id}/events/${event.id}/original/${randomUUID()}`;
    await storage.write(key,bytes,"image/png");
    const image=await db.eventImage.create({data:{eventId:event.id,kind:"GALLERY",storageKey:key,mime:"image/png",sizeBytes:bytes.length,alt:"Private verification image"}});imageId=image.id;
    await updateImage(user.id,event.id,image.id,{crop:{aspect:"square",x:.5,y:.5}});
    let ready=false;
    for(let attempt=0;attempt<60;attempt++) {
      const current=await db.eventImage.findUniqueOrThrow({where:{id:image.id}});
      if(current.processingError)throw new Error("Worker processing failed.");
      if(current.variants) {
        const url=(current.variants as Record<string,Record<string,string>>).card.jpeg;
        const response=await fetch(url);assert.equal(response.status,200);
        const metadata=await sharp(Buffer.from(await response.arrayBuffer())).metadata();
        assert.equal(metadata.width,metadata.height);
        assert.deepEqual(await storage.read(key,10*1024*1024),bytes);
        ready=true;break;
      }
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    assert.ok(ready,"The running worker must finish the queued crop.");
    console.log("Live media worker passed: queued square crop, public variant access and original preservation. The temporary draft was never published.");
  } finally {
    if(imageId&&eventId)await deleteImage(user.id,eventId,imageId);
    if(eventId)await db.event.delete({where:{id:eventId}});
    if(orgId){await db.organizationMember.deleteMany({where:{orgId}});await db.organization.delete({where:{id:orgId}});}
    await db.user.delete({where:{id:user.id}});
    await mediaQueue.close();await producerConnection.quit();await mediaConnection.quit();await db.$disconnect();
  }
}
main().catch(()=>{console.error("Live media verification failed.");process.exitCode=1;});
