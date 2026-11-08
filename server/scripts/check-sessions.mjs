import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import mainsocket from '../socket-io/main.js';
const require=createRequire(new URL('../../client/package.json',import.meta.url));
const {io:connect}=require('socket.io-client');
const event=(socket,name,predicate=()=>true,timeout=3000)=>new Promise((resolve,reject)=>{
    const listener=data=>{if(!predicate(data))return;clearTimeout(timer);socket.off(name,listener);resolve(data);};
    const timer=setTimeout(()=>{socket.off(name,listener);reject(new Error(`Timed out waiting for ${name}`));},timeout);
    socket.on(name,listener);
});
const ack=(socket,name,data={})=>{
    if(name==='saveMatch'){const room=[...controller.rooms.values()][0];data={...data,matchId:data.matchId||room?.matchId,completedShotId:data.completedShotId||(data.state?.turnNumber===room?.turn?.number+1?room.turn.pendingShot?.shotId:undefined)};}
    return new Promise((resolve,reject)=>socket.timeout(2000).emit(name,data,(error,result)=>error?reject(error):resolve(result)));
};
const approve=async socket=>{const room=[...controller.rooms.values()][0];const result=await ack(socket,'shoot',{matchId:room.matchId,turnNumber:room.turn.number,shotId:randomUUID(),selectedWeapon:0,power:40,rotation:1,rotation1:0,rotation2:0,position1:{x:300,y:349},position2:{x:720,y:349}});assert.equal(result.ok,true);return result;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=http.createServer(),io=new Server(server),controller=mainsocket(io,{graceMs:250,random:()=>.37});
const sockets=[];
try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url=`http://127.0.0.1:${server.address().port}`;
    const client=async sessionId=>{
        const socket=connect(url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId}});sockets.push(socket);
        const ready=event(socket,'connect');socket.connect();await ready;return socket;
    };
    const hostSession=randomUUID(),guestSession=randomUUID();
    let host=await client(hostSession),guest=await client(guestSession);
    const hostMembership=event(host,'roomSession');
    assert.equal((await ack(host,'createRoom',{player:{name:'Host',color:0x6eaa99}})).ok,true);
    const created=await hostMembership;
    const guestMembership=event(guest,'roomSession');
    assert.equal((await ack(guest,'joinRoom',{roomId:created.roomId,name:'Guest',color:0xc59a76})).ok,true);
    const joined=await guestMembership;
    assert.equal(created.hostId,joined.hostId);assert.equal(created.role,'host');assert.equal(joined.role,'player');
    const initialDraft=event(guest,'draftState');host.emit('createWeaponArray',{count:20,max:770});
    const initial=await initialDraft;assert.equal(initial.pool.length,20);assert.equal(initial.turn,'host');
    const invalid=event(guest,'roomError');guest.emit('weaponPick',{arrayIndex:0});assert.match((await invalid).message,/turn/);
    assert.equal(controller.rooms.get(created.roomId).draft.picks.player.length,0);
    const firstPick=event(guest,'draftState',d=>d.picks.host.length===1);host.emit('weaponPick',{arrayIndex:0});await firstPick;
    const replay=event(host,'roomError');host.emit('weaponPick',{arrayIndex:0});await replay;
    const partialSnapshot=cloneDraft(controller.rooms.get(created.roomId).draft);
    const pause=event(guest,'sessionPaused');let leftEvents=0;guest.on('opponentLeft',()=>leftEvents++);
    host.disconnect();const disconnected=await pause;assert.equal(disconnected.role,'host');assert.ok(disconnected.expiresAt>Date.now());
    // The guest may take their own draft turn while the host is away.
    const offlinePick=event(guest,'draftState',draft=>draft.picks.player.length===1);guest.emit('weaponPick',{arrayIndex:1});await offlinePick;
    partialSnapshot.picks.player.push(1);partialSnapshot.turn='host';
    const resumedDraft=connect(url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId:hostSession}});sockets.push(resumedDraft);
    const resumedEvent=event(resumedDraft,'roomSession');const peerResumed=event(guest,'sessionResumed');resumedDraft.connect();
    const draftResume=await resumedEvent;await peerResumed;host=resumedDraft;
    assert.equal(draftResume.resumed,true);assert.equal(draftResume.hostId,created.hostId);assert.deepEqual(draftResume.draft.picks,partialSnapshot.picks);
    assert.equal(leftEvents,0);assert.equal(draftResume.paused,false);
    const complete=event(guest,'draftState',d=>d.turn===null);host.emit('randomWeapons',{});guest.emit('randomWeapons',{});
    const full=await complete;assert.equal(full.picks.host.length,10);assert.equal(full.picks.player.length,10);
    assert.equal(new Set([...full.picks.host,...full.picks.player]).size,20,'a shared pool slot was allocated twice');
    const started=event(guest,'startGame');host.emit('ready',{});guest.emit('ready',{});await started;
    const hiddenSelf=event(host,'sessionPaused'),hiddenPeer=event(guest,'sessionPaused');
    host.emit('suspendSession');const hidden=await hiddenSelf;await hiddenPeer;
    assert.equal(hidden.reason,'background');assert.equal(controller.rooms.get(created.roomId).host.suspended,true);
    let selfBlocked=0;guest.on('opponentStepLeft',()=>selfBlocked++);host.emit('stepLeft',{});await wait(20);assert.equal(selfBlocked,0,'suspended browser acted');
    let wrongRoleRelays=0;host.on('opponentStepLeft',()=>wrongRoleRelays++);guest.emit('stepLeft',{});await wait(20);assert.equal(wrongRoleRelays,0,'inactive player acted before first checkpoint');
    const foregroundSelf=event(host,'roomSession'),foregroundPeer=event(guest,'sessionResumed');host.emit('resumeSession');
    const foreground=await foregroundSelf;await foregroundPeer;assert.equal(foreground.paused,false);assert.equal(foreground.host.suspended,false);
    assert.equal(controller.rooms.get(created.roomId).host.timer,null);
    const snapshot={version:1,matchId:controller.rooms.get(created.roomId).matchId,turnNumber:1,activeRole:'player',players:{host:{name:'Host',score:30,weapons:[{id:100}]},player:{name:'Guest',score:20,weapons:[{id:200}]}},terrainMask:{version:2,runs:[100],values:[1]}};
    assert.equal((await ack(host,'saveMatch',{state:{...snapshot,turnNumber:0,activeRole:'host'}})).ok,true);
    await approve(host);
    assert.equal((await ack(host,'saveMatch',{state:snapshot})).ok,true);
    assert.equal((await ack(host,'saveMatch',{state:{...snapshot,players:{...snapshot.players,host:{...snapshot.players.host,score:999}}}})).notTurnOwner,true);
    assert.equal(controller.rooms.get(created.roomId).snapshot.state.players.host.score,30,'inactive peer overwrote an equal-epoch checkpoint');
    assert.equal((await ack(guest,'saveMatch',{state:{...snapshot,turnNumber:0}})).stale,true);
    const pausedMatch=event(guest,'sessionPaused');host.disconnect();await pausedMatch;
    const resumedMatch=connect(url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId:hostSession}});sockets.push(resumedMatch);
    const restored=event(resumedMatch,'roomSession');resumedMatch.connect();const recovery=await restored;host=resumedMatch;
    assert.equal(recovery.phase,'match');assert.equal(recovery.snapshot.role,'host');assert.deepEqual(recovery.snapshot.state,snapshot);
    assert.equal(recovery.playerId,created.playerId);assert.notEqual(recovery.host.socketId,created.host.socketId);
    const refreshed=event(guest,'roomSession');guest.emit('requestRoomSession');const peerCheckpoint=await refreshed;assert.deepEqual(peerCheckpoint.snapshot.state,snapshot);
    assert.equal(peerCheckpoint.resumed,true);
    // A replaced old transport may disconnect later without expiring its successor.
    const replacement=connect(url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId:hostSession}});sockets.push(replacement);
    const replaced=event(replacement,'roomSession');replacement.connect();await replaced;host=replacement;
    await wait(30);assert.equal(controller.rooms.get(created.roomId).host.connected,true);
    const expired=event(host,'opponentLeft',d=>d.reason==='expired');guest.disconnect();await expired;
    assert.equal(controller.rooms.size,0);assert.equal(controller.sessions.size,0);
    const unavailable=event(host,'sessionUnavailable');host.emit('requestRoomSession');await unavailable;
    const staleJoin=event(host,'roomError');host.emit('joinRoom',{roomId:'missing',name:'No room'});assert.match((await staleJoin).message,/no longer/);
    // Disconnect does not retain an explicitly abandoned room.
    const next=event(host,'roomSession');host.emit('createRoom',{player:{name:'New room'}});await next;host.emit('leaveRoom');await wait(30);assert.equal(controller.rooms.size,0);
    console.log(JSON.stringify({draftTurns:true,sharedPoolSlots:20,reconnectDraft:true,reconnectMatch:true,stableIdentity:true,backgroundSuspend:true,blockedSelfSuspendedInputs:true,offlineDraftTurns:true,inactiveInitialPlayerBlocked:true,staleCheckpointRejected:true,inactiveEqualEpochRejected:true,replacementSafe:true,expiry:true,explicitLeave:true}));
} finally {
    sockets.forEach(socket=>socket.disconnect());controller.dispose();await new Promise(resolve=>io.close(resolve));server.close();
}
function cloneDraft(value){return JSON.parse(JSON.stringify(value));}
