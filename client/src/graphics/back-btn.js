export const drawBackBtn = (ctx, width, height) => {
    ctx.fillStyle='#152d36'; ctx.beginPath(); ctx.roundRect(12,25,width-24,height-50,7); ctx.fill();
    ctx.strokeStyle='#4b656c'; ctx.stroke(); ctx.fillStyle='#c3d4cb';
    ctx.font='16px Arial'; ctx.textAlign='center'; ctx.fillText('‹  BACK',width/2,height/2+6);
};
