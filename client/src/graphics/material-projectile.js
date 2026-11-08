// Small solid objects and emissive wakes. No storyboard glyphs, rule diagrams
// or symbols travel with the projectile.
export const drawMaterialProjectile = (c,p,recipe,sprite) => {
    if(!p.visible)return;
    const dx=p.x-p.px,dy=p.y-p.py;
    if(Math.hypot(dx,dy)>.001)p.travelAngle=Math.atan2(dy,dx);
    const angle=p.travelAngle??p.options.angle??0,size=p.options.small?2.6:4.5,color=p.color;
    c.save();
    if(recipe.projectile==='plasma'&&p.history.length>1){
        c.globalCompositeOperation='lighter';c.lineCap='round';
        for(const [width,alpha]of [[size*2,.16],[size*.6,.7]]){
            c.lineWidth=width;c.strokeStyle=color;c.globalAlpha=alpha;c.beginPath();
            p.history.forEach((point,i)=>i?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.stroke();
        }
    }
    c.translate(p.x,p.y);c.rotate(angle);c.globalAlpha=1;c.globalCompositeOperation='source-over';
    if(recipe.projectile==='plasma'){
        c.globalCompositeOperation='lighter';c.drawImage(sprite('light',color),-size*4,-size*4,size*8,size*8);
        c.fillStyle='#f4ffff';c.beginPath();c.ellipse(0,0,size*1.25,size*.55,0,0,Math.PI*2);c.fill();
    }else if(recipe.projectile==='liquid'){
        const g=c.createRadialGradient(-size*.4,-size*.4,0,0,0,size*1.5);g.addColorStop(0,'#edffc1');g.addColorStop(.35,color);g.addColorStop(1,'#355b13');
        c.fillStyle=g;c.beginPath();c.ellipse(0,0,size*1.5,size*.85,0,0,Math.PI*2);c.fill();
    }else if(recipe.projectile==='ice'){
        c.fillStyle='#b4eaff';c.beginPath();c.moveTo(size*2,0);c.lineTo(-size,-size*.8);c.lineTo(-size*1.4,size*.6);c.closePath();c.fill();
        c.fillStyle='#4c8cab';c.beginPath();c.moveTo(size*2,0);c.lineTo(-size*.2,0);c.lineTo(-size*1.4,size*.6);c.closePath();c.fill();
    }else if(recipe.projectile==='tracer'){
        c.fillStyle='#ffe7ad';c.fillRect(-size, -size*.25,size*2,size*.5);
    }else{
        const gradient=c.createLinearGradient(0,-size,0,size);gradient.addColorStop(0,'#dce6d6');gradient.addColorStop(.35,'#8da39a');gradient.addColorStop(1,'#253c43');
        c.fillStyle=gradient;c.beginPath();
        if(recipe.projectile==='grenade'){c.ellipse(0,0,size*1.2,size,0,0,Math.PI*2);}
        else{c.moveTo(size*1.8,0);c.lineTo(size*.65,-size*.65);c.lineTo(-size*1.3,-size*.65);c.lineTo(-size*1.3,size*.65);c.lineTo(size*.65,size*.65);c.closePath();}
        c.fill();c.fillStyle=color;c.fillRect(-size*.8,-size*.65,size*.3,size*1.3);
        if(recipe.projectile==='rocket'){
            c.fillStyle='#344c51';for(const side of [-1,1]){c.beginPath();c.moveTo(-size*.7,side*size*.5);c.lineTo(-size*1.7,side*size*1.2);c.lineTo(-size*1.3,0);c.fill();}
            c.globalCompositeOperation='lighter';c.drawImage(sprite('light','#ffac54'),-size*5,-size*1.8,size*5,size*3.6);
        }else if(recipe.projectile==='drill'){
            for(let i=0;i<3;i++){c.fillStyle=i%2?'#29414a':'#d4d4bd';c.beginPath();c.moveTo(size*(.2+i*.45),-size*(.7-i*.2));c.lineTo(size*(.45+i*.45),size*(.6-i*.18));c.lineTo(size*(.6+i*.45),size*(.45-i*.15));c.closePath();c.fill();}
        }
    }
    c.restore();
};
