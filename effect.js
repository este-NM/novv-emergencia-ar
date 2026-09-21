import * as THREE from 'three';
export const settings={formationSeconds:6,dwellSeconds:0.8};
export function createMaterial(being,base,preview=false){
return new THREE.ShaderMaterial({transparent:!preview,depthWrite:false,depthTest:false,toneMapped:false,
uniforms:{uBeing:{value:being},uBase:{value:base},uPreview:{value:preview?1:0},uProgress:{value:0},uTime:{value:0}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`precision highp float;varying vec2 vUv;uniform sampler2D uBeing,uBase;uniform float uPreview,uProgress,uTime;
void main(){
vec4 being=texture2D(uBeing,vUv);
// Local coordinates of the supplied figure inside the exact print crop.
vec2 p=(vec2(vUv.x,1.-vUv.y)-vec2(.3245,.194))/vec2(.296,.5536);
float brightness=dot(being.rgb,vec3(.2126,.7152,.0722));
// Uneven growth reveals the existing filaments before filling the body.
float strands=.5+.5*sin(p.y*32.+sin(p.x*22.)*2.4);
float growth=.12+.48*(1.-clamp(p.y,0.,1.))+.12*strands;
float filament=smoothstep(.08,.5,brightness);
float threshold=growth+.19*(1.-filament);
float reveal=smoothstep(threshold-.09,threshold+.09,uProgress);
reveal*=smoothstep(0.,.04,uProgress);
float frontier=exp(-pow((uProgress-threshold)/.055,2.));
float living=.5+.5*sin(p.y*12.-uTime*1.3+p.x*3.);
float settled=smoothstep(.9,1.,uProgress);
vec3 color=being.rgb*(1.+.12*living*settled)+vec3(.65,.4,.12)*frontier*.55;
float alpha=being.a*reveal;
if(uPreview>.5){gl_FragColor=vec4(mix(texture2D(uBase,vUv).rgb,color,alpha),1.);}
else{gl_FragColor=vec4(color,alpha);}
#include <colorspace_fragment>
}`});}
