import { z } from "zod";
export const cropSchema = z.object({ aspect:z.enum(["original","square","portrait","landscape"]), x:z.number().min(0).max(1), y:z.number().min(0).max(1) });
export type Crop = z.infer<typeof cropSchema>;
export function cropRegion(width:number,height:number,crop:Crop) {
  const ratio = {original:width/height,square:1,portrait:4/5,landscape:16/9}[crop.aspect];
  const w = Math.min(width,Math.floor(height*ratio));
  const h = Math.min(height,Math.floor(width/ratio));
  return { left:Math.round((width-w)*crop.x), top:Math.round((height-h)*crop.y), width:Math.max(1,w), height:Math.max(1,h) };
}
