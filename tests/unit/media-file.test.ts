import {expect,it} from "vitest";
import {imageFileError} from "@/lib/media-file";
it("validates supported upload types, nonempty files and the 10 MB limit",()=>{
  expect(imageFileError({name:"photo.png",type:"image/png",size:100})).toBe("");
  expect(imageFileError({name:"photo.heic",type:"",size:100})).toBe("");
  expect(imageFileError({name:"photo.png",type:"image/png",size:0})).toMatch(/empty/);
  expect(imageFileError({name:"photo.png",type:"image/png",size:10*1024*1024+1})).toMatch(/10 MB/);
  expect(imageFileError({name:"photo.svg",type:"image/svg+xml",size:100})).toMatch(/JPEG/);
});
