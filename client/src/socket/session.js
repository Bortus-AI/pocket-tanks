import { exportTactics, importTactics, worldState } from '../weapons/expansion/tactics';
import { normalizeSavedRoom, canApplyCheckpoint, onlinePresenceText, hasUnsettledShot, matchesMembership, isDefinitiveSessionLoss } from './session-state';
const ID_KEY='pocket-online-session-id';
const TAB_KEY='pocket-online-room';
const LAST_KEY='pocket-online-last-room';
const persistent=new Map();
const parse=value=>{try{return JSON.parse(value);}catch{return null;}};
const storage=(kind,action,key,value)=>{try{return window[kind][action](key,value);}catch{return null;}};
export const getOnlineSessionId=()=>{
    let id=storage('sessionStorage','getItem',ID_KEY);
    if(!id){id=window.crypto?.randomUUID?.()||Array.from(window.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-');storage('sessionStorage','setItem',ID_KEY,id);}
    return id;
};
const cached=normalizeSavedRoom(parse(storage('sessionStorage','getItem',TAB_KEY)));
export const onlineSession={...(cached||{}),paused:false,restoring:false,restored:false};
window.onlineSession=onlineSession;
let socketRef,overlay,pendingRestore,restoreTimer,lastCheckpoint=0,pendingCheckpoint,parkTimer,resumeRequested=false,parkRevision=0,shotRequest=null;
let lastApplied={savedAt:0,turnNumber:-1},committedCheckpoint=null,inFlightCheckpoint=null,failedCheckpoint=null,checkpointRevision=0;
const handlers=(event,handler)=>{socketRef.on(event,handler);if(!persistent.has(event))persistent.set(event,new Set());persistent.get(event).add(handler);};
const sceneEvents=['setRooms','startPick','setWeaponArray','draftState','opponentWeaponPick','startGame','setTerrainPath','playAgain','opponentLeft','opponentShoot','opponentPowerChange','opponentAngleChange','opponentStepLeft','opponentStepRight','opponentWeaponChange','recieveTurn','opponentRequestTurn'];
export const clearOnlineSceneListeners=socket=>sceneEvents.forEach(event=>socket.listeners(event).forEach(handler=>{if(!persistent.get(event)?.has(handler))socket.off(event,handler);}));
export const isOnlineHost=(socket,hostId)=>onlineSession.role==='host'&&onlineSession.roomId?true:onlineSession.role==='player'&&onlineSession.roomId?false:socket.playerId===hostId||socket.id===hostId;
export const resumableOnlineRoom=()=>normalizeSavedRoom(parse(storage('localStorage','getItem',LAST_KEY)));
const activeOnlineScene=()=>window.game?.scene?.getScenes(false)?.find(scene=>scene.sceneData?.gameType===3&&(scene.scene.isActive()||scene.scene.isPaused()));
const hideOverlay=()=>{overlay?.remove();overlay=null;};
const showOverlay=message=>{
    if(onlineSession.parked)return;
    if(!overlay){
        overlay=document.createElement('div');overlay.id='online-connection-status';overlay.setAttribute('role','status');
        Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'10000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(4,16,24,.84)',fontFamily:'Arial,sans-serif',color:'#e7eddd'});
        const panel=document.createElement('div');Object.assign(panel.style,{background:'#142e38',border:'1px solid #53777a',borderRadius:'12px',padding:'28px',boxSizing:'border-box',width:'min(450px, calc(100vw - 32px))',maxWidth:'calc(100vw - 32px)',maxHeight:'calc(100dvh - 24px)',overflowY:'auto',textAlign:'center'});
        const heading=document.createElement('h2');heading.className='connection-heading';panel.append(heading);
        const text=document.createElement('p');text.className='connection-message';text.style.lineHeight='1.5';panel.append(text);
        const resume=document.createElement('button');resume.textContent='RESUME MATCH';resume.className='resume-match';
        Object.assign(resume.style,{display:'block',width:'100%',minHeight:'48px',padding:'14px 22px',border:'1px solid #ddc28f',borderRadius:'6px',background:'#e7b57d',color:'#142e38',font:'bold 17px Arial,sans-serif',cursor:'pointer',touchAction:'manipulation'});
        resume.onclick=()=>resumeOnlineMatch();panel.append(resume);
        const menu=document.createElement('button');menu.textContent='RETURN TO MENU';menu.className='return-to-menu';Object.assign(menu.style,{display:'block',width:'100%',minHeight:'44px',marginTop:'12px',padding:'12px 20px',border:'1px solid #69817b',borderRadius:'6px',background:'#28434c',color:'#e7eddd',font:'15px Arial,sans-serif',cursor:'pointer',touchAction:'manipulation'});menu.onclick=()=>parkOnlineMatch();panel.append(menu);
        const leave=document.createElement('button');leave.textContent='END MATCH';leave.className='end-match';Object.assign(leave.style,{display:'block',margin:'16px auto 0',minHeight:'44px',padding:'12px 16px',border:0,background:'transparent',color:'#c7d4c6',font:'15px Arial,sans-serif',cursor:'pointer',touchAction:'manipulation'});leave.onclick=()=>leaveOnlineMatch();panel.append(leave);overlay.append(panel);document.body.append(overlay);
    }
    overlay.querySelector('.connection-heading').textContent=onlineSession.persistenceStatus==='error'?'SAVE NEEDS ATTENTION':onlineSession.persistenceStatus==='saving'?'SAVING MATCH…':'YOUR MATCH IS SAVED';
    overlay.querySelector('.connection-message').textContent=message+(onlineSession.persistenceStatus==='error'?' Keep this page open while retrying.':' You can return to this match later.');
    overlay.querySelector('.end-match').disabled=!socketRef?.connected;
};
const pauseOnline=message=>{
    onlineSession.paused=true;onlineSession.restoring=true;
    if(onlineSession.parked)return;
    const scene=activeOnlineScene();
    if(scene){scene.input.keyboard.resetKeys();scene.input.keyboard.enabled=false;scene.scene.pause();}
    showOverlay(message);
};
const saveMembership=session=>{
    if(!session.roomId)return;
    const saved={sessionId:session.sessionId||getOnlineSessionId(),roomId:session.roomId,role:session.role,playerId:session.playerId,hostId:session.hostId,host:session.host,player:session.player,phase:session.phase,persistent:true,asynchronous:true,parked:!!session.parked};
    storage('sessionStorage','setItem',TAB_KEY,JSON.stringify(saved));storage('localStorage','setItem',LAST_KEY,JSON.stringify(saved));
};
const resetCheckpointTracking=()=>{
    checkpointRevision++;pendingCheckpoint=null;lastApplied={savedAt:0,turnNumber:-1};lastCheckpoint=0;
    committedCheckpoint=null;inFlightCheckpoint=null;failedCheckpoint=null;
    delete onlineSession.persistenceStatus;delete onlineSession.persistenceMessage;
};
const forgetMembership=()=>{
    const last=resumableOnlineRoom();if(last?.sessionId===getOnlineSessionId())storage('localStorage','removeItem',LAST_KEY);
    storage('sessionStorage','removeItem',TAB_KEY);Object.keys(onlineSession).forEach(key=>delete onlineSession[key]);onlineSession.paused=false;onlineSession.restoring=false;
    pendingRestore=null;resumeRequested=false;parkRevision++;clearTimeout(restoreTimer);clearTimeout(parkTimer);resetCheckpointTracking();hideOverlay();
};
export const leaveOnlineMatch=()=>{
    if(socketRef?.connected)socketRef.emit('leaveRoom',{});
    forgetMembership();const game=window.game;
    if(game?.scene){for(const key of ['main-scene','scene-5','scene-4'])game.scene.stop(key);game.scene.start('scene-1');}
};
export const parkOnlineMatch=()=>{
    if(!onlineSession.roomId)return false;
    if(onlineSession.parking)return true;
    onlineSession.parking=true;
    const roomId=onlineSession.roomId,revision=++parkRevision;
    clearTimeout(parkTimer);
    const finish=async()=>{
        if(revision!==parkRevision)return;
        const scene=activeOnlineScene();
        if(socketRef?.connected&&!onlineSession.paused&&hasUnsettledShot(scene)){
            showOverlay('Finishing your shot before returning to the menu…');parkTimer=setTimeout(finish,150);return;
        }
        let saved;
        if(failedCheckpoint?.roomId===roomId)saved=await(inFlightCheckpoint?.roomId===roomId?inFlightCheckpoint.promise:retryFailedCheckpoint({force:true}));
        else if(scene?.activeTank===1)saved=await saveOnlineMatch(scene,{force:true});
        else if(inFlightCheckpoint?.roomId===roomId)saved=await inFlightCheckpoint.promise;
        if(onlineSession.roomId!==roomId||revision!==parkRevision)return;
        if(saved&&!saved.ok&&!saved.skipped){onlineSession.parking=false;showOverlay('This turn could not be saved. Please try returning to the menu again.');return;}
        onlineSession.parked=true;onlineSession.parking=false;onlineSession.restoring=false;onlineSession.backgrounded=true;pendingRestore=null;clearTimeout(restoreTimer);
        saveMembership(onlineSession);if(socketRef?.connected)socketRef.emit('suspendSession');
        const game=window.game;if(game?.scene){for(const key of ['main-scene','scene-5','scene-4'])game.scene.stop(key);game.scene.start('scene-1');}
        hideOverlay();
    };finish().catch(()=>{onlineSession.parking=false;onlineSession.persistenceStatus='error';showOverlay('Could not save this turn. Please try again.');});return true;
};
const resumeRoom=saved=>{
    if(!saved?.roomId||!saved.sessionId||!socketRef)return false;
    // A direct retry cancels a pending menu transition and retains the current
    // room, including any unconfirmed completed-turn checkpoint.
    parkRevision++;clearTimeout(parkTimer);
    Object.assign(onlineSession,saved,{restoring:true,paused:true,parked:false,parking:false,backgrounded:false});
    storage('sessionStorage','setItem',ID_KEY,saved.sessionId);saveMembership(onlineSession);
    resumeRequested=true;showOverlay('Reconnecting to your match…');
    const sameSession=socketRef.auth?.sessionId===saved.sessionId;
    if(socketRef.connected&&sameSession)socketRef.emit('resumeSession');
    else{
        socketRef.disconnect();socketRef.auth={...(socketRef.auth||{}),sessionId:saved.sessionId};socketRef.connect();
    }
    return true;
};
export const resumeOnlineMatch=()=>resumeRoom(onlineSession.roomId
    ? {...onlineSession,sessionId:onlineSession.sessionId||getOnlineSessionId()}
    : resumableOnlineRoom());
export const resumeLastOnlineMatch=()=>resumeRoom(resumableOnlineRoom());
export const getOnlinePresenceText=scene=>{
    const text=onlinePresenceText(onlineSession,scene||{});
    if(!text)return '';
    if(onlineSession.persistenceStatus==='error')return 'SAVE FAILED · Keep this page open and retry. Your previous saved turn is still available.';
    return onlineSession.persistenceStatus==='saving'?`${text} · Saving…`:text;
};
const playerState=tank=>({name:tank.name,color:tank.color,weapons:tank.weapons.map(weapon=>({...weapon})),selectedWeapon:tank.selectedWeapon,power:tank.power,rotation:tank.rotation,turretRotation:tank.turret.relativeRotation,score:tank.score,x:tank.x,y:tank.y,movesRemaining:tank.movesRemaining});
const transmitCheckpoint=(state,serialized,roomId,role,scene)=>{
    if(inFlightCheckpoint)return inFlightCheckpoint.promise;
    const revision=checkpointRevision;
    onlineSession.persistenceStatus='saving';onlineSession.persistenceMessage='';
    let resolveSave;const promise=new Promise(resolve=>{resolveSave=resolve;});
    const request={roomId,role,serialized,promise,state};inFlightCheckpoint=request;
    let settled=false;
    const complete=ack=>{
        if(settled)return;settled=true;clearTimeout(timer);
        if(inFlightCheckpoint===request)inFlightCheckpoint=null;
        // A rematch can reuse the room while an old save is still awaiting its
        // acknowledgement. That reply must not commit or retry the old state.
        if(revision!==checkpointRevision||onlineSession.roomId!==roomId||onlineSession.matchId!==state.matchId){
            resolveSave({ok:false,skipped:true,reason:'match-changed'});return;
        }
        const result=ack?.ok?ack:{ok:false,...ack};
        if(onlineSession.roomId===roomId){
            if(result.ok){
                committedCheckpoint={roomId,role,serialized,savedAt:result.savedAt};
                if(failedCheckpoint?.serialized===serialized)failedCheckpoint=null;
                onlineSession.persistenceStatus='saved';onlineSession.persistenceMessage='';
                if(state.completedShotId){
                    if(scene?.onlineShotId===state.completedShotId){scene.onlineShotId=null;scene.onlineTurnNumber=state.turnNumber;}
                    onlineSession.pendingShot=null;onlineSession.turn=result.turn||{number:state.turnNumber,activeRole:state.activeRole,pendingShotId:null};
                }
            }else if(result.stale){
                if(failedCheckpoint?.serialized===serialized)failedCheckpoint=null;
                onlineSession.persistenceStatus='saved';
            }else{
                failedCheckpoint={roomId,role,serialized,state,nextAttempt:Date.now()+3000};
                onlineSession.persistenceStatus='error';onlineSession.persistenceMessage=result.message||'The server has not confirmed this save.';
            }
        }
        resolveSave(result);
        if((result.ok||result.stale)&&onlineSession.roomId===roomId&&onlineSession.restoring&&!onlineSession.parked&&!pendingRestore)socketRef.emit('requestRoomSession');
    };
    const timer=setTimeout(()=>complete({ok:false,message:'The save confirmation timed out.'}),12000);
    socketRef.emit('saveMatch',{matchId:state.matchId,completedShotId:state.completedShotId,state},complete);
    return promise;
};
const retryFailedCheckpoint=({force=false}={})=>{
    const failed=failedCheckpoint;
    if(!failed||failed.roomId!==onlineSession.roomId||failed.state.matchId!==onlineSession.matchId||!socketRef?.connected||inFlightCheckpoint||(!force&&Date.now()<failed.nextAttempt))return null;
    return transmitCheckpoint(failed.state,failed.serialized,failed.roomId,failed.role,activeOnlineScene());
};
export const saveOnlineMatch=(scene,{force=false}={})=>{
    const skipped=reason=>Promise.resolve({ok:false,skipped:true,reason});
    if(scene?.sceneData?.gameType!==3||!scene.terrain||!scene.tank1||!scene.tank2||!socketRef?.connected||!onlineSession.roomId||onlineSession.paused||onlineSession.restoring)return skipped('unavailable');
    if(!scene.terrain.path.length||scene.tank1.turret.activeWeapon||scene.tank2.turret.activeWeapon||scene.terrain.animate||scene.terrain.blastArray.length||!scene.tank1.settled||!scene.tank2.settled)return skipped('in-flight');
    // A failed completed-turn save must be retried even after control has moved
    // to the other player; ownership only gates new idle checkpoints.
    if(failedCheckpoint?.roomId===onlineSession.roomId)return retryFailedCheckpoint({force})||skipped('retry-pending');
    if(!force&&(scene.activeTank!==1||!scene.tank1.active||Date.now()-lastCheckpoint<1000))return skipped('idle');
    const role=onlineSession.role;if(!role)return skipped('membership');lastCheckpoint=Date.now();
    const other=role==='host'?'player':'host',roomId=onlineSession.roomId;
    onlineSession.phase='match';saveMembership(onlineSession);
    const state={version:1,terrainPath:scene.terrain.path,terrainMask:scene.terrain.exportMask(),layoutKind:scene.terrain.layoutKind,
        players:{[role]:playerState(scene.tank1),[other]:playerState(scene.tank2)},activeRole:scene.activeTank===1?role:scene.activeTank===2?other:null,
        tactics:exportTactics(scene),tacticsRole:role,
        matchId:scene.onlineMatchId||onlineSession.matchId,
        completedShotId:scene.onlineShotId||undefined,
        turnNumber:scene.onlineShotId?Number(scene.onlineShotTurnNumber)+1:Number(scene.onlineTurnNumber??onlineSession.turn?.number??worldState(scene).shot),gameOver:scene.gameOver};
    if(scene.onlineShotId&&!scene.gameOver)state.activeRole=other;
    const serialized=JSON.stringify(state);
    if(committedCheckpoint?.roomId===roomId&&committedCheckpoint.role===role&&committedCheckpoint.serialized===serialized)return Promise.resolve({ok:true,unchanged:true,savedAt:committedCheckpoint.savedAt});
    if(inFlightCheckpoint?.roomId===roomId){
        if(inFlightCheckpoint.serialized===serialized)return inFlightCheckpoint.promise;
        const revision=checkpointRevision;
        return force?inFlightCheckpoint.promise.then(()=>revision===checkpointRevision?saveOnlineMatch(scene,{force:true}):skipped('match-changed')):skipped('save-in-flight');
    }
    return transmitCheckpoint(state,serialized,roomId,role,scene);
};

// A shot is executable only after both its baseline and unique reservation are
// durable. Retrying the same reservation never fires the weapon a second time.
export const requestOnlineShot=(scene,data)=>{
    if(shotRequest?.scene===scene)return shotRequest.promise;
    const roomId=onlineSession.roomId,matchId=scene?.onlineMatchId||onlineSession.matchId;
    if(!roomId||!matchId||!socketRef?.connected||onlineSession.paused||onlineSession.restoring||onlineSession.parked||scene?.activeTank!==1||scene.onlineShotId)return Promise.resolve({ok:false,message:'Your saved turn is not ready.'});
    const turnNumber=Number(scene.onlineTurnNumber??onlineSession.turn?.number??0);
    const shotId=window.crypto?.randomUUID?.()||Array.from(window.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('-');
    const promise=(async()=>{
        const saved=await saveOnlineMatch(scene,{force:true});
        if(!saved.ok)return saved;
        if(roomId!==onlineSession.roomId||matchId!==onlineSession.matchId||!socketRef.connected||onlineSession.paused||onlineSession.restoring)return {ok:false,message:'Reconnect before firing.'};
        const packet={...data,matchId,turnNumber,shotId};
        const result=await new Promise(resolve=>{
            let done=false;const finish=ack=>{if(done)return;done=true;clearTimeout(timer);resolve(ack||{ok:false});};
            const timer=setTimeout(()=>finish({ok:false,uncertain:true,message:'Waiting for the shot confirmation. Resume your match to recover it.'}),12000);
            socketRef.emit('shoot',packet,finish);
        });
        if(!result.ok){if(result.uncertain){pauseOnline(result.message);socketRef.emit('requestRoomSession',{roomId});}return result;}
        if(result.duplicate){socketRef.emit('requestRoomSession',{roomId});return result;}
        if(roomId!==onlineSession.roomId)return {ok:false};
        scene.onlineShotId=shotId;scene.onlineShotTurnNumber=turnNumber;
        scene.onlineShotIds=scene.onlineShotIds||new Set();scene.onlineShotIds.add(shotId);
        onlineSession.pendingShot={...packet,role:onlineSession.role,data};
        onlineSession.turn=result.turn||{number:turnNumber,activeRole:onlineSession.role,pendingShotId:shotId};
        return {...result,shotId,matchId,turnNumber};
    })();
    shotRequest={scene,promise};promise.finally(()=>{if(shotRequest?.promise===promise)shotRequest=null;});return promise;
};

export const acceptOnlineShot=(scene,shot)=>{
    if(onlineSession.paused||onlineSession.restoring||onlineSession.parked||document.hidden)return false;
    if(scene?.sceneData?.gameType!==3||!shot?.shotId||shot.matchId!==(scene.onlineMatchId||onlineSession.matchId)||Number(shot.turnNumber)!==Number(scene.onlineTurnNumber??onlineSession.turn?.number??0))return false;
    scene.onlineShotIds=scene.onlineShotIds||new Set();if(scene.onlineShotIds.has(shot.shotId))return false;
    const role=shot.role||(onlineSession.role==='host'?'player':'host'),own=role===onlineSession.role;
    const tank=own?scene.tank1:scene.tank2,other=own?scene.tank2:scene.tank1,data=shot.data||shot;
    if(role!==onlineSession.turn?.activeRole||!scene.HUD||tank.turret.activeWeapon||!Number.isInteger(data.selectedWeapon)||!tank.weapons[data.selectedWeapon])return false;
    tank.moving=false;tank.leftSteps=0;tank.rightSteps=0;
    if(data.position1)tank.setPosition(data.position1.x,data.position1.y);
    if(data.position2)other.setPosition(data.position2.x,data.position2.y);
    if(data.rotation1!==undefined)tank.setRotation(data.rotation1);
    if(data.rotation2!==undefined)other.setRotation(data.rotation2);
    tank.body?.updateFromGameObject();other.body?.updateFromGameObject();
    tank.selectedWeapon=data.selectedWeapon;tank.setPower(data.power);tank.turret.setRelativeRotation(data.rotation);
    tank.active=true;other.active=false;scene.activeTank=own?1:2;
    scene.HUD.weaponScrollDisplay?.reset(tank);
    if(tank.shoot()===false)return false;
    scene.onlineShotIds.add(shot.shotId);
    if(own){scene.onlineShotId=shot.shotId;scene.onlineShotTurnNumber=shot.turnNumber;}
    onlineSession.pendingShot={...shot,role,data};
    onlineSession.turn={number:Number(shot.turnNumber),activeRole:role,pendingShotId:shot.shotId};return true;
};
const colorNumber=color=>{
    if(typeof color==='number')return color;
    const match=String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return match?(Number(match[1])<<16)+(Number(match[2])<<8)+Number(match[3]):parseInt(String(color).replace('#',''),16)||0x6eaa99;
};
export const applyOnlineSnapshot=(scene,snapshot)=>{
    const state=snapshot?.state,role=scene.sceneData.onlineRole||onlineSession.role;
    if(!state?.players?.[role]||!state.terrainPath)return false;
    scene.onlineMatchId=state.matchId||onlineSession.matchId;
    scene.onlineTurnNumber=Number(state.turnNumber)||0;scene.onlineShotId=null;
    const other=role==='host'?'player':'host';scene.terrain.setPath(state.terrainPath);scene.terrain.multiplayerCorrection(state.terrainMask);scene.terrain.matrix=[];scene.terrain.animate=false;
    [role,other].forEach((slot,index)=>{
        const tank=index===0?scene.tank1:scene.tank2,saved=state.players[slot];
        tank.weapons=saved.weapons.map(weapon=>({...weapon}));tank.selectedWeapon=saved.selectedWeapon;tank.movesRemaining=saved.movesRemaining;
        tank.setPosition(saved.x,saved.y).setRotation(saved.rotation);tank.body.updateFromGameObject();tank.body.stop();tank.body.setGravity(0);tank.settled=true;
        tank.setPower(saved.power);tank.turret.setRelativeRotation(saved.turretRotation);tank.score=saved.score;tank.centre={x:saved.x,y:saved.y-6};
        tank.active=state.activeRole===slot;
    });
    if(state.tactics){
        let tactics=state.tactics;
        if((state.tacticsRole||snapshot.role)===role)tactics={...tactics,states:[...tactics.states].reverse(),scores:tactics.scores?[...tactics.scores].reverse():undefined,zones:tactics.zones.map(zone=>({...zone,owner:zone.owner===1?2:1})),devices:(tactics.devices||[]).map(device=>({...device,owner:device.owner===1?2:1}))};
        importTactics(scene,tactics);
    }
    scene.activeTank=state.activeRole===role?1:state.activeRole===other?2:0;scene.gameOver=!!state.gameOver;
    scene.HUD?.reset();scene.terrain.save();return true;
};

const snapshotApplied=snapshot=>{
    lastApplied={savedAt:Number(snapshot?.savedAt)||0,turnNumber:Number(snapshot?.state?.turnNumber)||0};
    if(pendingCheckpoint&&!canApplyCheckpoint(pendingCheckpoint,lastApplied))pendingCheckpoint=null;
};
// Called from MainScene.update. Presence changes never enter this path; only a
// newer completed-turn checkpoint is allowed to reconcile gameplay.
export const processOnlineSession=scene=>{
    if(scene?.sceneData?.gameType!==3)return;
    if(scene.sceneData.resumePendingShot&&pendingCheckpoint&&Number(pendingCheckpoint.state.turnNumber)>Number(scene.sceneData.resumePendingShot.turnNumber))delete scene.sceneData.resumePendingShot;
    const replay=scene.sceneData.resumePendingShot;
    if(replay&&!onlineSession.paused&&!onlineSession.restoring&&!document.hidden&&scene.HUD&&scene.scene.isActive()){
        if(acceptOnlineShot(scene,replay))delete scene.sceneData.resumePendingShot;
        return;
    }
    if(!pendingCheckpoint||onlineSession.paused||onlineSession.restoring||onlineSession.parked||document.hidden)return;
    if(scene?.sceneData?.gameType!==3||!scene.scene.isActive()||hasUnsettledShot(scene))return;
    const snapshot=pendingCheckpoint,localTurn=worldState(scene).shot;
    if(!canApplyCheckpoint(snapshot,lastApplied,localTurn)){pendingCheckpoint=null;return;}
    pendingCheckpoint=null;
    const wasGameOver=scene.gameOver;
    if(applyOnlineSnapshot(scene,snapshot)){
        snapshotApplied(snapshot);scene.pendingOnlineTurn=null;scene.turnRequestPending=false;scene.showTurnPointer?.();
        if(scene.gameOver&&!wasGameOver)scene.showGameOver?.();
    }
};
const restoreWhenReady=session=>{
    pendingRestore=session;clearTimeout(restoreTimer);
    const attempt=()=>{
        const current=pendingRestore;if(!current||onlineSession.parked)return;
        const game=window.game,loading=game?.scene?.getScene('loading-scene');
        if(!game?.textures?.exists('wall')||loading?.load?.isLoading()){restoreTimer=setTimeout(attempt,100);return;}
        if(document.hidden||current.paused){pauseOnline('Your browser is in the background. Return when you are ready.');return;}
        const existing=activeOnlineScene();
        // A duplicate self-status response cannot interrupt an executing shot.
        if(hasUnsettledShot(existing)&&existing.scene.isActive()&&!onlineSession.paused){restoreTimer=setTimeout(attempt,100);return;}
        const role=current.role,other=role==='host'?'player':'host';
        const self=current[role],opponent=current[other];if(!self)return;
        let player1={name:self.name,color:self.color,weapons:[]},player2=opponent?{name:opponent.name,color:opponent.color,weapons:[]}:null;
        const data={gameType:3,player1,player2,hostId:current.hostId,onlineRole:role,draft:current.draft,resumePendingShot:current.pendingShot||undefined};
        if(current.phase==='match'&&current.snapshot?.state?.players){
            const state=current.snapshot.state;
            data.player1={...state.players[role],color:colorNumber(state.players[role].color)};
            data.player2={...state.players[other],color:colorNumber(state.players[other].color)};data.resumeSnapshot=current.snapshot;
        }else if(current.phase==='match'){
            const pool=current.draft?.pool||[],picks=current.draft?.picks||{};
            data.resumeWithoutSnapshot=true;data.draftIds={own:(picks[role]||[]).map(index=>pool[index]),other:(picks[other]||[]).map(index=>pool[index])};
        }
        for(const scene of game.scene.getScenes(false)){
            if(scene.sceneData?.gameType===3||scene.sys.settings.key==='loading-scene'||scene.sys.settings.key==='scene-1')game.scene.stop(scene.sys.settings.key);
        }
        pendingRestore=null;onlineSession.paused=false;onlineSession.restoring=false;onlineSession.restored=true;onlineSession.restoreKey=current.restoreKey;hideOverlay();
        if(current.snapshot)snapshotApplied(current.snapshot);
        const key=current.phase==='match'?'main-scene':current.phase==='draft'?'scene-5':'scene-4';game.scene.start(key,data);
        const active=game.scene.getScene(key);if(active?.input?.keyboard)active.input.keyboard.enabled=true;
    };attempt();
};
const updatePresence=session=>{
    if(session.roomId!==onlineSession.roomId)return;
    // Presence replies cannot replace the canonical snapshot, turn or a local
    // reconnect operation. They may have been queued before a completed shot.
    for(const key of ['host','player','opponentAvailable','waitingForOpponent'])if(key in session)onlineSession[key]=session[key];
    saveMembership(onlineSession);
};
export const installOnlineSession=socket=>{
    socketRef=socket;
    handlers('roomSession',session=>{
        if(session.sessionId&&session.sessionId!==(onlineSession.sessionId||getOnlineSessionId()))return;
        if(onlineSession.roomId&&session.roomId!==onlineSession.roomId&&session.resumed)return;
        if(session.matchId===onlineSession.matchId&&session.snapshot?.savedAt&&onlineSession.snapshot?.savedAt>session.snapshot.savedAt)return;
        const running=activeOnlineScene();
        if(session.phase==='match'&&session.matchId===onlineSession.matchId&&running?.scene.isActive()&&hasUnsettledShot(running)&&!onlineSession.paused&&!onlineSession.restoring){updatePresence(session);return;}
        if(!session.paused)resumeRequested=false;
        const key=`${session.roomId}:${session.matchId||''}:${session.phase}:${session.snapshot?.savedAt||0}:${session.pendingShot?.shotId||''}:${JSON.stringify(session.draft?.picks||{})}`;
        const active=activeOnlineScene();
        const alreadyRestored=onlineSession.restoreKey===key&&!onlineSession.paused&&active?.scene.isActive();
        const shouldRestore=(session.resumed||onlineSession.restoring)&&!alreadyRestored&&!onlineSession.parked;
        if(onlineSession.roomId!==session.roomId||onlineSession.matchId!==session.matchId)resetCheckpointTracking();
        Object.assign(onlineSession,session);socket.playerId=session.playerId;socket.onlineRole=session.role;saveMembership(onlineSession);
        if(session.snapshot?.state&&!failedCheckpoint){onlineSession.persistenceStatus='saved';onlineSession.persistenceMessage='';}
        if(shouldRestore&&(failedCheckpoint?.roomId===session.roomId||inFlightCheckpoint?.roomId===session.roomId)){
            const recovery=inFlightCheckpoint?.roomId===session.roomId?inFlightCheckpoint.promise:retryFailedCheckpoint({force:true});
            recovery?.then(result=>{if(!result.ok&&!result.stale)showOverlay('This completed turn has not been saved yet. Retrying…');});
        }
        else if(shouldRestore)restoreWhenReady({...session,restoreKey:key});
        else if(alreadyRestored){onlineSession.restoring=false;hideOverlay();}
        else if(session.paused&&!onlineSession.parked)pauseOnline('Your browser is in the background. Return when you are ready.');
    });
    handlers('roomState',session=>updatePresence(session));
    handlers('matchCheckpoint',data=>{
        if(data.roomId!==onlineSession.roomId||!data.snapshot)return;
        if(data.matchId&&onlineSession.matchId&&data.matchId!==onlineSession.matchId)return;
        const snapshot=data.snapshot;
        if(!canApplyCheckpoint(snapshot,lastApplied))return;
        if(pendingCheckpoint&&(Number(snapshot.savedAt)||0)<=(Number(pendingCheckpoint.savedAt)||0))return;
        pendingCheckpoint=snapshot;
        if(data.matchId)onlineSession.matchId=data.matchId;if(data.turn)onlineSession.turn=data.turn;
        onlineSession.pendingShot=data.pendingShot||null;
        onlineSession.snapshot=snapshot;
        const scene=activeOnlineScene();if(scene)processOnlineSession(scene);
    });
    const endLocalSession=message=>{
        const game=window.game,scene=activeOnlineScene();forgetMembership();game?.registry?.set('onlineResumeNotice',message);
        if(game?.textures?.exists('wall')){if(scene)game.scene.stop(scene.sys.settings.key);game.scene.start('scene-1');}
    };
    handlers('sessionReplaced',data=>{
        if(!matchesMembership(data,onlineSession))return;
        onlineSession.replaced=true;saveMembership(onlineSession);
        pauseOnline('This match is open in another tab. Use Resume Match here to continue in this tab.');
    });
    handlers('disconnect',()=>{if(onlineSession.roomId){saveMembership(onlineSession);if(!onlineSession.parked)pauseOnline('Connection lost. Reconnecting to your saved match…');}});
    handlers('connect',()=>{socket.auth={...(socket.auth||{}),sessionId:onlineSession.sessionId||getOnlineSessionId()};if(onlineSession.roomId)socket.emit(resumeRequested?'resumeSession':'requestRoomSession',{roomId:onlineSession.roomId});});
    handlers('sessionPaused',data=>{
        if(data.roomId!==onlineSession.roomId)return;
        if(data.role===onlineSession.role){onlineSession.backgrounded=true;if(!onlineSession.parked)pauseOnline('Your browser is in the background. Return when you are ready.');}
        else onlineSession.opponentAvailable=false;
    });
    handlers('sessionResumed',data=>{
        if(data.roomId!==onlineSession.roomId)return;
        if(data.role===onlineSession.role){onlineSession.backgrounded=false;if(!onlineSession.parked){onlineSession.restoring=true;socket.emit('requestRoomSession');}}
        else onlineSession.opponentAvailable=true;
    });
    handlers('startPick',()=>{resetCheckpointTracking();onlineSession.phase='draft';saveMembership(onlineSession);});
    handlers('playAgain',()=>{resetCheckpointTracking();onlineSession.phase='draft';saveMembership(onlineSession);});
    handlers('startGame',data=>{if(data?.matchId){if(onlineSession.matchId!==data.matchId)resetCheckpointTracking();onlineSession.matchId=data.matchId;onlineSession.turn=data.turn;onlineSession.pendingShot=data.pendingShot||null;onlineSession.phase='match';saveMembership(onlineSession);}});
    handlers('opponentLeft',data=>{if(!matchesMembership(data,onlineSession))return;hideOverlay();onlineSession.paused=false;onlineSession.restoring=false;const scene=activeOnlineScene();if(scene){scene.input.keyboard.enabled=true;scene.scene.resume();}forgetMembership();});
    handlers('sessionUnavailable',error=>{
        if(!matchesMembership(error,onlineSession))return;
        if(isDefinitiveSessionLoss(error,onlineSession))endLocalSession(error.message||'Your saved match is no longer available.');
        else{saveMembership(onlineSession);pauseOnline(error?.message||'Your room could not be reached. Use Resume Match to retry.');}
    });
    handlers('roomError',error=>{if(error?.code==='PERSISTENCE_UNAVAILABLE'){onlineSession.persistenceStatus='error';onlineSession.persistenceMessage=error.message||'Saving is temporarily unavailable.';}console.info('Online room:',error?.message||'That action is unavailable.');});

    const originalEmit=socket.emit.bind(socket);
    socket.emit=(event,...args)=>{
        if(['leaveRoom','deleteRoom'].includes(event))forgetMembership();
        if(['shoot','weaponPick','randomWeaponPick','randomWeapons','randomAllWeapons','ready','stepLeft','stepRight','angleChange','powerChange','weaponChange'].includes(event)&&(!socket.connected||onlineSession.paused||onlineSession.restoring||onlineSession.parked))return socket;
        return originalEmit(event,...args);
    };
    setInterval(()=>{if(onlineSession.roomId&&socket.connected)saveMembership(onlineSession);},30000);
    setInterval(()=>{if(!document.hidden&&!onlineSession.parked)retryFailedCheckpoint();},1500);
    document.addEventListener('visibilitychange',()=>{
        const scene=activeOnlineScene();if(!onlineSession.roomId||onlineSession.parked)return;
        if(document.hidden){
            saveMembership(onlineSession);if(scene?.activeTank===1)saveOnlineMatch(scene,{force:true});
            onlineSession.backgrounded=true;if(socket.connected)socket.emit('suspendSession');pauseOnline('Your browser is in the background. Return when you are ready.');
        }else if(socket.connected){onlineSession.backgrounded=false;socket.emit('resumeSession');}
        else socket.connect();
    });
};
