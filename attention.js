// Shared timings and presence controls for preview and AR.
export const settings = {
  formationSeconds: 6, torsoSeconds: 3, dwellSeconds: 0.65,
  memorySeconds: 9, dissolveSeconds: 5, focusRadius: 0.40,
  opacity: 0.62, pulseDepth: 0.085, pulseFrequency: 0.24,
  secondaryPresence: 0.25,
};
export const clamp = (v, a=0, b=1) => Math.min(b,Math.max(a,v));
export function centrality(x,y,focusX,focusY,shortSide) {
  const d=Math.hypot(x-focusX,y-focusY)/Math.max(shortSide,1);
  const t=clamp(d/settings.focusRadius);
  return 1-t*t*(3-2*t);
}
export function newState(){return {progress:0,torso:0,dwell:0,away:0,presence:0};}
export function advance(state,score,dt,paired=false){
  if(score>0.48){
    state.away=0;state.dwell+=dt;
    if(state.dwell>=settings.dwellSeconds){
      if(state.progress<1)state.progress=clamp(state.progress+dt/settings.formationSeconds);
      else if(paired)state.torso=clamp(state.torso+dt/settings.torsoSeconds);
    }
  }else{
    state.dwell=Math.max(0,state.dwell-dt);state.away+=dt;
    if(state.away>settings.memorySeconds){
      // The supporting body stays until the torso has fully dissolved.
      if(state.torso>0)state.torso=clamp(state.torso-dt/settings.dissolveSeconds);
      else state.progress=clamp(state.progress-dt/settings.dissolveSeconds);
    }
  }
  const target=state.progress>0?settings.secondaryPresence+(1-settings.secondaryPresence)*score:0;
  state.presence+=(target-state.presence)*(1-Math.exp(-dt/0.8));
}
export function manualState(state,amount,paired){
  const duration=settings.formationSeconds+(paired?settings.torsoSeconds:0),seconds=clamp(amount)*duration;
  state.progress=clamp(seconds/settings.formationSeconds);
  state.torso=paired?clamp((seconds-settings.formationSeconds)/settings.torsoSeconds):0;
  state.presence=amount>0?1:0;state.away=0;
}
export function torsoVisibility(state){return state.progress>=1&&state.torso>0?state.presence:0;}
