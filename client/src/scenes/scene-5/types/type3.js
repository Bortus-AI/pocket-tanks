import { weaponArray } from '../../../weapons/array';
import { installArsenal } from '../../../weapons/expansion/browser';
import { weaponDetails, shortWeaponDescription } from '../../../weapons/expansion/weapon-details';
import { weaponIconTexture, fitWeaponName } from '../../../weapons/expansion/presentation';
import { isOnlineHost } from '../../../socket/session';
import { draftInventory, draftActions } from './online-draft-state';

const makeButton = (scene, x, y, width, label, callback) => {
    const container = scene.add.container(x, y);
    const background = scene.add.rectangle(0, 0, width, 48, 0x294b55).setStrokeStyle(1, 0x648680);
    const text = scene.add.text(0, 0, label, {fontFamily:'Arial', fontSize:17, fontStyle:'bold', color:'#e1e9d5'}).setOrigin(.5);
    container.add([background, text]);
    background.setInteractive({useHandCursor:true});
    let enabled = true;
    background.on('pointerdown', () => {if(enabled) callback();});
    background.on('pointerover', () => {if(enabled) background.setFillStyle(0x3e6469);});
    background.on('pointerout', () => background.setFillStyle(enabled ? 0x294b55 : 0x182e38));
    return {container, background, text, setEnabled(value) {
        enabled = !!value;
        background.setFillStyle(enabled ? 0x294b55 : 0x182e38);
        text.setAlpha(enabled ? 1 : .4);
        background.input.cursor = enabled ? 'pointer' : 'default';
    }};
};

// The server owns the shared pool, alternating turns and claimed slots. A row
// tap previews a weapon; only SELECT or RANDOM submits a pick.
export const type3 = scene => {
    const socket = window.socket;
    scene.player1 = {...scene.sceneData.player1, weapons:[]};
    scene.player2 = {...scene.sceneData.player2, weapons:[]};
    scene.hostId = scene.sceneData.hostId;
    const role = scene.sceneData.onlineRole || window.onlineSession?.role || (isOnlineHost(socket, scene.hostId) ? 'host' : 'player');
    const otherRole = role === 'host' ? 'player' : 'host';
    scene.sceneData.onlineRole = role;

    const title = scene.add.text(600, 62, 'CHOOSE YOUR WEAPONS', {fontFamily:'Arial',fontSize:32,fontStyle:'bold',color:'#e4e9d8'}).setOrigin(.5);
    const status = scene.add.text(600, 109, 'Loading the shared weapon pool…', {fontFamily:'Arial',fontSize:18,color:'#bad4c9'}).setOrigin(.5);
    scene.add.text(600, 145, 'SELECT ONE, RANDOM ONE — OR RANDOM ALL TO FILL YOUR 10 SLOTS NOW', {fontFamily:'Arial',fontSize:12,color:'#93b4af'}).setOrigin(.5);
    installArsenal(scene, {x:940,y:58});

    scene.add.rectangle(600, 366, 740, 410, 0x102a34, .96).setStrokeStyle(1, 0x4d706f);
    scene.add.rectangle(126, 366, 215, 410, 0x102a34, .94).setStrokeStyle(1, scene.player1.color);
    scene.add.rectangle(1074, 366, 215, 410, 0x102a34, .94).setStrokeStyle(1, scene.player2.color);
    const ownHeading = scene.add.text(126, 179, '', {fontFamily:'Arial',fontSize:17,color:'#cbe0cf',align:'center'}).setOrigin(.5);
    const otherHeading = scene.add.text(1074, 179, '', {fontFamily:'Arial',fontSize:17,color:'#cbe0cf',align:'center'}).setOrigin(.5);
    const ownInventory = [], otherInventory = [];
    for(let i=0;i<10;i++) {
        ownInventory.push(scene.add.text(28, 211+i*33, '', {fontFamily:'Arial',fontSize:15,color:'#d3e2d1'}));
        otherInventory.push(scene.add.text(976, 211+i*33, '', {fontFamily:'Arial',fontSize:15,color:'#d3e2d1'}));
    }

    scene.add.rectangle(600, 625, 740, 88, 0x102a34, .98).setStrokeStyle(1,0x4d706f);
    const descriptionTitle = scene.add.text(246, 590, 'SELECT A WEAPON ABOVE', {fontFamily:'Arial',fontSize:15,fontStyle:'bold',color:'#ebc89c'});
    const description = scene.add.text(246, 614, 'You can inspect the pool while the other player chooses.', {fontFamily:'Arial',fontSize:14,color:'#c8d9c9',wordWrap:{width:708},lineSpacing:2});

    let draft = null, selectedIndex = null, pending = false, lastError = '';
    const rows = [];
    const buttons = {};
    const claimedBy = index => draft?.picks?.host?.includes(index) ? 'host' : draft?.picks?.player?.includes(index) ? 'player' : null;
    const complete = () => !!draft && draft.picks.host.length === 10 && draft.picks.player.length === 10;
    const canPick = () => !!draft && draft.turn === role && !draft.ready?.[role] && !pending && !window.onlineSession?.paused;
    const submit = (event, payload={}) => {
        if(!socket.connected || pending) return;
        pending = true;lastError = '';
        scene.sound.play('click', {volume:.3});
        socket.emit(event, payload);
        render();
    };
    const select = index => {
        if(!draft || !weaponArray[draft.pool[index]]) return;
        selectedIndex = index;lastError = '';render();
    };
    buttons.select = makeButton(scene, 382, 706, 228, 'SELECT WEAPON', () => {
        if(canPick() && selectedIndex !== null && !claimedBy(selectedIndex)) submit('weaponPick', {arrayIndex:selectedIndex});
    });
    buttons.random = makeButton(scene, 603, 706, 176, 'RANDOM', () => {if(canPick()) submit('randomWeaponPick');});
    buttons.randomAll = makeButton(scene, 824, 706, 236, 'RANDOM ALL', () => {
        if(draftActions(draft,role,selectedIndex,{pending,paused:!!window.onlineSession?.paused}).randomAll) submit('randomAllWeapons');
    });
    buttons.randomRemaining = buttons.randomAll;
    buttons.continue = makeButton(scene, 600, 766, 272, 'CONTINUE', () => {if(complete() && !draft.ready[role]) submit('ready');});

    const rebuildRows = pool => {
        rows.forEach(row=>row.container.destroy());rows.length=0;
        pool.forEach((weaponId,index)=>{
            const weapon=weaponArray[weaponId];if(!weapon)return;
            const x=index<10?414:786,y=194+(index%10)*37;
            const container=scene.add.container(x,y);
            const background=scene.add.rectangle(0,0,350,33,0x1c3a44).setStrokeStyle(1,0x38595e);
            const icon=scene.add.image(-157,0,weaponIconTexture(scene,weapon)).setDisplaySize(25,25);
            const text=scene.add.text(-136,0,weapon.name,{fontFamily:'Arial',fontSize:16,color:'#d6e4d5'}).setOrigin(0,.5);
            fitWeaponName(text,295,16,12);
            const mark=scene.add.text(159,0,'',{fontFamily:'Arial',fontSize:13,fontStyle:'bold',color:'#d5e7d4'}).setOrigin(1,.5);
            container.add([background,icon,text,mark]);background.setInteractive({useHandCursor:true});
            background.on('pointerdown',()=>select(index));
            background.on('pointerover',()=>{if(selectedIndex!==index&&!claimedBy(index))background.setFillStyle(0x31545a);});
            background.on('pointerout',()=>render());
            rows.push({index,container,background,icon,text,mark});
        });
    };
    const render = () => {
        if(!draft)return;
        const localPicks=draft.picks[role],otherPicks=draft.picks[otherRole];
        scene.player1.weapons=draftInventory(draft,role,weaponArray);
        scene.player2.weapons=draftInventory(draft,otherRole,weaponArray);
        ownHeading.setText(`YOUR WEAPONS ${localPicks.length}/10`);
        otherHeading.setText(`${scene.player2.name.slice(0,13)} ${otherPicks.length}/10`);
        ownInventory.forEach((text,i)=>{text.setText(scene.player1.weapons[i]?.name||'—');fitWeaponName(text,195,15,11);});
        otherInventory.forEach((text,i)=>{text.setText(scene.player2.weapons[i]?.name||'—');fitWeaponName(text,195,15,11);});
        rows.forEach(row=>{
            const owner=claimedBy(row.index),chosen=selectedIndex===row.index;
            row.background.setFillStyle(chosen?0x3a5d60:owner?0x152d36:0x1c3a44).setStrokeStyle(chosen?2:1,chosen?0xe7b17b:0x38595e);
            row.text.setAlpha(owner?.55:1);row.icon.setAlpha(owner?.5:1);
            row.mark.setText(owner===role?'YOU':owner?'OPP':'');
        });
        const weapon=selectedIndex===null?null:weaponArray[draft.pool[selectedIndex]];
        if(weapon){const info=weaponDetails(weapon);descriptionTitle.setText(`${weapon.name} · ${info.category}`);fitWeaponName(descriptionTitle,708,15,12);description.setText(shortWeaponDescription(weapon));}
        else {descriptionTitle.setText('SELECT A WEAPON ABOVE');description.setText('SELECT WEAPON claims one choice. RANDOM chooses one. RANDOM ALL immediately fills your remaining loadout slots.');}
        if(lastError)status.setText(lastError).setColor('#edba91');
        else if(pending)status.setText('Confirming your choice…').setColor('#c7d8c7');
        else if(complete())status.setText(draft.ready[role]?'Ready — waiting for your opponent…':'Both loadouts are ready. Press CONTINUE when you are ready to play.').setColor('#e7c390');
        else if(localPicks.length===10)status.setText('Your full loadout is ready. Waiting for your opponent to finish choosing…').setColor('#e7c390');
        else status.setText(draft.turn===role?'YOUR TURN · Select a weapon or choose Random':`${scene.player2.name} is choosing a weapon…`).setColor(draft.turn===role?'#ecd09c':'#a9c9bd');
        const actions=draftActions(draft,role,selectedIndex,{pending,paused:!!window.onlineSession?.paused});
        buttons.select.setEnabled(actions.select);
        buttons.random.setEnabled(actions.random);
        buttons.randomAll.setEnabled(actions.randomAll);
        buttons.continue.setEnabled(actions.continue);
        buttons.continue.text.setText(draft.ready[role]?'WAITING FOR OPPONENT':'CONTINUE');
    };
    const applyDraft = state => {
        if(!state || !Array.isArray(state.pool) || !state.picks || !Array.isArray(state.picks.host) || !Array.isArray(state.picks.player))return;
        const changed=!draft||state.pool.length!==draft.pool.length||state.pool.some((id,index)=>id!==draft.pool[index]);
        draft={...state,ready:state.ready||{host:false,player:false},autoPick:state.autoPick||{host:false,player:false}};
        scene.sceneData.draft=draft;pending=false;lastError='';
        if(changed) {selectedIndex=null;rebuildRows(draft.pool);}
        if(selectedIndex!==null&&claimedBy(selectedIndex))selectedIndex=null;
        render();
    };
    const recoverDraft = ({randomArray}) => {
        if(!draft && Array.isArray(randomArray))applyDraft({pool:randomArray,picks:{host:[],player:[]},turn:'host',ready:{host:false,player:false}});
    };
    const handleError = error => {pending=false;lastError=error?.message||'That choice is unavailable. Select another weapon.';render();};
    const startGame = () => {
        if(!complete())return;
        const data={...scene.sceneData};
        delete data.resumeSnapshot;delete data.resumeWithoutSnapshot;delete data.resumePendingShot;delete data.draftIds;
        scene.scene.start('main-scene',{...data,gameType:3,player1:scene.player1,player2:scene.player2,hostId:scene.hostId,onlineRole:role});
    };
    const roomId=window.onlineSession?.roomId;
    const opponentLeft = data => {if(data?.roomId&&data.roomId!==roomId)return;pending=false;lastError='Your opponent left the room. Use Back to return to online rooms.';render();Object.values(buttons).forEach(button=>button.setEnabled(false));};
    const listeners={draftState:applyDraft,setWeaponArray:recoverDraft,startGame,opponentLeft,draftError:handleError,roomError:handleError};
    Object.entries(listeners).forEach(([event,handler])=>socket.on(event,handler));
    scene.events.once('shutdown',()=>{Object.entries(listeners).forEach(([event,handler])=>socket.off(event,handler));scene.onlineDraft=null;});
    scene.onlineDraft={role,buttons,rows,select,get state(){return draft;},get selectedIndex(){return selectedIndex;}};
    if(scene.sceneData.draft)applyDraft(scene.sceneData.draft);
    if(role==='host')socket.emit('createWeaponArray',{count:20,max:weaponArray.length});
    socket.emit('getWeaponArray',{});
    // Expose a stable heading name for accessibility/browser diagnostics.
    title.setName('online-draft-title');
};
