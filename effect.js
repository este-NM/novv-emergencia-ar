import * as THREE from 'three';
import {settings} from './attention.js?v=2';
export function createMaterial(being,seed=0){
return new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
uniforms:{uBeing:{value:being},uProgress:{value:0},uTime:{value:0},uPresence:{value:0},
 uOpacity:{value:settings.opacity},uPulseDepth:{value:settings.pulseDepth},uFrequency:{value:settings.pulseFrequency},uSeed:{value:seed}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uBeing;
uniform float uProgress,uTime,uPresence,uOpacity,uPulseDepth,uFrequency,uSeed;
void main(){
vec4 being=texture2D(uBeing,vUv);vec2 p=vec2(vUv.x,1.-vUv.y);
float brightness=dot(being.rgb,vec3(.2126,.7152,.0722));
float strands=.5+.5*sin(p.y*32.+sin(p.x*22.)*2.4);
float growth=.12+.48*(1.-p.y)+.12*strands;
float filament=smoothstep(.08,.5,brightness);
float threshold=growth+.19*(1.-filament);
float reveal=smoothstep(threshold-.09,threshold+.09,uProgress)*smoothstep(0.,.04,uProgress);
float frontier=exp(-pow((uProgress-threshold)/.055,2.));
// Continuous presence: no hard blinking and no displacement from the print.
float pulse=1.+uPulseDepth*(.78*sin(6.2831853*uFrequency*uTime+uSeed)+.22*sin(6.2831853*uFrequency*1.61*uTime+uSeed));
vec3 color=being.rgb+vec3(.28,.16,.035)*frontier*.28;
float alpha=being.a*reveal*uOpacity*uPresence*pulse;
gl_FragColor=vec4(color,clamp(alpha,0.,1.));
#include <colorspace_fragment>
}`});}
