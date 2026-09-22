import * as THREE from './vendor/three/three.module.js';

// Artwork coordinates: width = 1, origin at the center, y points upwards.
export function artworkPoint(x,y,size){return new THREE.Vector3(x/size[0]-.5,(size[1]/2-y)/size[0],0);}
export function artworkToRegion(region,size){
  const [l,t,r,b]=region.crop,w=r-l;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((size[0]/2-(l+r)/2)/w,((t+b)/2-size[1]/2)/w,0),
    new THREE.Quaternion(),new THREE.Vector3(size[0]/w,size[0]/w,size[0]/w));
}
export function artworkPose(anchorMatrix,region,size){return anchorMatrix.clone().multiply(artworkToRegion(region,size));}

function parts(matrix){const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);return {p,q,s};}
export function compatiblePoses(a,b){
  const x=parts(a),y=parts(b),scale=Math.max(Math.abs(x.s.x),1e-6);
  return x.p.distanceTo(y.p)/scale<.065 && x.q.angleTo(y.q)<.35 && Math.abs(Math.log(Math.max(Math.abs(y.s.x),1e-6)/scale))<.22;
}

// There is exactly one rendered artwork root, irrespective of target count.
export class RegionMap {
  constructor(){
    this.root=new THREE.Group();this.root.matrixAutoUpdate=false;this.root.visible=false;
    this.activeId=null;this.switches=0;this.lastSeen=-Infinity;this.lastPose=null;
    this.transition=0;this.gain=0;
  }
  clear(){this.root.visible=false;this.activeId=null;this.lastSeen=-Infinity;this.lastPose=null;this.transition=0;this.gain=0;}
  update(candidates,now,dt){
    const ready=candidates.filter(c=>c.age>=.18&&c.matrix.elements.every(Number.isFinite));
    let chosen=ready.find(c=>c.id===this.activeId);
    if(chosen){
      // Retain the current reference unless another is clearly better and agrees.
      const better=ready.filter(c=>c.id!==chosen.id&&c.age>.4&&c.score>chosen.score+.25&&compatiblePoses(c.matrix,chosen.matrix)).sort((a,b)=>b.score-a.score)[0];
      if(better)chosen=better;
    }else{
      const recent=now-this.lastSeen<.7;
      chosen=ready.filter(c=>!recent||!this.lastPose||compatiblePoses(c.matrix,this.lastPose)||c.age>.75).sort((a,b)=>b.score-a.score)[0];
    }
    if(!chosen){this.root.visible=false;this.gain=0;return false;}
    const switching=chosen.id!==this.activeId;
    if(switching){
      if(this.activeId!==null)this.switches++;
      this.transition=this.root.visible&&compatiblePoses(this.root.matrix,chosen.matrix) ? .16 : 0;
      this.activeId=chosen.id;
    }
    if(this.transition>0){
      const a=parts(this.root.matrix),b=parts(chosen.matrix),weight=1-Math.exp(-dt/.045);
      a.p.lerp(b.p,weight);a.q.slerp(b.q,weight);a.s.lerp(b.s,weight);
      this.root.matrix.compose(a.p,a.q,a.s);this.transition=Math.max(0,this.transition-dt);
    }else this.root.matrix.copy(chosen.matrix);
    this.root.matrixWorldNeedsUpdate=true;this.root.visible=true;
    this.lastSeen=now;this.lastPose=chosen.matrix.clone();this.gain=Math.min(1,this.gain+dt/.16);
    return true;
  }
}
