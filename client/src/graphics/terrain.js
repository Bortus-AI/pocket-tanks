import { makeTerrainPath, TERRAIN_PROFILES, terrainProfile } from './terrain-layouts';

// Paint the terrain into the same alpha mask used by collision and craters.
// Everything is clipped to the playable ground so visual detail never changes
// the shape that the physics code sees.
export const setTerrain = (ctx, width, height, path, terrain) => {
    ctx.clearRect(0, 0, width, height);
    const profile = terrainProfile(path[0]?.profile || terrain?.layoutKind);
    if (terrain) terrain.layoutKind = profile.key;

    const groundPath = () => {
        ctx.beginPath();
        ctx.moveTo(-200, height);
        ctx.lineTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.lineTo(width + 200, height);
        ctx.closePath();
    };

    groundPath();
    const soil = ctx.createLinearGradient(0, 0, 0, height);
    soil.addColorStop(0, profile.soil[0]);
    soil.addColorStop(0.12, profile.soil[1]);
    soil.addColorStop(0.48, profile.soil[2]);
    soil.addColorStop(1, profile.soil[3]);
    ctx.fillStyle = soil;
    ctx.fill();

    // All surface detail stays inside the opaque collision silhouette.
    ctx.save(); groundPath(); ctx.clip();
    let seed = 92821;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // Rock seams follow the surface rather than the screen horizon.
    for (let band = 0; band < 12; band++) {
        ctx.beginPath();
        path.forEach((p, i) => {
            const y = p.y + 15 + band * 22 + Math.sin(p.x * .016 + band) * 9;
            if (i === 0) ctx.moveTo(p.x, y); else ctx.lineTo(p.x, y);
        });
        ctx.strokeStyle = band % 3 ? 'rgba(190,172,127,.06)' : 'rgba(8,24,28,.16)';
        ctx.lineWidth = band % 3 ? 2 : 5; ctx.stroke();
    }
    for (let i = 0; i < width * height / 130; i++) {
        const x = random() * width, y = random() * height, r = .4 + random() * 2;
        ctx.fillStyle = random() > .5 ? 'rgba(215,202,156,.07)' : 'rgba(8,22,25,.12)';
        ctx.beginPath(); ctx.ellipse(x, y, r * 2, r, -.3, 0, Math.PI * 2); ctx.fill();
    }
    // Broad moss and soil cap with a sunlit lip.
    ctx.beginPath(); path.forEach((p,i) => i ? ctx.lineTo(p.x,p.y+5) : ctx.moveTo(p.x,p.y+5));
    ctx.strokeStyle = profile.cap; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); path.forEach((p,i) => i ? ctx.lineTo(p.x,p.y+1) : ctx.moveTo(p.x,p.y+1));
    ctx.strokeStyle = profile.rim; ctx.lineWidth = 3; ctx.stroke();
    // Small stones and ground cover are paint, never extra collision geometry.
    for (let i = 1; i < path.length; i++) {
        const a = path[i-1], b = path[i];
        for (let t = 0; t < 1; t += .4) {
            if (random() > .3) continue;
            const x = a.x + (b.x-a.x)*t, y = a.y + (b.y-a.y)*t;
            ctx.fillStyle = random() > .5 ? '#8e9a76' : '#3c5144';
            ctx.beginPath(); ctx.ellipse(x,y+4,1+random()*3,1+random()*2,0,0,Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();

    if (terrain?.scene) terrain.scene.events.emit('terrain-finished');
};

/** @param {CanvasRenderingContext2D} ctx @param {Terrain} terrain */
export const drawTerrain = (ctx, width, height, terrain) => {
    const requested = terrain?.scene?.sceneData?.terrainKind || terrain?.scene?.registry?.get('terrainKind');
    const profile = requested && requested !== 'random' ? terrainProfile(requested) : TERRAIN_PROFILES[Math.floor(Math.random() * TERRAIN_PROFILES.length)];
    const path = makeTerrainPath(width, height, profile.key);
    if (terrain) terrain.layoutKind = profile.key;
    setTerrain(ctx, width, height, path, terrain);
    return path;
};

