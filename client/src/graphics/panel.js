export const drawPanel = (ctx, width, height, label, labelY = 22) => {
    const fill = ctx.createLinearGradient(0,0,0,height);
    fill.addColorStop(0,'#29454d'); fill.addColorStop(1,'#152d36');
    ctx.fillStyle=fill; ctx.beginPath(); ctx.roundRect(1,1,width-2,height-2,7); ctx.fill();
    ctx.strokeStyle='#47616a'; ctx.lineWidth=1; ctx.stroke();
    if(label) {
        ctx.fillStyle='#bdcec5'; ctx.font='600 13px Arial'; ctx.textAlign='center';
        ctx.fillText(label.toUpperCase(),width/2,labelY);
    }
};
