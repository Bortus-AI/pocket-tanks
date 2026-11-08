import { weaponArray } from '../array';
import { tankState, worldState } from './tactics';

import { weaponDetails } from './weapon-details';
export { weaponDetails } from './weapon-details';

const element=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
const installStyles=()=>{
    if(document.getElementById('arsenal-style'))return;
    const style=element('style');style.id='arsenal-style';style.textContent=`
    .arsenal{box-sizing:border-box;width:min(1080px,96vw);height:min(740px,94vh);padding:24px;border:1px solid #597976;border-radius:14px;background:#102630;color:#e5ecdc;font:15px Arial;box-shadow:0 30px 100px #0009}
    .arsenal::backdrop{background:#041019c9}.arsenal *{box-sizing:border-box}.arsenal header{display:flex;align-items:center;justify-content:space-between;gap:15px}.arsenal h2{font-size:25px;margin:0 0 7px}.arsenal p{color:#afc5bd;line-height:1.5}.arsenal button,.arsenal select,.arsenal input{border:1px solid #4e6b70;border-radius:6px;background:#213e48;color:#e5ecdc;padding:11px;font:inherit}.arsenal button{cursor:pointer}.arsenal button:hover{background:#375e63}.arsenal .filters{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.arsenal input{flex:1 1 240px;min-width:0}.arsenal .arsenal-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:22px;flex:1;min-height:0}.arsenal[open]{display:flex;flex-direction:column}.arsenal .weapon-results{overflow:auto;min-height:0}.arsenal .weapon-row{display:block;width:100%;text-align:left;margin:0 0 6px;border-left:3px solid #6da99c;overflow-wrap:anywhere}.arsenal .weapon-row[aria-pressed=true]{background:#36585c;border-left-color:#e8b17b}.arsenal aside{padding:18px;background:#172f39;border-radius:8px;overflow:auto}.arsenal aside h3{font-size:26px;margin-top:8px}.arsenal .tag{color:#8fd7c2;font-size:12px;text-transform:uppercase;letter-spacing:1px}.arsenal .warning{color:#f1c69a}.arsenal .equip{background:#dbac7d;color:#102630;width:100%;font-weight:bold}.arsenal .equip:disabled{opacity:.45;cursor:default}.arsenal .result-count{margin:8px 0;font-size:13px}.arsenal .state{font-size:13px;color:#9ed6cf}.arsenal .combo{padding:10px;border-left:2px solid #72bca9;background:#183943;font-size:14px}.arsenal .close{font-size:18px}
    @media(max-width:620px){.arsenal{padding:14px}.arsenal .arsenal-layout{grid-template-columns:1fr;grid-template-rows:1fr 1fr;gap:10px}.arsenal .filters{flex-wrap:wrap}.arsenal h2{font-size:21px}.arsenal aside h3{font-size:20px}}
    `;document.head.appendChild(style);
};
export const installArsenal = (scene, position = {}) => {
    installStyles();scene.arsenal={catalog:weaponArray,open:null};
    const shortcut=scene.add.text(position.x ?? scene.renderer.width/2,position.y ?? 90,`ARSENAL  ${weaponArray.length}  [B]`,{fontFamily:'Arial',fontSize:14,color:'#c1d7c9',backgroundColor:'#18333c',padding:{x:14,y:8}}).setOrigin(.5).setDepth(8).setInteractive({useHandCursor:true});
    let dialog=null;
    let keyboardWasEnabled=true;
    const open=()=>{
        if(dialog)return;
        const running=scene.tank1?.turret?.activeWeapon||scene.tank2?.turret?.activeWeapon;
        if(running)return;
        scene.HUD?.weaponScrollDisplay?.hide();
        dialog=element('dialog',null,'arsenal');dialog.setAttribute('aria-label','Weapons arsenal');const header=element('header');
        const heading=element('div');heading.append(element('h2','WEAPONS ARSENAL'),element('span',`${weaponArray.length} weapons · choose by effect, terrain role, or risk`));
        const close=element('button','×','close');close.setAttribute('aria-label','Close arsenal');header.append(heading,close);dialog.append(header);
        const filters=element('div',null,'filters');const search=element('input');search.placeholder='Search weapons, effects, or combinations';search.setAttribute('aria-label','Search weapons');
        const category=element('select');category.setAttribute('aria-label','Weapon category');['All categories',...new Set(weaponArray.map(w=>weaponDetails(w).category))].forEach(c=>category.append(new Option(c,c)));
        const collection=element('select');collection.setAttribute('aria-label','Weapon collection');
        [['all','All collections'],['base','Original base game'],['classic','Returning classics'],['new','New designs']].forEach(([value,label])=>collection.append(new Option(label,value)));
        const owned=element('button','Show owned');owned.setAttribute('aria-pressed','false');filters.append(search,category,collection,owned);dialog.append(filters);
        const resultCount=element('p',null,'result-count');dialog.append(resultCount);
        const layout=element('div',null,'arsenal-layout'),results=element('div',null,'weapon-results'),details=element('aside');layout.append(results,details);dialog.append(layout);
        const current=()=>scene.activeTank===2?scene.tank2:scene.tank1;
        const owns=w=>!!current()?.weapons?.some(item=>item.id===w.id);
        let onlyOwned=false;
        const show=w=>{
            const info=weaponDetails(w);details.replaceChildren();
            details.append(element('div',`${info.category} / ${info.origin}`,'tag'),element('h3',w.name),element('p',info.description),element('p',`WATCH OUT: ${info.warning}`,'warning'));
            if(w.payload) {
                details.append(element('p',`Payload: ${w.payload.name}`));
                const combinations = {
                    fire:'Combo: oil first, then fire. A frost or foam payload can put the flames out.',
                    frost:'Combo: immobilize a tank, then target its position with a precise or delayed shot.',
                    acid:'Combo: corrosion first, then a concentrated damage weapon before it wears off.',
                    ion:'Combo: mark armor with a Ferric payload, then arc electricity into it. Ion also strips shields.',
                    seismic:'Combo: open cover with excavation, then follow through with a direct shot. Seismic impacts can detonate mines.',
                    leech:'Combo: land a damaging hit to charge protection for your next position.',
                    foam:'Combo: protect your position and extinguish dangerous ground. Avoid shielding the opponent.',
                    magnet:'Combo: mark a target before guided ordnance or an Ion discharge.',
                    volatile:'Combo: trap the opponent before the delayed blast, and keep your own tank away.',
                    kinetic:'Combo: remove cover or corrode armor before landing a focused hit.'
                };
                if(combinations[w.payload.key]) details.append(element('p',combinations[w.payload.key],'combo'));
            }
            if(current()) {const state=tankState(current());details.append(element('p',`Your shield: ${state.shield} / 150 · Active field hazards: ${worldState(scene).zones.length}`,'state'));}
            const equip=element('button',owns(w)?'SELECT WEAPON':'NOT IN YOUR LOADOUT','equip');
            equip.disabled=!owns(w)||!current()?.active||scene.terrain?.animate||(scene.sceneData?.gameType===3&&scene.activeTank!==1);
            equip.addEventListener('click',()=>{const t=current(),i=t.weapons.findIndex(item=>item.id===w.id);if(i>=0){scene.HUD.weaponScrollDisplay.setActive(i);dialog.close();}});
            details.append(equip);
            results.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.id)===w.id)));
        };
        const refresh=()=>{
            const term=search.value.toLowerCase().trim();results.replaceChildren();
            const filtered=weaponArray.filter(w=>{const info=weaponDetails(w);return (!onlyOwned||owns(w))&&(category.value==='All categories'||info.category===category.value)&&(collection.value==='all'||(collection.value==='base'&&w.id<30)||(collection.value==='classic'&&w.id>=30&&info.origin.toLowerCase().includes('classic'))||(collection.value==='new'&&w.id>=30&&!info.origin.toLowerCase().includes('classic')))&&`${w.name} ${info.description} ${info.warning} ${info.origin}`.toLowerCase().includes(term);});
            resultCount.textContent=`${filtered.length} of ${weaponArray.length} weapons · Target Practice includes the entire arsenal`;
            filtered.forEach(w=>{const row=element('button',`${w.name}${owns(w)?'  •':''}`,'weapon-row');row.dataset.id=w.id;row.addEventListener('click',()=>show(w));results.append(row);});
            if(filtered.length)show(filtered[0]);else details.replaceChildren(element('p','No weapons match your filters.'));
        };
        search.addEventListener('input',refresh);category.addEventListener('change',refresh);collection.addEventListener('change',refresh);owned.addEventListener('click',()=>{onlyOwned=!onlyOwned;owned.setAttribute('aria-pressed',String(onlyOwned));owned.textContent=onlyOwned?'Show all':'Show owned';refresh();});
        close.addEventListener('click',()=>dialog.close());
        dialog.addEventListener('keydown',event=>event.stopPropagation());
        dialog.addEventListener('keyup',event=>event.stopPropagation());
        dialog.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
        dialog.addEventListener('close',()=>{dialog.remove();dialog=null;scene.input.keyboard.resetKeys();scene.input.keyboard.enabled=keyboardWasEnabled;scene.scene.resume();});
        document.body.append(dialog);keyboardWasEnabled=scene.input.keyboard.enabled;scene.scene.pause();scene.input.keyboard.enabled=false;dialog.showModal();refresh();search.focus();
    };
    scene.arsenal.open=open;shortcut.on('pointerdown',open);scene.input.keyboard.on('keydown-B',open);
    scene.events.once('shutdown',()=>{if(dialog){dialog.remove();dialog=null;}scene.input.keyboard.enabled=keyboardWasEnabled;});
};
