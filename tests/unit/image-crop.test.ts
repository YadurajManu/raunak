import {expect,it} from "vitest";
import {cropRegion,cropSchema} from "@/lib/image-crop";
it("crops without stretching and clamps position to the original image",()=>{
  expect(cropRegion(1600,900,{aspect:"square",x:1,y:.5})).toEqual({left:700,top:0,width:900,height:900});
  expect(cropRegion(900,1600,{aspect:"landscape",x:.5,y:1})).toEqual({left:0,top:1094,width:900,height:506});
  expect(cropRegion(900,1600,{aspect:"original",x:0,y:0})).toEqual({left:0,top:0,width:900,height:1600});
  expect(cropSchema.safeParse({aspect:"square",x:2,y:0}).success).toBe(false);
});
