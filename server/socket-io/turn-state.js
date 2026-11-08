import { randomUUID } from 'node:crypto';
const roles=['host','player'];
const clone=value=>JSON.parse(JSON.stringify(value));
const error=(code,message)=>({ok:false,code,message});
const tokenValid=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{16,128}$/.test(value);
const finitePoint=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
export const resetMatchAuthority=room=>{
    room.matchId=randomUUID();room.turn={number:0,activeRole:'host',pendingShot:null};room.completedShots=[];
};
export const ensureMatchAuthority=room=>{
    if(room.phase!=='match')return null;
    if(!tokenValid(room.matchId))room.matchId=randomUUID();
    if(!room.turn){const state=room.snapshot?.state;room.turn={number:Number.isInteger(state?.turnNumber)&&state.turnNumber>=0?state.turnNumber:0,activeRole:state?.gameOver?null:roles.includes(state?.activeRole)?state.activeRole:'host',pendingShot:null};}
    if(!Array.isArray(room.completedShots))room.completedShots=[];
    if(room.snapshot?.state)room.snapshot.state.matchId=room.matchId;
    return room.turn;
};
export const publicTurn=room=>{
    const turn=ensureMatchAuthority(room);return turn?{number:turn.number,activeRole:turn.activeRole,pendingShotId:turn.pendingShot?.shotId||null}:null;
};
export const reserveShot=(room,role,data)=>{
    const turn=ensureMatchAuthority(room);
    if(!turn||room.phase!=='match')return error('MATCH_NOT_STARTED','This match has not started.');
    if(data.matchId!==room.matchId)return error('STALE_MATCH','This action belongs to a different match. Refresh your match state.');
    if(!tokenValid(data.shotId)||!Number.isInteger(data.turnNumber))return error('INVALID_SHOT','A shot needs its current turn and a unique action ID.');
    const completed=room.completedShots.find(shot=>shot.shotId===data.shotId&&shot.role===role);
    if(completed)return {ok:true,duplicate:true,completed:true,shotId:data.shotId,matchId:room.matchId,turnNumber:completed.turnNumber};
    if(data.turnNumber!==turn.number)return error('STALE_TURN','The turn changed. Wait for the current match state.');
    if(turn.activeRole!==role)return error('NOT_YOUR_TURN','It is the other player’s turn.');
    if(turn.pendingShot){
        if(turn.pendingShot.shotId===data.shotId&&turn.pendingShot.role===role)return {ok:true,duplicate:true,shotId:data.shotId,matchId:room.matchId,turnNumber:turn.number};
        return error('SHOT_IN_PROGRESS','Your accepted shot is still finishing.');
    }
    const baseline=room.snapshot?.state;
    if(!baseline||baseline.turnNumber!==turn.number||baseline.activeRole!==role)return error('CHECKPOINT_REQUIRED','Save the current position before firing.');
    if(!Number.isInteger(data.selectedWeapon)||data.selectedWeapon<0||!baseline.players?.[role]?.weapons?.[data.selectedWeapon]||!Number.isFinite(data.power)||data.power<1||data.power>100||!Number.isFinite(data.rotation)||!Number.isFinite(data.rotation1)||!Number.isFinite(data.rotation2)||!finitePoint(data.position1)||!finitePoint(data.position2))return error('INVALID_SHOT','The selected weapon or firing position is invalid.');
    const payload=Object.fromEntries(['selectedWeapon','power','rotation','rotation1','rotation2','position1','position2'].map(key=>[key,clone(data[key])]));
    turn.pendingShot={shotId:data.shotId,role,turnNumber:turn.number,data:payload,matchId:room.matchId,acceptedAt:Date.now()};
    return {ok:true,duplicate:false,shotId:data.shotId,matchId:room.matchId,turnNumber:turn.number};
};
export const validateCheckpoint=(room,role,data)=>{
    const turn=ensureMatchAuthority(room),state=data.state;
    if(!turn||room.phase!=='match')return error('MATCH_NOT_STARTED','This match has not started.');
    if(data.matchId!==room.matchId)return error('STALE_MATCH','This checkpoint belongs to a different match.');
    if(!state||!Number.isInteger(state.turnNumber)||state.turnNumber<0||!state.players?.host||!state.players?.player||!Array.isArray(state.players.host.weapons)||!Array.isArray(state.players.player.weapons))return error('INVALID_CHECKPOINT','This checkpoint does not contain both loadouts and its turn.');
    const committed=room.completedShots.find(shot=>shot.shotId===data.completedShotId&&shot.role===role&&shot.completedTurnNumber===state.turnNumber);
    if(committed)return {ok:true,kind:'duplicate',duplicate:true};
    if(state.turnNumber<turn.number)return {...error('STALE_TURN','A newer turn is already saved.'),stale:true};
    if(state.turnNumber===turn.number){
        if(role!==turn.activeRole)return {...error('NOT_YOUR_TURN','Only the current player can update this position.'),stale:true,notTurnOwner:true};
        if(state.activeRole!==turn.activeRole||!!state.gameOver)return error('INVALID_TURN_OWNER','An idle checkpoint cannot pass the turn.');
        if(turn.pendingShot)return error('SHOT_IN_PROGRESS','The accepted shot must finish before another position is saved.');
        if(data.completedShotId)return error('INVALID_SHOT','This turn has no matching completed shot.');
        return {ok:true,kind:'idle'};
    }
    const pending=turn.pendingShot;
    if(!pending||pending.role!==role||data.completedShotId!==pending.shotId)return error('NO_APPROVED_SHOT','This player has no accepted shot to complete.');
    if(state.turnNumber!==turn.number+1)return error('INVALID_TURN_NUMBER','A completed shot advances exactly one turn.');
    const next=role==='host'?'player':'host';
    if(state.activeRole!==(state.gameOver?null:next))return error('INVALID_TURN_OWNER','The completed shot must pass play to the other player.');
    if(state.gameOver&&(state.players.host.weapons.length||state.players.player.weapons.length))return error('INVALID_GAME_OVER','The match still has weapons remaining.');
    return {ok:true,kind:'complete',pending:clone(pending)};
};
export const commitCheckpoint=(room,role,data,decision)=>{
    room.snapshot={state:{...clone(data.state),matchId:room.matchId},role,savedAt:Math.max(Date.now(),(room.snapshot?.savedAt||0)+1)};
    if(decision.kind==='complete'){
        const pending=decision.pending;room.turn.number=data.state.turnNumber;room.turn.activeRole=data.state.activeRole;room.turn.pendingShot=null;
        room.completedShots.push({shotId:pending.shotId,role,turnNumber:pending.turnNumber,completedTurnNumber:data.state.turnNumber,matchId:room.matchId});
        if(room.completedShots.length>40)room.completedShots.splice(0,room.completedShots.length-40);
    }
};
