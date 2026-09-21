import * as THREE from 'three';
import {createMaterial,settings} from './effect.js';
const $=id=>document.getElementById(id), materials=[];
let progress=0,playing=false,last=performance.now(),time=0,mindar=null,ar=false,starting=false,tracked=false,dwell=0;
const fail=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e);};
const phases=p=>p===0?'Trazos':p<.3?'Primeros filamentos':p<.75?'El cuerpo se forma':p<1?'La figura se reúne':'Ser presente';
function reflect(){ $('progress').value=progress*100;$('value').textContent=`${Math.round(progress*100)} %`;$('phase').textContent=phases(progress);$('play').textContent=playing?'Pausar':progress>=1?'Repetir formación':'Ver formación'; }
try{
 const loader=new THREE.TextureLoader();
 const [base,being]=await Promise.all(['sector.jpg','ser.png'].map(async name=>{const t=await loader.loadAsync('./assets/'+name);t.colorSpace=THREE.SRGBColorSpace;return t;}));
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$('preview').appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.5,.5,.625,-.625,.1,10);camera.position.z=1;
 const material=createMaterial(being,base,true);materials.push(material);scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1.25),material));
 const resize=()=>{const w=$('preview').clientWidth;if(w)renderer.setSize(w,w*1.25,false);};new ResizeObserver(resize).observe($('preview'));resize();
 function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;time+=dt;
  if(ar&&tracked){dwell+=dt;if(dwell>=settings.dwellSeconds&&playing)progress=Math.min(1,progress+dt/settings.formationSeconds);$('tracking').textContent=dwell<settings.dwellSeconds?'Sector encontrado · sostené el encuadre':phases(progress);}
  else if(!ar&&playing)progress=Math.min(1,progress+dt/settings.formationSeconds);
  if(progress>=1)playing=false;
  for(const m of materials){m.uniforms.uProgress.value=progress;m.uniforms.uTime.value=time;}
  reflect();if(ar)mindar.renderer.render(mindar.scene,mindar.camera);else renderer.render(scene,camera);
  requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
 $('start').disabled=false;$('status').textContent='Observá la formación o recorré sus etapas con el control.';
 $('play').onclick=()=>{if(progress>=1)progress=0;playing=!playing;};
 $('reset').onclick=()=>{progress=0;playing=false;reflect();};
 $('progress').oninput=e=>{progress=Number(e.target.value)/100;playing=false;reflect();};
 $('start').onclick=async()=>{
 if(starting||ar)return;starting=true;$('start').disabled=true;$('error').hidden=true;$('status').textContent='Preparando la cámara…';
 try{
 if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Abrí el enlace HTTPS en Safari para usar la cámara.');
 if(!mindar){
 const {MindARThree}=await import('./vendor/mindar/mindar-image-three.prod.js');$('ar').hidden=false;
 mindar=new MindARThree({container:$('ar'),imageTargetSrc:'./assets/target.mind',maxTrack:1,filterMinCF:.001,filterBeta:.01,warmupTolerance:5,missTolerance:7,uiLoading:'no',uiScanning:'no',uiError:'no'});
 mindar.renderer.setPixelRatio(Math.min(devicePixelRatio,2));mindar.renderer.outputColorSpace=THREE.SRGBColorSpace;mindar.renderer.setClearColor(0,0);
 const anchor=mindar.addAnchor(0),m=createMaterial(being,base,false);materials.push(m);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1.25),m);anchor.group.add(plane);
 anchor.onTargetFound=()=>{tracked=true;dwell=0;if(progress===0)playing=true;};
 anchor.onTargetLost=()=>{tracked=false;dwell=0;$('tracking').textContent='Volvé a encuadrar el sector derecho';};
 }
 $('ar').hidden=false;await mindar.start();ar=true;progress=0;playing=true;dwell=0;
 document.body.classList.add('ar-active');$('tracking').hidden=false;$('start').hidden=true;$('stop').hidden=false;
 $('status').textContent='Apuntá al sector derecho. Al reconocerlo, el ser comienza a formarse.';
 }catch(e){if(mindar){try{mindar.stop();}catch{}}$('ar').hidden=true;fail(e);$('status').textContent='Podés seguir explorando la vista previa.';}
 finally{starting=false;$('start').disabled=false;}
 };
 $('stop').onclick=()=>{mindar.stop();ar=false;tracked=false;playing=false;$('ar').hidden=true;$('tracking').hidden=true;$('start').hidden=false;$('stop').hidden=true;document.body.classList.remove('ar-active');resize();$('status').textContent='Vista previa del sector · repetí o recorré la formación.';};
}catch(e){fail(e);}
