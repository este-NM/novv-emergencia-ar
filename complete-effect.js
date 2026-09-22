import * as THREE from 'three';
import {settings} from './activation.js?v=4';
export function createMaterial(being,field,figures,size){
 const box=id=>{const b=figures.find(f=>f.id===id).bounds;return new THREE.Vector4(b[0]/size[0],b[1]/size[1],b[2]/size[0],b[3]/size[1]);};
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
 uniforms:{uBeing:{value:being},uField:{value:field},uTime:{value:0},uGain:{value:1},uParent:{value:0},uTorso:{value:0},uBodyBox:{value:box(2)},uTorsoBox:{value:box(3)},uOpacity:{value:settings.opacity},uPulseDepth:{value:settings.pulseDepth},uFrequency:{value:settings.pulseFrequency}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uBeing,uField;
 uniform float uTime,uGain,uParent,uTorso,uOpacity,uPulseDepth,uFrequency;uniform vec4 uBodyBox,uTorsoBox;
 bool inside(vec2 p,vec4 b){return p.x>=b.x&&p.x<=b.z&&p.y>=b.y&&p.y<=b.w;}
 void main(){
 vec4 being=texture2D(uBeing,vUv);if(being.a<.001)discard;
 vec2 p=vec2(vUv.x,1.-vUv.y);
 float progress=texture2D(uField,p).r;
 // Known 2/3 areas use the source's original coordinates. No duplicate overlays.
 if(inside(p,uBodyBox))progress=uParent;
 if(inside(p,uTorsoBox))progress=uParent>=.999?uTorso:0.;
 float luminance=dot(being.rgb,vec3(.2126,.7152,.0722));
 float strands=.5+.5*sin(p.y*145.+sin(p.x*160.)*2.4);
 float threshold=.10+.40*(1.-p.y)+.16*strands+.14*(1.-smoothstep(.04,.6,luminance));
 float reveal=smoothstep(threshold-.12,threshold+.12,progress)*smoothstep(0.,.04,progress);
 float frontier=exp(-pow((progress-threshold)/.055,2.))*smoothstep(0.,.05,progress);
 float phase=p.x*17.+p.y*23.;
 float pulse=1.+uPulseDepth*(.78*sin(6.2831853*uFrequency*uTime+phase)+.22*sin(6.2831853*uFrequency*1.61*uTime+phase));
 vec3 color=being.rgb+vec3(.32,.22,.09)*frontier*.7;
 gl_FragColor=vec4(color,clamp(being.a*reveal*uOpacity*uGain*pulse,0.,1.));
 #include <colorspace_fragment>
 }`});
}
