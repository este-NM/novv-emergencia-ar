import * as THREE from 'three';
import {createMaterial} from './effect.js?v=2';
import {settings,centrality,newState,advance,manualState,torsoVisibility} from './attention.js?v=2';
const $=id=>document.getElementById(id);
const groups=[1,2,4].map(id=>({id,state:newState(),score:0,center:null}));
let selected=1,playing=true,manual=false,time=0,last=performance.now();
let mindar=null,anchor=null,ar=false,starting=false,tracked=false;
let gaze={x:.5,y:.5},previewMeshes=[],arMeshes=[];
const fail=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e);};
const groupOf=id=>groups.find(g=>g.id===(id===3?2:id));
function reset(){for(const g of groups)g.state=newState();manual=false;playing=true;}
function sequence(g){return (g.state.progress*settings.formationSeconds+g.state.torso*settings.torsoSeconds)/(settings.formationSeconds+(g.id===2?settings.torsoSeconds:0));}
function describe(g){const s=g.state;return s.progress===0?'En los trazos':s.progress<1?'Formándose':g.id===2&&s.torso<1?(s.torso>0?'2 presente · 3 formándose':'2 presente · sigue el torso'):'Presente';}
try{
 const response=await fetch('./assets/alignment.json?v=2');if(!response.ok)throw Error('Falta la configuración de posiciones.');const layout=await response.json();
 if(layout.version!==2)throw Error('Subí también assets/alignment.json actualizado.');
 const [left,top,right,bottom]=layout.crop,cw=right-left,ch=bottom-top,ratio=ch/cw;
 const loader=new THREE.TextureLoader();
 async function texture(file){const t=await loader.loadAsync('./assets/'+file+'?v=2');t.colorSpace=THREE.SRGBColorSpace;return t;}
 const [base,...textures]=await Promise.all([texture('sector.jpg'),...layout.figures.map(f=>texture(f.file))]);
 const figures=layout.figures.map((f,i)=>({...f,texture:textures[i]}));
 const centerOf=b=>new THREE.Vector3(((b[0]+b[2])/2-left)/cw-.5,ratio/2-((b[1]+b[3])/2-top)/cw,0);
 for(const g of groups){const b=figures.filter(f=>f.id===g.id||f.dependsOn===g.id).map(f=>f.bounds);g.center=centerOf([Math.min(...b.map(v=>v[0])),Math.min(...b.map(v=>v[1])),Math.max(...b.map(v=>v[2])),Math.max(...b.map(v=>v[3]))]);}
 $('preview').style.aspectRatio=`1 / ${ratio}`;
 const region=document.querySelector('.region');Object.assign(region.style,{left:`${left/layout.originalSize[0]*100}%`,top:`${top/layout.originalSize[1]*100}%`,width:`${cw/layout.originalSize[0]*100}%`,height:`${ch/layout.originalSize[1]*100}%`});
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$('preview').prepend(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.5,.5,ratio/2,-ratio/2,.1,10);camera.position.z=1;
 scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1,ratio),new THREE.MeshBasicMaterial({map:base,toneMapped:false})));
 function addFigures(parent){return figures.map(f=>{const b=f.bounds,material=createMaterial(f.texture,(f.dependsOn||f.id)*1.7),mesh=new THREE.Mesh(new THREE.PlaneGeometry((b[2]-b[0])/cw,(b[3]-b[1])/cw),material);mesh.position.copy(centerOf(b));mesh.renderOrder=f.id;parent.add(mesh);return {id:f.id,mesh,material};});}
 previewMeshes=addFigures(scene);
 const resize=()=>{const w=$('preview').clientWidth;if(w)renderer.setSize(w,w*ratio,false);};new ResizeObserver(resize).observe($('preview'));resize();
 function select(id){selected=id;const p=groupOf(id).center;gaze={x:p.x+.5,y:.5-p.y/ratio};manual=false;playing=true;}
 select(1);
 $('preview').addEventListener('pointermove',e=>{if(ar)return;const r=$('preview').getBoundingClientRect();gaze={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};manual=false;});
 $('preview').addEventListener('pointerdown',e=>{const r=$('preview').getBoundingClientRect();gaze={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};manual=false;playing=true;});
 document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>select(Number(b.dataset.group)));
 function scores(){
  if(ar){
   if(!tracked){for(const g of groups)g.score=0;return;}
   anchor.group.updateWorldMatrix(true,true);mindar.camera.updateMatrixWorld();
   const bounds=mindar.renderer.domElement.getBoundingClientRect(),short=Math.min(innerWidth,innerHeight);
   for(const g of groups){const p=anchor.group.localToWorld(g.center.clone()).project(mindar.camera);const x=bounds.left+(p.x+1)*bounds.width/2,y=bounds.top+(1-p.y)*bounds.height/2;
    g.score=p.z>=-1&&p.z<=1&&x>=0&&x<=innerWidth&&y>=0&&y<=innerHeight?centrality(x,y,innerWidth/2,innerHeight/2,short):0;
   }
  }else{const r=$('preview').getBoundingClientRect();for(const g of groups)g.score=centrality((g.center.x+.5)*r.width,(.5-g.center.y/ratio)*r.height,gaze.x*r.width,gaze.y*r.height,Math.min(r.width,r.height));}
 }
 function apply(meshes){for(const f of meshes){const s=groupOf(f.id).state,u=f.material.uniforms;u.uProgress.value=f.id===3?s.torso:s.progress;u.uPresence.value=f.id===3?torsoVisibility(s):s.presence;u.uTime.value=time;}}
 function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;time+=dt;scores();
  if(!manual){const dominant=groups.reduce((a,b)=>a.score>b.score?a:b);if(dominant.score>.48)selected=dominant.id;}
  if(playing&&!manual&&(!ar||tracked))for(const g of groups)advance(g.state,g.score,dt,g.id===2);
  apply(previewMeshes);apply(arMeshes);
  const active=groupOf(selected);$('progress').value=sequence(active)*100;$('value').textContent=`${Math.round(sequence(active)*100)} %`;
  $('phase').textContent=`${selected===2?'Seres 2 + 3':'Ser '+selected} · ${describe(active)}`;
  $('play').textContent=playing&&!manual?'Pausar recorrido':'Continuar recorrido';
  document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.group)===selected)));
  for(const g of groups)$('state-'+g.id).textContent=describe(g);
  $('focus').style.left=`${gaze.x*100}%`;$('focus').style.top=`${gaze.y*100}%`;
  if(ar){$('tracking').textContent=tracked?`Centro del encuadre · ${selected===2?'2 + 3':'ser '+selected}`:'Buscando el sector derecho…';mindar.renderer.render(mindar.scene,mindar.camera);}else renderer.render(scene,camera);
  requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
 $('start').disabled=false;$('status').textContent='Pasá el cursor o tocá una figura y detenete: la atención hace que emerja. El torso 3 acompaña siempre al 2.';
 $('play').onclick=()=>{if(manual){manual=false;playing=true;}else playing=!playing;};
 $('reset').onclick=reset;
 $('progress').oninput=e=>{manual=true;playing=false;manualState(groupOf(selected).state,Number(e.target.value)/100,selected===2);};
 $('start').onclick=async()=>{
  if(starting||ar)return;starting=true;$('start').disabled=true;$('error').hidden=true;$('status').textContent='Preparando la cámara…';
  try{
   if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Abrí el enlace HTTPS en Safari para usar la cámara.');
   if(!mindar){const {MindARThree}=await import('./vendor/mindar/mindar-image-three.prod.js');$('ar').hidden=false;
    mindar=new MindARThree({container:$('ar'),imageTargetSrc:'./assets/target.mind?v=2',maxTrack:1,filterMinCF:.001,filterBeta:.01,warmupTolerance:5,missTolerance:7,uiLoading:'no',uiScanning:'no',uiError:'no'});
    mindar.renderer.setPixelRatio(Math.min(devicePixelRatio,2));mindar.renderer.outputColorSpace=THREE.SRGBColorSpace;mindar.renderer.setClearColor(0,0);
    anchor=mindar.addAnchor(0);arMeshes=addFigures(anchor.group);
    anchor.onTargetFound=()=>{tracked=true;for(const g of groups)g.state.dwell=0;};
    anchor.onTargetLost=()=>{tracked=false;for(const g of groups)g.state.dwell=0;};
   }
   $('ar').hidden=false;await mindar.start();ar=true;reset();document.body.classList.add('ar-active');$('tracking').hidden=false;$('start').hidden=true;$('stop').hidden=false;
   $('status').textContent='Centrás un ser y emerge. El 3 se incorpora después del 2. Los demás conservan una presencia tenue.';
  }catch(e){if(mindar){try{mindar.stop();}catch{}}$('ar').hidden=true;fail(e);$('status').textContent='La vista previa sigue disponible.';}
  finally{starting=false;$('start').disabled=false;}
 };
 $('stop').onclick=()=>{mindar.stop();ar=false;tracked=false;playing=false;$('ar').hidden=true;$('tracking').hidden=true;$('start').hidden=false;$('stop').hidden=true;document.body.classList.remove('ar-active');resize();$('status').textContent='Vista previa · podés continuar el recorrido o explorar la formación manualmente.';};
}catch(e){fail(e);}
