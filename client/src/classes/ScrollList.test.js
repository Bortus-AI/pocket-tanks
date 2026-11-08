import { ScrollList } from './ScrollList';

jest.mock('../socket', () => ({socket: {on: jest.fn(), off: jest.fn(), emit: jest.fn()}}));
jest.mock('../weapons/array', () => ({weaponArray: Array.from({length: 500}, (_, id) => ({id, name: `Weapon ${id}`, logoCanvas: {width: 28, height: 28}}))}));

const object = () => ({
    width: 28, height: 28, x: 0, y: 0, text: '', fontSize: 18,
    setDepth(){return this;}, setMask(){return this;}, setOrigin(){return this;}, setColor(){return this;},
    setTexture(key){this.texture = key;return this;}, setVisible(value){this.visible=value;return this;},
    setDisplaySize(width,height){this.displayWidth=width;this.displayHeight=height;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},
    setText(value){this.text=value;this.width=String(value).length*this.fontSize*.5;return this;},
    setFontSize(value){this.fontSize=value;this.width=this.text.length*value*.5;return this;},
    getData(){return 145;}, add(){return this;}, setInteractive(){return this;}, on(){return this;}
});
const makeScene = () => {
    const cache=new Set();
    const scene={
        renderer:{width:1200,height:800},game:{device:{os:{desktop:true}}},activeTank:1,sceneData:{gameType:4},
        tank1:{active:true,selectedWeapon:0,weapons:Array.from({length:500},(_,id)=>({id,name:`Weapon ${id}`}))},tank2:{},
        add:{container:jest.fn(object),image:jest.fn(object),text:jest.fn(object),group:()=>({children:[],add(row){this.children.push(row);},setVisible(value){this.children.forEach(row=>row.setVisible(value));}})},
        make:{graphics:jest.fn(()=>({fillRect:jest.fn(),createGeometryMask:()=>({destroy:jest.fn()}),destroy:jest.fn()}))},
        textures:{exists:key=>cache.has(key),addCanvas:jest.fn(key=>cache.add(key))},
        input:{on:jest.fn(),off:jest.fn()},events:{once:jest.fn()},sound:{play:jest.fn()},hideTurnPointer:jest.fn(),HUD:{mouseLocked:false}
    };
    return scene;
};
const makeList = scene => {
    const list=new ScrollList(scene,object(),object(),object());
    list.scrollBox=object();list.scrollBackground={...object(),width:320,height:200,parentContainer:{x:300,y:500}};
    list.create();return list;
};

test('500-item inventories reuse a small row pool and one mask across resets',()=>{
    const scene=makeScene(), list=makeList(scene);list.reset(scene.tank1);
    expect(list.rows).toHaveLength(7);expect(scene.add.container).toHaveBeenCalledTimes(7);expect(scene.make.graphics).toHaveBeenCalledTimes(1);
    const textures=scene.textures.addCanvas.mock.calls.length;
    for(let i=0;i<20;i++){list.setActive(0);list.reset(scene.tank1);}
    expect(scene.textures.addCanvas).toHaveBeenCalledTimes(textures);
    expect(scene.add.container).toHaveBeenCalledTimes(7);expect(scene.make.graphics).toHaveBeenCalledTimes(1);
    expect(textures).toBeLessThan(10);
});

test('scroll position is bounded and rebinds rows near the selected index',()=>{
    const scene=makeScene(),list=makeList(scene);scene.tank1.selectedWeapon=450;list.reset(scene.tank1);list.show();
    expect(list.rows.some(row=>row.weaponIndex===450)).toBe(true);
    expect(list.clampOffset(-500)).toBe(0);expect(list.clampOffset(1e9)).toBe(499*list.tileHeight);
    expect(list.rows.filter(row=>row.visible).length).toBeLessThanOrEqual(7);
});

test('an empty loadout can reset without dereferencing a missing weapon',()=>{
    const scene=makeScene(),list=makeList(scene);scene.tank1.weapons=[];scene.tank1.selectedWeapon=null;
    expect(()=>list.reset(scene.tank1)).not.toThrow();expect(list.selected.text).toBe('No weapons');expect(list.weaponLogo.visible).toBe(false);
});
