import { randomUUID } from 'node:crypto';
import { RoomStore } from './room-store.js';
import { resetMatchAuthority, ensureMatchAuthority, publicTurn, reserveShot, validateCheckpoint, commitCheckpoint } from './turn-state.js';

const cleanName = value => typeof value === 'string' ? value.trim().slice(0, 24) || 'Player' : 'Player';
const cleanColor = value => Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : 0x6eaa99;
const validSessionId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));

// Room membership belongs to a browser session, not a short-lived socket ID.
// Socket.IO heartbeats can disappear while a phone suspends its browser. Keep
// the slot and durable checkpoint until a deliberate leave. Opponents may take
// their own turn while the other browser is offline.
const mainsocket = (io, options = {}) => {
    const rooms = new Map();
    const sessions = new Map();
    const graceMs = options.graceMs == null ? null : Math.max(10, options.graceMs);
    const store = new RoomStore(options.storagePath ?? null);
    let storageError = null;
    const persist = (client,acknowledge) => {
        try{store.save(rooms.values());storageError=null;return true;}catch(error){
            storageError=error;console.error('Unable to persist online matches:',error.message);
            const problem={code:'PERSISTENCE_UNAVAILABLE',message:'The server could not save this match. Please retry before closing the game.'};
            client?.emit('roomError',problem);if(typeof acknowledge==='function')acknowledge({ok:false,...problem});return false;
        }
    };
    for(const room of store.load()){ensureMatchAuthority(room);rooms.set(room.roomId,room);for(const role of ['host','player'])if(room[role])sessions.set(room[role].sessionId,{roomId:room.roomId,role});}
    if(rooms.size&&!persist())throw storageError;
    const random = options.random || Math.random;
    const publicPlayer = player => player ? {
        name: player.name, color: player.color, playerId: player.playerId,
        socketId: player.socketId, connected: player.connected, suspended: !!player.suspended, pos: player.pos,
    } : null;
    const publicDraft = room => room.draft ? clone(room.draft) : null;
    const available = member => !!member?.connected && !member.suspended;
    const paused = (room,role) => !!room[role]?.suspended;
    const actorAllowed = (client,room) => {const turn=ensureMatchAuthority(room);return room.phase==='match'&&available(room[client.roomRole])&&turn?.activeRole===client.roomRole&&!turn.pendingShot;};
    const roomSession = (room, role, resumed = false) => ({
        sessionId: room[role].sessionId, roomId: room.roomId, role,
        playerId: room[role].playerId, hostId: room.host.playerId,
        host: publicPlayer(room.host), player: publicPlayer(room.player), phase: room.phase,
        draft: publicDraft(room), snapshot: room.snapshot ? clone(room.snapshot) : null,
        matchId:room.matchId||null,turn:publicTurn(room),pendingShot:room.turn?.pendingShot?clone(room.turn.pendingShot):null,
        resumed, paused: paused(room,role), persistent:true, asynchronous:true,
        opponentAvailable:available(room[role==='host'?'player':'host']),
        waitingForOpponent:room.phase==='draft'?(room.draft?.turn?room.draft.turn!==role:room.draft?!!room.draft.ready[role]&&!room.draft.ready[role==='host'?'player':'host']:role!=='host'):room.phase==='match'&&!room.snapshot?.state?.gameOver?(ensureMatchAuthority(room)?.activeRole||'host')!==role:false,
        expiresAt:room[role].expiresAt||null,
    });
    const emitRooms = client => {
        const open = [...rooms.values()].filter(room => !room.player)
            .slice(-5).reverse().map(room => ({roomId:room.roomId,active:false,host:publicPlayer(room.host)}));
        (client || io).emit('setRooms', {rooms:open});
    };
    const emitRoomState = room => {
        for (const role of ['host','player']) {
            const member = room[role];
            if (member?.connected) io.to(member.socketId).emit('roomState', roomSession(room,role));
        }
    };
    const destroyRoom = (room, reason = 'left', client, acknowledge) => {
        if (!rooms.has(room.roomId)) return true;
        rooms.delete(room.roomId);
        if(!persist(client,acknowledge)){rooms.set(room.roomId,room);return false;}
        for (const role of ['host','player']) {
            const member=room[role];if(!member)continue;
            clearTimeout(member.timer);sessions.delete(member.sessionId);
            const socket=io.sockets.sockets.get(member.socketId);
            if(socket){socket.roomId=null;socket.isHost=false;socket.roomRole=null;}
        }
        for(const role of ['host','player']){const member=room[role];if(member?.connected)io.to(member.socketId).emit('opponentLeft',{reason,roomId:room.roomId,sessionId:member.sessionId});}
        io.in(room.roomId).socketsLeave(room.roomId);
        emitRooms();return true;
    };
    const getRoom = client => {
        const room=rooms.get(client.roomId),member=room?.[client.roomRole];
        return member?.sessionId===client.sessionId && member.socketId===client.id ? room : null;
    };
    const sessionUnavailable = (client,requestedRoomId) => {
        const membership=sessions.get(client.sessionId),linked=membership&&rooms.get(membership.roomId),member=linked?.[membership?.role];
        const recoverable=!!member&&member.sessionId===client.sessionId;
        client.emit('sessionUnavailable',{roomId:linked?.roomId||client.roomId||requestedRoomId||null,sessionId:client.sessionId,definitive:!recoverable,
            code:recoverable?'SESSION_NOT_ATTACHED':'SESSION_NOT_FOUND',message:recoverable?'Reconnect this browser to reattach your saved match.':'Your previous room is no longer available.'});
    };
    const fail = (client, message, acknowledge) => {
        const error={message};client.emit('roomError',error);
        if(typeof acknowledge==='function')acknowledge({ok:false,...error});
    };
    const rejectAction = (client,problem,acknowledge) => {
        if(typeof acknowledge==='function')acknowledge(problem);
        client.emit('actionRejected',problem);
    };
    const attach = (client,room,role,resumed=false) => {
        const member=room[role],old=io.sockets.sockets.get(member.socketId);
        clearTimeout(member.timer);member.timer=null;member.expiresAt=null;
        member.socketId=client.id;member.connected=true;member.suspended=false;
        client.roomId=room.roomId;client.roomRole=role;client.isHost=role==='host';
        client.name=member.name;client.color=member.color;
        sessions.set(member.sessionId,{roomId:room.roomId,role});
        client.join(room.roomId);
        // A reconnect may replace a socket that has not reached its timeout yet.
        // Its eventual disconnect must never expire this newly attached slot.
        if(old&&old.id!==client.id){old.roomId=null;old.roomRole=null;old.emit('sessionReplaced',{roomId:room.roomId,sessionId:member.sessionId});old.leave(room.roomId);old.disconnect(true);}
        client.emit('roomSession',roomSession(room,role,resumed));
        if(resumed){client.to(room.roomId).emit('sessionResumed',{roomId:room.roomId,role});emitRoomState(room);}
    };
    const memberFor = (client,name,color) => ({
        sessionId:client.sessionId,playerId:randomUUID(),socketId:client.id,
        name:cleanName(name),color:cleanColor(color),connected:true,suspended:false,pos:null,
        timer:null,expiresAt:null,isReady:false,playAgain:false,
    });
    const emitDraft = room => io.to(room.roomId).emit('draftState',publicDraft(room));
    const availableIndices = draft => {
        const taken=new Set([...draft.picks.host,...draft.picks.player]);
        return draft.pool.map((_,index)=>index).filter(index=>!taken.has(index));
    };
    const pick = (room,role,index) => {
        const draft=room.draft;
        if(!draft||draft.turn!==role||draft.picks[role].length>=draft.pool.length/2||!availableIndices(draft).includes(index))return false;
        draft.picks[role].push(index);
        const other=role==='host'?'player':'host';
        draft.turn=availableIndices(draft).length ? (draft.picks[other].length<draft.pool.length/2?other:role) : null;
        return true;
    };
    const autoDraft = room => {
        const draft=room.draft;if(!draft)return;
        let count=0;
        while(draft.turn&&draft.autoPick[draft.turn]&&count++<draft.pool.length){
            const available=availableIndices(draft);
            pick(room,draft.turn,available[Math.min(available.length-1,Math.floor(random()*available.length))]);
        }
    };
    const createDraft = (room,count,max) => {
        if(room.draft)return;
        const pool=Array.from({length:count},()=>Math.min(max-1,Math.floor(random()*max)));
        room.draft={pool,picks:{host:[],player:[]},turn:'host',ready:{host:false,player:false},autoPick:{host:false,player:false}};
        room.randomArray=pool;
    };
    const reserveUntilDeadline = (room, member) => {
        clearTimeout(member.timer);member.timer=null;member.expiresAt=null;
        if(graceMs===null)return;
        member.expiresAt=Date.now()+graceMs;
        member.timer=setTimeout(()=>{
            if(rooms.has(room.roomId)&&(!member.connected||member.suspended))destroyRoom(room,'expired');
        },graceMs);member.timer.unref?.();
    };
    const connection = client => {
        client.sessionId=validSessionId(client.handshake.auth?.sessionId)?client.handshake.auth.sessionId:randomUUID();
        client.roomId=null;client.roomRole=null;client.isHost=false;
        const membership=sessions.get(client.sessionId),resumable=membership&&rooms.get(membership.roomId);
        if(resumable){attach(client,resumable,membership.role,true);const previousDraft=clone(resumable.draft);autoDraft(resumable);if(persist(client)){if(resumable.draft)emitDraft(resumable);}else resumable.draft=previousDraft;emitRooms();}
        else client.emit('sessionIdentity',{sessionId:client.sessionId});

        client.on('disconnect', reason => {
            const room=getRoom(client);if(!room)return;
            const member=room[client.roomRole];member.connected=false;
            reserveUntilDeadline(room,member);
            io.to(room.roomId).emit('sessionPaused',{roomId:room.roomId,role:client.roomRole,reason,expiresAt:member.expiresAt,persistent:true,asynchronous:true});
            emitRoomState(room);emitRooms();
        });
        client.on('suspendSession',()=>{
            const room=getRoom(client);if(!room)return;
            const member=room[client.roomRole];member.suspended=true;reserveUntilDeadline(room,member);
            io.to(room.roomId).emit('sessionPaused',{roomId:room.roomId,role:client.roomRole,reason:'background',expiresAt:member.expiresAt,persistent:true,asynchronous:true});
            emitRoomState(room);emitRooms();
        });
        client.on('resumeSession',(data={})=>{
            const room=getRoom(client);if(!room)return sessionUnavailable(client,data.roomId);
            const member=room[client.roomRole];member.suspended=false;clearTimeout(member.timer);member.timer=null;member.expiresAt=null;
            client.emit('roomSession',roomSession(room,client.roomRole,true));
            client.to(room.roomId).emit('sessionResumed',{roomId:room.roomId,role:client.roomRole});
            emitRoomState(room);const previousDraft=clone(room.draft);autoDraft(room);if(persist(client)){if(room.draft)emitDraft(room);}else room.draft=previousDraft;emitRooms();
        });
        const leave=()=>{const room=getRoom(client);if(room)destroyRoom(room,'left',client);};
        client.on('leaveRoom',leave);
        client.on('deleteRoom',()=>{const room=getRoom(client);if(room&&client.roomRole==='host')destroyRoom(room,'deleted',client);});
        client.on('getRooms',()=>emitRooms(client));
        client.on('requestRoomSession',(data={})=>{
            const room=getRoom(client);
            if(room)client.emit('roomSession',roomSession(room,client.roomRole,true));
            else sessionUnavailable(client,data.roomId);
        });
        client.on('createRoom',(data={},acknowledge)=>{
            const old=getRoom(client);if(old&&!destroyRoom(old,'left',client,acknowledge))return;
            const member=memberFor(client,data.player?.name,data.player?.color);
            const room={roomId:randomUUID().replace(/-/g,'').slice(0,8),host:member,player:null,phase:'lobby',active:false,draft:null,snapshot:null,terrainPath:null};
            rooms.set(room.roomId,room);if(!persist(client,acknowledge)){rooms.delete(room.roomId);return;}attach(client,room,'host');emitRooms();
            if(typeof acknowledge==='function')acknowledge({ok:true,roomId:room.roomId});
        });
        client.on('joinRoom',(data={},acknowledge)=>{
            const room=rooms.get(data.roomId);
            if(!room||room.player)return fail(client,'This room is no longer available.',acknowledge);
            const old=getRoom(client);if(old===room)return fail(client,'You already own this room.',acknowledge);if(old&&!destroyRoom(old,'left',client,acknowledge))return;
            room.player=memberFor(client,data.name,data.color);room.active=true;room.phase='draft';
            if(!persist(client,acknowledge)){room.player=null;room.phase='lobby';room.active=false;return;}
            attach(client,room,'player');
            io.to(room.roomId).emit('startPick',{host:publicPlayer(room.host),player:publicPlayer(room.player),hostId:room.host.playerId});
            emitRoomState(room);emitRooms();if(typeof acknowledge==='function')acknowledge({ok:true,roomId:room.roomId});
        });
        client.on('createWeaponArray',(data={})=>{
            const room=getRoom(client);if(!room||client.roomRole!=='host'||room.phase!=='draft')return;
            const count=data.count??20,max=data.max;
            if(!Number.isInteger(count)||count<2||count>40||count%2||!Number.isInteger(max)||max<1||max>2000)return fail(client,'Invalid weapon pool.');
            const previousDraft=room.draft,previousPool=room.randomArray;
            createDraft(room,count,max);if(!persist(client)){room.draft=previousDraft;room.randomArray=previousPool;return;}io.to(room.roomId).emit('setWeaponArray',{randomArray:room.draft.pool});emitDraft(room);
        });
        client.on('getWeaponArray',()=>{
            const room=getRoom(client);if(!room?.draft)return;
            client.emit('setWeaponArray',{randomArray:room.draft.pool});client.emit('draftState',publicDraft(room));
        });
        client.on('weaponPick',(data={},acknowledge)=>{
            const room=getRoom(client);
            if(!room||room.phase!=='draft'||!available(room[client.roomRole]))return fail(client,'Resume this browser before choosing a weapon.',acknowledge);
            const previousDraft=clone(room.draft);
            if(!Number.isInteger(data.arrayIndex)||!pick(room,client.roomRole,data.arrayIndex))return fail(client,'Select an available weapon on your turn.',acknowledge);
            autoDraft(room);if(!persist(client,acknowledge)){room.draft=previousDraft;return;}emitDraft(room);if(typeof acknowledge==='function')acknowledge({ok:true});
        });
        client.on('randomWeaponPick',(_,acknowledge)=>{
            const room=getRoom(client);if(!room?.draft||room.phase!=='draft'||!available(room[client.roomRole]))return;
            const previousDraft=clone(room.draft);
            const candidates=availableIndices(room.draft),index=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
            if(!pick(room,client.roomRole,index))return fail(client,'Wait for your turn.',acknowledge);
            autoDraft(room);if(!persist(client,acknowledge)){room.draft=previousDraft;return;}emitDraft(room);if(typeof acknowledge==='function')acknowledge({ok:true});
        });
        client.on('randomWeapons',()=>{
            const room=getRoom(client);if(!room?.draft||room.phase!=='draft')return;
            if(!available(room[client.roomRole]))return;const previousDraft=clone(room.draft);room.draft.autoPick[client.roomRole]=true;autoDraft(room);if(!persist(client)){room.draft=previousDraft;return;}emitDraft(room);
        });
        // Choose the complete remaining loadout now, even between draft turns.
        // This action never opts the opponent into random selection or readiness.
        client.on('randomAllWeapons',(_data={},acknowledge)=>{
            const room=getRoom(client),role=client.roomRole,draft=room?.draft;
            if(!room||room.phase!=='draft'||!draft)return fail(client,'Weapon selection is closed.',acknowledge);
            if(!available(room[role]))return fail(client,'Resume this browser before choosing weapons.',acknowledge);
            if(draft.ready[role])return fail(client,'Your loadout is already confirmed.',acknowledge);
            const quota=draft.pool.length/2,needed=quota-draft.picks[role].length,candidates=availableIndices(draft);
            if(!Number.isInteger(quota)||needed<0||candidates.length<needed)return fail(client,'The weapon pool is unavailable. Please reload this draft.',acknowledge);
            const previousDraft=clone(draft);
            for(let count=0;count<needed;count++){
                const index=Math.min(candidates.length-1,Math.floor(random()*candidates.length));
                draft.picks[role].push(candidates.splice(index,1)[0]);
            }
            const other=role==='host'?'player':'host';
            draft.turn=draft.picks[other].length<quota?other:null;
            // Honor a prior explicit auto-pick request from the other player.
            autoDraft(room);
            if(!persist(client,acknowledge)){room.draft=previousDraft;return;}
            emitDraft(room);
            if(typeof acknowledge==='function')acknowledge({ok:true,selected:room.draft.picks[role].length,added:needed});
        });
        client.on('ready',()=>{
            const room=getRoom(client),draft=room?.draft;
            if(!room||room.phase!=='draft'||!draft||!available(room[client.roomRole])||availableIndices(draft).length)return fail(client,'Finish picking weapons before continuing.');
            const previousDraft=clone(room.draft),previousPhase=room.phase,previousAuthority={matchId:room.matchId,turn:room.turn,completedShots:room.completedShots};
            draft.ready[client.roomRole]=true;
            if(draft.ready.host&&draft.ready.player){room.phase='match';room.host.isReady=false;room.player.isReady=false;resetMatchAuthority(room);}
            if(!persist(client)){room.draft=previousDraft;room.phase=previousPhase;Object.assign(room,previousAuthority);return;}emitDraft(room);
            if(room.phase==='match'){io.to(room.roomId).emit('startGame',{hostId:room.host.playerId,draft:publicDraft(room),matchId:room.matchId,turn:publicTurn(room),pendingShot:null});emitRoomState(room);}
        });
        const relay=(source,target,validate=()=>true,requiresTurn=true)=>client.on(source,(data={})=>{
            const room=getRoom(client);if(!room||!room.player||!available(room[client.roomRole])||(requiresTurn&&!actorAllowed(client,room))||!validate(data))return;
            client.to(room.roomId).emit(target,data);
        });
        client.on('shoot',(data={},acknowledge)=>{
            const room=getRoom(client);if(!room||!available(room[client.roomRole]))return rejectAction(client,{ok:false,code:'SESSION_UNAVAILABLE',message:'Reconnect this browser before firing.'},acknowledge);
            const previous=clone(ensureMatchAuthority(room)),decision=reserveShot(room,client.roomRole,data);
            if(!decision.ok)return rejectAction(client,decision,acknowledge);
            if(decision.duplicate){if(typeof acknowledge==='function')acknowledge({...decision,turn:publicTurn(room)});return;}
            if(!persist(client,acknowledge)){room.turn=previous;return;}
            if(typeof acknowledge==='function')acknowledge({...decision,turn:publicTurn(room)});
            client.to(room.roomId).emit('opponentShoot',{...clone(room.turn.pendingShot.data),matchId:room.matchId,turnNumber:room.turn.number,shotId:decision.shotId,role:client.roomRole});
        });
        relay('weaponChange','opponentWeaponChange',d=>Number.isInteger(d.index)&&d.index>=0);
        relay('angleChange','opponentAngleChange',d=>Number.isFinite(d.rotation));
        relay('powerChange','opponentPowerChange',d=>Number.isFinite(d.power));
        relay('stepLeft','opponentStepLeft');relay('stepRight','opponentStepRight');
        relay('requestTurn','opponentRequestTurn',()=>true,false);
        client.on('terrainPath',(data={})=>{
            const room=getRoom(client);if(!room||!room.player||client.roomRole!=='host'||!Array.isArray(data.path)||data.path.length>4000||!finitePoint(data.hostPos)||!finitePoint(data.playerPos))return;
            const previous={path:room.terrainPath,hostPos:room.host.pos,playerPos:room.player.pos};
            room.terrainPath=clone(data.path);room.host.pos={...data.hostPos};room.player.pos={...data.playerPos};
            if(!persist(client)){room.terrainPath=previous.path;room.host.pos=previous.hostPos;room.player.pos=previous.playerPos;return;}
            client.to(room.roomId).emit('setTerrainPath',{path:room.terrainPath,hostPos:room.host.pos,playerPos:room.player.pos});
        });
        client.on('getTerrainPath',()=>{
            const room=getRoom(client);if(room?.terrainPath)client.emit('setTerrainPath',{path:room.terrainPath,hostPos:room.host.pos,playerPos:room.player?.pos});
        });
        client.on('giveTurn',(_data={},acknowledge)=>{
            // Unversioned handoffs could resurrect a previous turn after resume.
            // Ownership now changes only through an accepted shot checkpoint.
            if(typeof acknowledge==='function')acknowledge({ok:false,code:'LEGACY_HANDOFF_DISABLED',message:'Use the saved match checkpoint for turn ownership.'});
        });
        client.on('saveMatch',(data={},acknowledge)=>{
            const room=getRoom(client);if(!room)return rejectAction(client,{ok:false,code:'SESSION_UNAVAILABLE',message:'Reconnect this browser before saving.'},acknowledge);
            let encoded;try{encoded=JSON.stringify(data.state);}catch{return;}
            if(!encoded||encoded.length>1500000)return rejectAction(client,{ok:false,code:'INVALID_CHECKPOINT',message:'The match checkpoint is unavailable or too large.'},acknowledge);
            const decision=validateCheckpoint(room,client.roomRole,data);
            if(!decision.ok)return rejectAction(client,decision,acknowledge);
            if(decision.kind==='duplicate'){if(typeof acknowledge==='function')acknowledge({ok:true,duplicate:true,savedAt:room.snapshot?.savedAt,matchId:room.matchId,turn:publicTurn(room)});return;}
            const previous={snapshot:room.snapshot,turn:clone(room.turn),completedShots:clone(room.completedShots)},first=!room.snapshot;
            commitCheckpoint(room,client.roomRole,data,decision);
            if(!persist(client,acknowledge)){Object.assign(room,previous);return;}
            if(first||decision.kind==='complete'){
                client.to(room.roomId).emit('matchCheckpoint',{roomId:room.roomId,matchId:room.matchId,turn:publicTurn(room),pendingShot:null,snapshot:clone(room.snapshot)});
                emitRoomState(room);
            }
            if(typeof acknowledge==='function')acknowledge({ok:true,savedAt:room.snapshot.savedAt,matchId:room.matchId,turn:publicTurn(room)});
        });
        client.on('playAgainRequest',()=>{
            const room=getRoom(client);if(!room?.player)return;
            const previousFlag=room[client.roomRole].playAgain;room[client.roomRole].playAgain=true;if(!persist(client)){room[client.roomRole].playAgain=previousFlag;return;}
            if(room.host.playAgain&&room.player.playAgain){
                const previous={phase:room.phase,draft:room.draft,randomArray:room.randomArray,terrainPath:room.terrainPath,snapshot:room.snapshot,lastTurn:room.lastTurn,matchId:room.matchId,turn:room.turn,completedShots:room.completedShots};
                room.phase='draft';room.draft=null;room.randomArray=null;room.terrainPath=null;room.snapshot=null;room.lastTurn=null;room.matchId=null;room.turn=null;room.completedShots=[];room.host.playAgain=false;room.player.playAgain=false;
                if(!persist(client)){Object.assign(room,previous);room.host.playAgain=true;room.player.playAgain=true;return;}
                io.to(room.roomId).emit('playAgain',{});
            }
        });
    };
    io.on('connection',connection);
    const dispose=()=>{io.off('connection',connection);for(const room of rooms.values())for(const role of ['host','player'])clearTimeout(room[role]?.timer);rooms.clear();sessions.clear();};
    io.httpServer?.once('close',dispose);
    return {rooms,sessions,graceMs,storagePath:store.filename,get storageError(){return storageError;},dispose};
};
export default mainsocket;
