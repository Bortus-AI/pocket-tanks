import { BattlefieldAtmosphere } from './battlefield-atmosphere';

// Deterministic scenery, painted once. It never participates in terrain collision.
export const drawBattlefield = (ctx, width, height, {section = 'all', ridge = null} = {}) => {
    if (section !== 'ridges') {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#132b3c');
        sky.addColorStop(0.32, '#54787f');
        sky.addColorStop(0.65, '#d6bc93');
        sky.addColorStop(1, '#e8b77e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(width * .76, height * .28, 0, width * .76, height * .28, width * .4);
        glow.addColorStop(0, 'rgba(255,229,172,.48)');
        glow.addColorStop(1, 'rgba(255,222,160,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffe5b5';
        ctx.beginPath(); ctx.arc(width * .76, height * .28, 25, 0, Math.PI * 2); ctx.fill();
        // Long translucent cloud banks.
        for (let i = 0; i < 14; i++) {
            ctx.fillStyle = `rgba(245,228,201,${.015 + (i % 3) * .012})`;
            ctx.beginPath();
            ctx.ellipse((i * 317 % 1400) / 1400 * width, height * (.08 + (i % 5) * .055), width * .22, 5 + i % 4 * 3, -.025, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    if (section !== 'sky') for (let layer = 0; layer < 4; layer++) {
        if (ridge !== null && ridge !== layer) continue;
        const base = height * (.36 + layer * .1);
        const points = [];
        for (let x = -40; x <= width + 40; x += 28) {
            const y = base + Math.sin(x * .006 + layer * 2) * height * .065
                + Math.sin(x * .017 + layer) * height * .042 + Math.sin(x * .039) * 9;
            points.push({x, y});
        }
        ctx.beginPath(); ctx.moveTo(-40, height);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(width + 40, height); ctx.closePath();
        ctx.fillStyle = ['#899a96', '#617f80', '#3c626a', '#244750'][layer]; ctx.fill();
        // Shadowed facets give ridges volume.
        for (let i = 2; i < points.length - 2; i += 3) {
            const p = points[i];
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 90, base + height * .2);
            ctx.lineTo(points[i + 2].x, points[i + 2].y); ctx.closePath();
            ctx.fillStyle = 'rgba(12,35,44,.14)'; ctx.fill();
        }
        if (layer === 3) {
            points.forEach((p, i) => {
                for (let j = 0; j < 3; j++) {
                    const x = p.x + j * 10, y = p.y + 6;
                    const h = 10 + ((i * 7 + j * 11) % 19);
                    ctx.fillStyle = '#21454b';
                    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - h * .28, y); ctx.lineTo(x + h * .28, y); ctx.fill();
                }
            });
        }
    }
    if (section === 'all') {
        const vignette = ctx.createRadialGradient(width / 2, height * .35, width * .22, width / 2, height * .4, width * .72);
        vignette.addColorStop(0, 'rgba(6,18,27,0)'); vignette.addColorStop(1, 'rgba(6,18,27,.5)');
        ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    }
};

export const addBattlefield = (scene, key = 'landscape') => {
    const canvas = document.createElement('canvas');
    canvas.width = scene.renderer.width; canvas.height = scene.renderer.height;
    const animated = scene.sys.settings.key === 'main-scene';
    drawBattlefield(canvas.getContext('2d'), canvas.width, canvas.height, {section:animated ? 'sky' : 'all'});
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.addCanvas(key, canvas);
    scene.add.image(canvas.width / 2, canvas.height / 2, key).setDepth(-10);
    if (animated) scene.atmosphere = new BattlefieldAtmosphere(scene, drawBattlefield);
    return texture;
};
