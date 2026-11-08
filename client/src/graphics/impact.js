import { emitWeaponImpact } from './weapon-fx';
// Compatibility entry point for effects that do not have an elemental payload.
export const addImpact = (scene,x,y,radius,options={}) => emitWeaponImpact(scene,x,y,radius,options);
