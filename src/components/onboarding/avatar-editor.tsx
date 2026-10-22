"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import "./avatar-editor.css";

type Photo = {url:string; bitmap:ImageBitmap};
export function AvatarEditor({src,name,disabled=false,onSaved}:{src:string|null;name:string;disabled?:boolean;onSaved:(url:string|null)=>void}) {
  const router=useRouter();
  const title=useId();
  const input=useRef<HTMLInputElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const xhr=useRef<XMLHttpRequest|null>(null);
  const drag=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
  const [photo,setPhoto]=useState<Photo|null>(null);
  const [zoom,setZoom]=useState(1);
  const [position,setPosition]=useState({x:0,y:0});
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<number|null>(null);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>()=>xhr.current?.abort(),[]);
  useEffect(()=>{
    if(!photo) return;
    dialog.current?.showModal();
    return ()=>{ URL.revokeObjectURL(photo.url); photo.bitmap.close(); };
  },[photo]);
  function close() { if(busy)return; dialog.current?.close();setPhoto(null);setError("");requestAnimationFrame(()=>trigger.current?.focus()); }
  async function choose(file?:File) {
    if(!file)return;
    setError("");setStatus("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Choose a JPEG, PNG or WebP image.");return;}
    if(!file.size || file.size>2*1024*1024){setError("Choose an image smaller than 2 MB.");return;}
    try {
      const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
      if(bitmap.width*bitmap.height>25_000_000 || Math.min(bitmap.width,bitmap.height)<64){bitmap.close();throw new Error("Choose an image between 64 × 64 pixels and 25 megapixels.");}
      setZoom(1);setPosition({x:0,y:0});setPhoto({url:URL.createObjectURL(file),bitmap});
    } catch(failure) {setError(failure instanceof Error && failure.message.startsWith("Choose") ? failure.message : "This image could not be opened. Try another photo.");}
  }
  function changed(url:string|null) {
    onSaved(url); window.dispatchEvent(new CustomEvent("raunak:avatar",{detail:url}));router.refresh();
  }
  async function upload() {
    if(!photo)return;
    setBusy(true);setError("");setProgress(null);setStatus("Preparing your photo…");
    try {
      const {bitmap}=photo;
      const side=Math.min(bitmap.width,bitmap.height)/zoom;
      const x=(bitmap.width-side)/2*(1+position.x), y=(bitmap.height-side)/2*(1+position.y);
      const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;
      const context=canvas.getContext("2d");if(!context)throw new Error("Photo editing is unavailable in this browser.");
      context.drawImage(bitmap,x,y,side,side,0,0,512,512);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare your photo.")),"image/webp",.9));
      const body=new FormData();body.set("photo",blob,"profile.webp");
      setProgress(0);setStatus("Uploading photo…");
      const result=await new Promise<{url:string}>((resolve,reject)=>{
        const request=new XMLHttpRequest();xhr.current=request;
        request.open("POST","/api/profile/avatar");request.timeout=60000;
        request.upload.onprogress=event=>{if(event.lengthComputable)setProgress(Math.round(event.loaded/event.total*100));};
        request.upload.onload=()=>{setProgress(100);setStatus("Processing photo…");};
        request.onerror=()=>reject(new Error("Upload interrupted. Check your connection and retry."));
        request.ontimeout=()=>reject(new Error("Upload took too long. Please retry."));
        request.onabort=()=>reject(new Error("Upload cancelled."));
        request.onload=()=>{try{const data=JSON.parse(request.responseText);if(request.status<200||request.status>=300||typeof data.url!=="string")throw new Error(data.error||"Could not save photo.");resolve(data);}catch(failure){reject(failure instanceof Error?failure:new Error("Could not save photo."));}};
        request.send(body);
      });
      changed(result.url);setStatus("Profile photo saved.");dialog.current?.close();setPhoto(null);requestAnimationFrame(()=>trigger.current?.focus());
    } catch(failure) {setError(failure instanceof Error?failure.message:"Could not save photo. Please retry.");setStatus("");}
    finally{setBusy(false);setProgress(null);xhr.current=null;}
  }
  async function remove() {
    setBusy(true);setError("");
    try{const response=await fetch("/api/profile/avatar",{method:"DELETE"});if(!response.ok)throw new Error("Could not remove photo. Please retry.");changed(null);setStatus("Profile photo removed.");}
    catch(failure){setError(failure instanceof Error?failure.message:"Could not remove photo.");}
    finally{setBusy(false);}
  }
  const displayWidth=photo?256*photo.bitmap.width/Math.min(photo.bitmap.width,photo.bitmap.height)*zoom:256;
  const displayHeight=photo?256*photo.bitmap.height/Math.min(photo.bitmap.width,photo.bitmap.height)*zoom:256;
  return <div className="avatar-editor"><div className="avatar-editor-row"><InitialsAvatar name={name} src={src} size={80}/><div><div className="avatar-editor-actions"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile photo file" onChange={event=>{void choose(event.target.files?.[0]);event.target.value="";}}/><button ref={trigger} type="button" className="ui-button" disabled={disabled||busy} onClick={()=>input.current?.click()}><Camera size={16} aria-hidden="true"/>{src?"Change photo":"Upload photo"}</button>{src&&<button type="button" className="ui-button" disabled={disabled||busy} onClick={()=>void remove()}>Remove photo</button>}</div><p>JPEG, PNG or WebP · up to 2 MB. Photos save immediately.</p></div></div>{!photo&&error&&<p className="avatar-error" role="alert">{error}</p>}<p className="avatar-status" role="status">{!photo&&status}</p>{photo&&<dialog ref={dialog} className="avatar-crop-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();close();}}><header><h2 id={title}>Adjust profile photo</h2><button type="button" className="ui-button" aria-label="Close photo editor" disabled={busy} onClick={close}><X size={18} aria-hidden="true"/></button></header><p>Drag the photo or use the controls to position it.</p><div className="avatar-crop-frame" style={{touchAction:"none"}} onPointerDown={event=>{if(busy)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,startX:position.x,startY:position.y};}} onPointerMove={event=>{if(!drag.current)return;const start=drag.current;setPosition({x:Math.max(-1,Math.min(1,start.startX-(event.clientX-start.x)*2/Math.max(1,displayWidth-256))),y:Math.max(-1,Math.min(1,start.startY-(event.clientY-start.y)*2/Math.max(1,displayHeight-256)))});}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}><img src={photo.url} alt="Profile photo crop preview" draggable={false} style={{width:displayWidth,height:displayHeight,left:128-displayWidth/2-position.x*(displayWidth-256)/2,top:128-displayHeight/2-position.y*(displayHeight-256)/2}}/></div><div className="avatar-crop-controls"><label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} disabled={busy} onChange={event=>setZoom(Number(event.target.value))}/></label><label>Horizontal position<input type="range" min="-1" max="1" step=".02" value={position.x} disabled={busy} onChange={event=>setPosition({...position,x:Number(event.target.value)})}/></label><label>Vertical position<input type="range" min="-1" max="1" step=".02" value={position.y} disabled={busy} onChange={event=>setPosition({...position,y:Number(event.target.value)})}/></label></div>{busy&&<progress aria-label="Photo upload progress" max="100" value={progress??undefined}/>}<p className="avatar-status" role="status">{status}{busy&&progress!==null&&progress<100?` ${progress}%`:""}</p>{error&&<p className="avatar-error" role="alert">{error} Your crop is kept for retry.</p>}<footer><button type="button" className="ui-button" disabled={busy} onClick={close}>Cancel</button><button type="button" className="ui-button ui-primary" disabled={busy} onClick={()=>void upload()}>{busy&&<LoaderCircle size={16} aria-hidden="true"/>}{busy?"Saving photo…":error?"Retry upload":"Save photo"}</button></footer></dialog>}</div>;
}
