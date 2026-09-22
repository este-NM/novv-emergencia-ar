// Times in seconds; radius in screen short sides. Shared by preview and AR.
export const settings={formationSeconds:3.5,torsoSeconds:2.5,releaseSeconds:3,
  trailSeconds:7,focusRadius:.65,opacity:.85,pulseDepth:.065,pulseFrequency:.24};
const clamp=v=>Math.max(0,Math.min(1,v));
export function focusScore(x,y,focusX,focusY,shortSide){
 const t=clamp(Math.hypot(x-focusX,y-focusY)/(shortSide*settings.focusRadius));
 return 1-t*t*(3-2*t);
}
// Formation belongs to artwork coordinates, never to individual tracking regions.
export class ActivationField{
 constructor(width=160,height=113){this.width=width;this.height=height;this.values=new Float32Array(width*height);this.pixels=new Uint8Array(width*height*4);this.parent=0;this.torso=0;}
 reset(){this.values.fill(0);this.pixels.fill(0);this.parent=0;this.torso=0;}
 step(dt,held,global,scoreAt,pairScore){
  for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
   const i=y*this.width+x,score=held?(global?1:scoreAt((x+.5)/this.width,(y+.5)/this.height)):0;
   const velocity=score>.06?(.4+.6*score)/settings.formationSeconds:-1/(held?settings.trailSeconds:settings.releaseSeconds);
   this.values[i]=clamp(this.values[i]+dt*velocity);
   const b=Math.round(this.values[i]*255),offset=i*4;
   this.pixels[offset]=b;this.pixels[offset+1]=b;this.pixels[offset+2]=b;this.pixels[offset+3]=255;
  }
  if(held&&(global||pairScore>.15)){
   if(this.parent<1)this.parent=clamp(this.parent+dt/settings.formationSeconds);
   else this.torso=clamp(this.torso+dt/settings.torsoSeconds);
  }else{
   // Torso disappears before its supporting body.
   if(this.torso>0)this.torso=clamp(this.torso-dt/settings.releaseSeconds);
   else this.parent=clamp(this.parent-dt/settings.releaseSeconds);
  }
 }
}
export function wholeFits(points,width,height){
 if(points.some(p=>!p||!p.visible||p.x<width*.025||p.x>width*.975||p.y<height*.025||p.y>height*.975))return false;
 const spanX=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
 const spanY=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
 return Math.min(spanX,spanY)>Math.min(width,height)*.18;
}
