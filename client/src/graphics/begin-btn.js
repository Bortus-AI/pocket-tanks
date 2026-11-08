/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawBeginBtn = (ctx, width, height, scene) => {
    ctx.fillStyle='#e7b17b'; ctx.beginPath(); ctx.roundRect(1,1,width-2,height-2,7); ctx.fill();
    ctx.fillStyle='#152d35'; ctx.textAlign='center'; ctx.font='bold 16px Arial';
    ctx.fillText('BEGIN GAME  →',width/2,height/2+6);

}


export const createBeginButton = (scene) => {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    canvas.height = 50 
    canvas.width = 160

    if (!scene.game.device.os.desktop) {
        canvas.height = canvas.height * 1.5
        canvas.width = canvas.width * 1.5
    }

    drawBeginBtn(ctx, canvas.width, canvas.height, scene)

    return canvas
}