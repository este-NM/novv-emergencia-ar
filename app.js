import * as THREE from 'three';
import {createMaterial} from './complete-effect.js?v=4';
import {ActivationField,focusScore,wholeFits} from './activation.js?v=4';
import {RegionMap,artworkPoint,artworkPose} from './region-map.js?v=3';
const $=id=>document.getElementById(id),regionMap=new RegionMap(),anchors=[];
let mindar=null,ar=false,starting=false,tracked=false,held=false,pressId=null;
let time=0,last=performance.now(),lostSince=0,wideTime=0,globalMode=false;
let gaze={x:.5,y:.5};
const fail=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e);};
function release(){held=false;pressId=null;document.body.classList.remove('holding');}
window.addEventListener('pointerup',release);
window.addEventListener('pointercancel',release);
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
try{
 const response=await fetch('./assets/atlas.json?v=4');if(!response.ok)throw Error('Falta assets/atlas.json. Subí el paquete completo.');
 const layout=await response.json();if(layout.version!==4)throw Error('Actualizá también assets/atlas.json y atlas.mind.');
 const [cw,ch]=layout.originalSize,ratio=ch/cw,loader=new THREE.TextureLoader();
 async function texture(file){const t=await loader.loadAsync('./assets/'+file+'?v=4');t.colorSpace=THREE.SRGBColorSpace;return t;}
 const [base,overlay]=await Promise.all([texture('overview.jpg'),texture(layout.overlay.file)]);
 const field=new ActivationField(160,Math.round(160*ratio));
 const fieldTexture=new THREE.DataTexture(field.pixels,field.width,field.height,THREE.RGBAFormat);
 fieldTexture.magFilter=THREE.LinearFilter;fieldTexture.minFilter=THREE.LinearFilter;fieldTexture.needsUpdate=true;
 const material=createMaterial(overlay,fieldTexture,layout.figures,layout.originalSize);
 const geometry=new THREE.PlaneGeometry(1,ratio);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 $('preview').prepend(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.5,.5,ratio/2,-ratio/2,.1,10);camera.position.z=1;
 // The printed base exists ONLY in desktop preview, never in the AR scene.
 scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:base,toneMapped:false})));
 const previewMesh=new THREE.Mesh(geometry,material);previewMesh.renderOrder=1;scene.add(previewMesh);
 let zoom=1,viewX=0,viewY=0;
 function view(){const half=.54/zoom;camera.left=viewX-half;camera.right=viewX+half;camera.top=viewY+half*ratio;camera.bottom=viewY-half*ratio;camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 const resize=()=>{const w=$('preview').clientWidth;if(w)renderer.setSize(w,w*ratio,false);};
 $('preview').style.aspectRatio=`1 / ${ratio}`;new ResizeObserver(resize).observe($('preview'));view();
 $('overview').onclick=()=>{zoom=1;viewX=0;viewY=0;view();};
 $('detail').onclick=()=>{zoom=4;viewX=.245;viewY=.20;view();};
 $('reset').onclick=()=>{release();field.reset();fieldTexture.needsUpdate=true;};
 const point=e=>{const r=$('preview').getBoundingClientRect();gaze={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 function down(e){if(e.button!==0||pressId!==null||(ar&&!tracked))return;e.preventDefault();pressId=e.pointerId;held=true;document.body.classList.add('holding');e.currentTarget.setPointerCapture(e.pointerId);if(!ar)point(e);}
 for(const surface of [$('preview'),$('ar')]){surface.addEventListener('pointerdown',down);surface.addEventListener('lostpointercapture',release);surface.addEventListener('contextmenu',e=>e.preventDefault());}
 $('preview').addEventListener('pointermove',e=>{if(!ar)point(e);});
 $('preview').addEventListener('wheel',e=>{
  e.preventDefault();point(e);const previous=zoom;zoom=Math.max(1,Math.min(10,zoom*Math.exp(-e.deltaY*.002)));
  viewX+=(gaze.x-.5)*1.08*(1/previous-1/zoom);viewY-=(gaze.y-.5)*1.08*ratio*(1/previous-1/zoom);
  if(zoom===1){viewX=0;viewY=0;}view();
 },{passive:false});
 function trackMap(now,dt){
  mindar.camera.updateMatrixWorld();const candidates=[];
  for(const item of anchors){if(!item.anchor.visible)continue;item.anchor.group.updateWorldMatrix(true,false);
   const p=new THREE.Vector3().setFromMatrixPosition(item.anchor.group.matrixWorld).project(mindar.camera);if(p.z<-1||p.z>1)continue;
   candidates.push({id:item.region.id,age:now-item.foundAt,score:1/(1+Math.hypot(p.x,p.y))+(item.region.kind==='detail'?.08:0),matrix:artworkPose(item.anchor.group.matrixWorld,item.region,layout.originalSize)});
  }
  const was=tracked;tracked=regionMap.update(candidates,now,dt);
  if(was&&!tracked){lostSince=now;release();}
  $('tracking').hidden=tracked||now-lostSince<.8;
 }
 const matrix=new THREE.Matrix4(),identity=new THREE.Matrix4();
 function projection(){
  const cam=ar?mindar.camera:camera;cam.updateMatrixWorld();
  if(ar)regionMap.root.updateWorldMatrix(true,false);
  matrix.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).multiply(ar?regionMap.root.matrixWorld:identity);
  const rect=(ar?mindar.renderer:renderer).domElement.getBoundingClientRect();
  const width=ar?innerWidth:rect.width,height=ar?innerHeight:rect.height;
  const offsetX=ar?rect.left:0,offsetY=ar?rect.top:0,e=matrix.elements;
  return {width,height,project(u,v){
   const x=u-.5,y=(.5-v)*ratio,w=e[3]*x+e[7]*y+e[15];
   const z=(e[2]*x+e[6]*y+e[14])/w;
   return {x:offsetX+((e[0]*x+e[4]*y+e[12])/w+1)*rect.width/2,
    y:offsetY+(1-(e[1]*x+e[5]*y+e[13])/w)*rect.height/2,visible:w>0&&z>=-1&&z<=1};
  }};
 }
 const pairCenters=layout.figures.filter(f=>f.id===2||f.id===3).map(f=>[(f.bounds[0]+f.bounds[2])/(2*cw),(f.bounds[1]+f.bounds[3])/(2*ch)]);
 function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;time+=dt;if(ar)trackMap(now/1000,dt);
  const pr=projection(),canSee=!ar||tracked;
  const fits=canSee&&wholeFits([[0,0],[1,0],[0,1],[1,1]].map(p=>pr.project(...p)),pr.width,pr.height);
  wideTime=fits?Math.min(.4,wideTime+dt):Math.max(0,wideTime-dt*2);globalMode=fits&&wideTime>=.3;
  const scoreAt=(u,v)=>{const p=pr.project(u,v);return !p.visible||p.x<0||p.x>pr.width||p.y<0||p.y>pr.height?0:focusScore(p.x,p.y,(ar?.5:gaze.x)*pr.width,(ar?.5:gaze.y)*pr.height,Math.min(pr.width,pr.height));};
  field.step(dt,held&&canSee,globalMode,scoreAt,Math.max(...pairCenters.map(p=>scoreAt(...p))));fieldTexture.needsUpdate=true;
  const uniforms=material.uniforms;uniforms.uTime.value=time;uniforms.uParent.value=field.parent;uniforms.uTorso.value=field.torso;uniforms.uGain.value=ar?regionMap.gain:1;
  $('phase').textContent=held?(globalMode?'Formación de la obra completa':'Formación en la zona de atención'):'Mantené presionado para hacer emerger';
  $('focus').style.left=`${gaze.x*100}%`;$('focus').style.top=`${gaze.y*100}%`;
  if(ar)mindar.renderer.render(mindar.scene,mindar.camera);else renderer.render(scene,camera);
  requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
 $('start').disabled=false;$('status').textContent='Mantené presionada la pantalla y recorré el print. Al encuadrarlo completo, la presión activa toda la obra.';
 $('start').onclick=async()=>{
  if(starting||ar)return;starting=true;release();$('start').disabled=true;$('error').hidden=true;
  try{
   if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Abrí el enlace HTTPS en Safari para usar la cámara.');
   if(!mindar){const {MindARThree}=await import('./vendor/mindar/mindar-image-three.prod.js');$('ar').hidden=false;
    mindar=new MindARThree({container:$('ar'),imageTargetSrc:'./assets/atlas.mind?v=4',maxTrack:2,filterMinCF:.001,filterBeta:.01,warmupTolerance:5,missTolerance:7,uiLoading:'no',uiScanning:'no',uiError:'no'});
    mindar.renderer.setPixelRatio(Math.min(devicePixelRatio,2));mindar.renderer.outputColorSpace=THREE.SRGBColorSpace;mindar.renderer.setClearColor(0,0);
    mindar.scene.add(regionMap.root);const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;regionMap.root.add(mesh);
    for(const region of layout.regions){const item={region,anchor:mindar.addAnchor(region.index),foundAt:0};item.anchor.onTargetFound=()=>{item.foundAt=performance.now()/1000;};anchors.push(item);}
   }
   $('ar').hidden=false;await mindar.start();ar=true;field.reset();regionMap.clear();lostSince=performance.now()/1000;wideTime=0;
   document.body.classList.add('ar-active');$('tracking').hidden=false;$('stop').hidden=false;
  }catch(e){if(mindar){try{mindar.stop();}catch{}}$('ar').hidden=true;fail(e);}
  finally{starting=false;$('start').disabled=false;}
 };
 $('stop').onclick=()=>{release();mindar.stop();ar=false;tracked=false;field.reset();regionMap.clear();$('ar').hidden=true;$('tracking').hidden=true;$('stop').hidden=true;document.body.classList.remove('ar-active');resize();};
}catch(e){fail(e);}
