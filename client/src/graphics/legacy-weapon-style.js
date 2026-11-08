// Match the presentation to the original delivery/effect family without importing
// the weapon registry (which would create a registry/Weapon/Blast cycle).
// blastType is the firing handler's id ("15", or "21.3" for sub-blasts).
export const sourceWeaponId = blastType => {
    const match = /^(\d+)(?:\.|$)/.exec(String(blastType ?? ''));
    return match ? Number(match[1]) : undefined;
};
// The active tank's weapon only describes this blast when it is the weapon
// that produced it; delayed blasts and mines may detonate on a later turn.
export const sourceWeapon = (scene, blastType) => {
    const tank = scene.activeTank === 2 ? scene.tank2 : scene.tank1, weapon = tank?.turret?.activeWeapon;
    const id = sourceWeaponId(blastType);
    if (!weapon) return {weapon:null, tank, id};
    const weaponId = weapon.id ?? weapon.weaponHandler?.id ?? weapon.weaponHandler?.definition?.id;
    return {weapon: id === undefined || weaponId === undefined || Number(weaponId) === id ? weapon : null, tank, id};
};
const inferLegacyWeaponStyle = (scene, blastType, weapon) => {
    const handler = weapon?.weaponHandler;
    if (handler?.definition) {
        const definition = handler.definition;
        return {payload:definition.payload?.key || 'kinetic',behavior:definition.behavior,
            classicMechanic:definition.classicMechanic,color:definition.payload?.color};
    }
    const parsed = sourceWeaponId(blastType) ?? Number(handler?.id);
    const styles = {
        7:{payload:'seismic',behavior:'crater'},
        8:{payload:'seismic',behavior:'trench'},
        12:{payload:'seismic',behavior:'wall'},
        13:{payload:'seismic',behavior:'berm'},
        14:{payload:'ion',behavior:'laser'},
        15:{payload:'fire',behavior:'napalm'},
        16:{payload:'frost',behavior:'hailstorm'},
        17:{payload:'seismic',behavior:'tunnel'},
        18:{payload:'seismic',behavior:'drill'},
        19:{payload:'seismic',behavior:'drill'},
        23:{payload:'fire',behavior:'carpet'},
        25:{payload:'seismic',behavior:'berm'},
        27:{payload:'seismic',behavior:'excavator'},
    };
    if (styles[parsed]) return styles[parsed];
    const name = `${handler?.name || ''} ${handler?.constructor?.name || ''}`.toLowerCase();
    if (/napalm|fire|flame|lava/.test(name)) return {payload:'fire',behavior:'napalm'};
    if (/laser|zapper|electric/.test(name)) return {payload:'ion',behavior:'laser'};
    if (/ice|hail|snow|freeze/.test(name)) return {payload:'frost',behavior:'hailstorm'};
    if (/dirt|ground|worm|mover/.test(name)) return {payload:'seismic',behavior:'excavator'};
    return {payload:'kinetic',behavior:'shell'};
};

export const legacyWeaponStyle = (scene,blastType) => {
    const {weapon,tank,id:parsed}=sourceWeapon(scene,blastType),handler=weapon?.weaponHandler;
    const definition=handler?.definition,style=inferLegacyWeaponStyle(scene,blastType,weapon);
    const velocity=handler?.projectile?.body?.velocity;
    return {...style,weaponId:weapon?.id??handler?.id??definition?.id??parsed,weaponName:definition?.name||handler?.name,
        semanticRules:weapon?.mechanicalRules||definition?.mechanicalRules||[],mechanicOptions:definition?.options,
        angle:velocity&&Math.hypot(velocity.x,velocity.y)>0?Math.atan2(velocity.y,velocity.x):weapon?(tank?.turret?.rotation??Math.PI/2)-Math.PI/2:-Math.PI/2};
};
