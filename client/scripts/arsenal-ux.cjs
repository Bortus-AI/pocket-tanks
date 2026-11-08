module.exports = async function checkArsenalUX(page, catalog) {
    const assert=require('node:assert/strict');
    await page.evaluate(()=>{
        const scene=window.game.scene.getScene('main-scene');scene.physics.world.pause();
        scene.activeTank=1;scene.tank1.active=true;scene.tank2.active=false;scene.tank1.turret.activeWeapon=null;scene.tank2.turret.activeWeapon=null;
        scene.tank1.weapons=scene.arsenal.catalog.map(w=>({id:w.id,name:w.name,type:w.type}));scene.tank1.selectedWeapon=0;scene.HUD.reset();
    });
    const coords=async selected=>page.evaluate(selected=>{
        const scene=window.game.scene.getScene('main-scene'),list=scene.HUD.weaponScrollDisplay,canvas=scene.game.canvas.getBoundingClientRect();
        const position=selected?list.selectedDisplay.getWorldTransformMatrix():{tx:list.x,ty:list.y};
        return {x:canvas.x+position.tx*canvas.width/scene.renderer.width,y:canvas.y+position.ty*canvas.height/scene.renderer.height,tile:list.tileHeight*canvas.height/scene.renderer.height};
    },selected);
    const open=await coords(true);await page.mouse.click(open.x,open.y);
    await page.waitForFunction(()=>window.game.scene.getScene('main-scene').HUD.weaponScrollDisplay.visible);
    const center=await coords(false);await page.mouse.click(center.x,center.y+center.tile);
    assert.equal(await page.evaluate(()=>window.game.scene.getScene('main-scene').tank1.selectedWeapon),1,'click did not select visible inventory row');
    assert.equal(await page.evaluate(()=>window.game.scene.getScene('main-scene').HUD.weaponScrollDisplay.visible),false);
    await page.mouse.click(open.x,open.y);await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>window.game.scene.getScene('main-scene').HUD.weaponScrollDisplay.offset>100);
    const wheelOffset=await page.evaluate(()=>window.game.scene.getScene('main-scene').HUD.weaponScrollDisplay.offset);
    await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x,center.y-center.tile,{steps:5});await page.mouse.up();
    const drag=await page.evaluate(()=>{const list=window.game.scene.getScene('main-scene').HUD.weaponScrollDisplay;return {visible:list.visible,offset:list.offset,index:Math.round(list.offset/list.tileHeight)};});
    assert.ok(drag.visible&&drag.offset>wheelOffset,'drag did not scroll pooled rows');
    await page.mouse.click(center.x,center.y);
    assert.equal(await page.evaluate(()=>window.game.scene.getScene('main-scene').tank1.selectedWeapon),drag.index,'scrolled click picked wrong inventory index');
    const resources=await page.evaluate(()=>{
        const scene=window.game.scene.getScene('main-scene'),list=scene.HUD.weaponScrollDisplay;
        const before={children:scene.children.list.length,textures:Object.keys(scene.textures.list).length,rows:list.rows.length};
        for(let i=0;i<50;i++)list.reset(scene.tank1);
        return {before,after:{children:scene.children.list.length,textures:Object.keys(scene.textures.list).length,rows:list.rows.length}};
    });
    assert.deepEqual(resources.after,resources.before,'repeated reset grew scene objects or textures');assert.ok(resources.after.rows<15,'inventory is not virtualized');
    await page.keyboard.press('b');
    await page.locator('.arsenal').waitFor({state:'visible'});
    const input=page.getByRole('textbox',{name:'Search weapons'});
    await input.fill('');await input.pressSequentially('oil slick');assert.equal(await input.inputValue(),'oil slick','game hotkeys swallowed search spaces');
    await input.press('Space');assert.equal(await input.inputValue(),'oil slick ','game fire shortcut swallowed space');
    await input.press('ArrowLeft');
    assert.equal(await page.evaluate(()=>!!window.game.scene.getScene('main-scene').tank1.turret.activeWeapon),false,'search keys fired a weapon');
    await input.fill('');
    const collection=page.getByRole('combobox',{name:'Weapon collection'});
    const collectionCounts={};
    for(const value of ['base','classic','new']){await collection.selectOption(value);collectionCounts[value]=await page.locator('.weapon-row').count();}
    assert.equal(collectionCounts.base,30);assert.equal(collectionCounts.new,370);assert.equal(collectionCounts.base+collectionCounts.classic+collectionCounts.new,catalog.length);
    await collection.selectOption('all');
    const results=page.locator('.weapon-results');await results.hover();await page.mouse.wheel(0,700);
    await page.waitForFunction(()=>document.querySelector('.weapon-results').scrollTop>0);
    await page.keyboard.press('Escape');await page.locator('.arsenal').waitFor({state:'detached'});
    const restored=await page.evaluate(()=>{const scene=window.game.scene.getScene('main-scene');return {keyboard:scene.input.keyboard.enabled,paused:scene.scene.isPaused()};});
    assert.deepEqual(restored,{keyboard:true,paused:false},'closing arsenal did not restore gameplay');
    return {pooledRows:resources.after.rows,stableResetCount:50,collectionCounts,click:true,wheel:true,drag:true,spaceSearch:true,escape:true};
};
