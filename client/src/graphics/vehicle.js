// Shared vector artwork: crisp at menu scale and at the original gameplay size.
export const drawVehicle = (ctx, color = '#78a899', barrel = false) => {
    const polygon = (points, fill, stroke = '#142a2e') => {
        ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = .45; ctx.stroke();
    };
    ctx.fillStyle = 'rgba(5,15,18,.4)';
    ctx.beginPath(); ctx.ellipse(18,22,18,2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#15282c'; ctx.beginPath(); ctx.roundRect(1,14,34,8,3.7); ctx.fill();
    ctx.strokeStyle = '#748b88'; ctx.lineWidth = .65; ctx.stroke();
    for (let i = 0; i < 6; i++) {
        const x = 5 + i * 5.2;
        const wheel = ctx.createRadialGradient(x-.5,17,0,x,18,3);
        wheel.addColorStop(0,'#9daea1'); wheel.addColorStop(.4,'#4e6460'); wheel.addColorStop(1,'#1d3032');
        ctx.fillStyle = wheel; ctx.beginPath(); ctx.arc(x,18,2.8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#243c3e'; ctx.beginPath(); ctx.arc(x,18,.8,0,Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 16; i++) {
        ctx.fillStyle = '#91a49a'; ctx.fillRect(3+i*2,14,.65,.65); ctx.fillRect(3+i*2,21,.65,.65);
    }
    const armor = ctx.createLinearGradient(0,6,0,17);
    armor.addColorStop(0,'#b7c6ac'); armor.addColorStop(.22,color); armor.addColorStop(1,'#294b4b');
    polygon([[2,13],[7,9],[26,9],[34,13],[32,16],[4,16]],armor);
    polygon([[4,12],[9,9],[25,9],[31,12]],'#8bafa0');
    polygon([[5,13],[31,13],[29,16],[7,16]],color);
    for (let i=0;i<5;i++) polygon([[7+i*4.5,13],[11+i*4.5,13],[10.5+i*4.5,15.5],[7+i*4.5,15.5]],color);
    polygon([[11,10],[12,6],[16,4.5],[24,5],[28,9],[25,11]],armor);
    polygon([[13,6],[17,4],[23,4.5],[25,6]],'#aabda8');
    ctx.fillStyle = '#203e44'; ctx.fillRect(17,5.5,3,.9);
    ctx.fillStyle = '#6ae2d4'; ctx.fillRect(17.2,5.5,1.2,.55);
    ctx.fillStyle = '#1b383c'; ctx.fillRect(11,7,2,2);
    ctx.fillStyle = '#f8cd88'; ctx.fillRect(31,12,1.5,.8);
    ctx.fillStyle = '#ea885d'; ctx.fillRect(3,13,1,.7);
    ctx.strokeStyle = '#79988d'; ctx.lineWidth = .35;
    ctx.beginPath(); ctx.moveTo(13,5); ctx.lineTo(11,0); ctx.stroke();
    ctx.fillStyle = '#e4e3bf'; ctx.font = 'bold 2.2px sans-serif'; ctx.fillText('07',22,9);
    if (barrel) {
        polygon([[25,7],[40,2.5],[40.5,4],[25,9]],'#7c9f94');
        polygon([[38,2.8],[42,1.5],[42.5,3.5],[39,4.5]],'#314f52');
    }
};
