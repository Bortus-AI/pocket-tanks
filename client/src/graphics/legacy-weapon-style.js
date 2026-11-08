// Match the presentation to the original delivery/effect family without importing
// the weapon registry (which would create a registry/Weapon/Blast cycle).
const inferLegacyWeaponStyle = (scene, blastType) => {
    const activeTank = scene.activeTank === 2 ? scene.tank2 : scene.tank1;
    const handler = activeTank?.turret?.activeWeapon?.weaponHandler;
    if (handler?.definition) {
        const definition = handler.definition;
        return {payload:definition.payload?.key || 'kinetic',behavior:definition.behavior,
            classicMechanic:definition.classicMechanic,color:definition.payload?.color};
    }
    const parsed = /^\d+$/.test(String(blastType)) ? Number(blastType) : Number(handler?.id);
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
    const tank=scene.activeTank===2?scene.tank2:scene.tank1,weapon=tank?.turret?.activeWeapon,handler=weapon?.weaponHandler;
    const definition=handler?.definition,style=inferLegacyWeaponStyle(scene,blastType);
    const parsed=/^\d+$/.test(String(blastType))?Number(blastType):undefined;
    const velocity=handler?.projectile?.body?.velocity;
    return {...style,weaponId:weapon?.id??handler?.id??definition?.id??parsed,weaponName:definition?.name||handler?.name,
        semanticRules:weapon?.mechanicalRules||definition?.mechanicalRules||[],mechanicOptions:definition?.options,
        angle:velocity&&Math.hypot(velocity.x,velocity.y)>0?Math.atan2(velocity.y,velocity.x):(tank?.turret?.rotation??Math.PI/2)-Math.PI/2};
};
