import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import mainsocket from '../socket-io/main.js';
import { RoomStore } from '../socket-io/room-store.js';
const require=createRequire(new URL('../../client/package.json',import.meta.url));
const {io:connect}=require('socket.io-client');
const event=(socket,name,predicate=()=>true,timeout=3000)=>new Promise((resolve,reject)=>{
 const listener=data=>{if(!predicate(data))return;clearTimeout(timer);socket.off(name,listener);resolve(data);};
 const timer=setTimeout(()=>{socket.off(name,listener);reject(new Error(`Timed out waiting for ${name}`));},timeout);socket.on(name,listener);
});
const ack=(socket,name,data={})=>{
 if(name==='saveMatch'){const room=[...running.controller.rooms.values()][0];data={...data,matchId:data.matchId||room?.matchId,completedShotId:data.completedShotId||(data.state?.turnNumber===room?.turn?.number+1?room.turn.pendingShot?.shotId:undefined)};}
 return new Promise((resolve,reject)=>socket.timeout(2000).emit(name,data,(error,result)=>error?reject(error):resolve(result)));
};
const approve=async socket=>{const room=[...running.controller.rooms.values()][0];const result=await ack(socket,'shoot',{matchId:room.matchId,turnNumber:room.turn.number,shotId:randomUUID(),selectedWeapon:0,power:40,rotation:1,rotation1:0,rotation2:0,position1:{x:300,y:349},position2:{x:720,y:349}});assert.equal(result.ok,true);return result;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-persistent-rooms-')),filename=path.join(directory,'private','rooms.json');
const sockets=[];let running;
const start=async()=>{
 const server=http.createServer(),io=new Server(server),controller=mainsocket(io,{storagePath:filename,random:()=>.27});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {server,io,controller,url:`http://127.0.0.1:${server.address().port}`};
};
const stop=async()=>{if(!running)return;running.controller.dispose();await new Promise(resolve=>running.io.close(resolve));running.server.close();running=null;};
const client=async(sessionId,resume=false)=>{
 const socket=connect(running.url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId}});sockets.push(socket);
 const promise=event(socket,resume?'roomSession':'connect');socket.connect();return {socket,data:await promise};
};
const snapshot=(turn,activeRole,score=0)=>({version:1,matchId:[...running.controller.rooms.values()].find(room=>room.phase==='match')?.matchId,turnNumber:turn,activeRole,players:{host:{name:'Host',score,weapons:[{id:70}]},player:{name:'Guest',score:0,weapons:[{id:180}]}},terrainPath:[{x:0,y:350},{x:1200,y:350}],terrainMask:{version:2,runs:[10],values:[1]}});
try {
 running=await start();assert.equal(running.controller.graceMs,null,'production default must have no automatic expiry');
 const hostSession=randomUUID(),guestSession=randomUUID();let host=(await client(hostSession)).socket,guest=(await client(guestSession)).socket;
 const initial=event(host,'roomSession');await ack(host,'createRoom',{player:{name:'Host',color:0x6eaa99}});const created=await initial;
 assert.equal(created.persistent,true);assert.equal(created.asynchronous,true);assert.equal(created.expiresAt,null);
 const hostAway=event(guest,'setRooms',data=>data.rooms.some(room=>room.roomId===created.roomId&&!room.host.connected));host.disconnect();await hostAway;
 assert.equal(running.controller.rooms.get(created.roomId).host.timer,null);
 const joining=event(guest,'roomSession');await ack(guest,'joinRoom',{roomId:created.roomId,name:'Guest',color:0xc59a76});const joined=await joining;
 assert.equal(joined.paused,false);assert.equal(joined.opponentAvailable,false,'offline host should not block joining a persistent lobby');
 const rehost=await client(hostSession,true);host=rehost.socket;assert.equal(rehost.data.hostId,created.hostId);
 const pool=event(guest,'draftState');host.emit('createWeaponArray',{count:20,max:770});await pool;
 const durableDraftBeforeFailure=fs.readFileSync(filename,'utf8'),normalSave=RoomStore.prototype.save;
 try{
  RoomStore.prototype.save=function(){throw new Error('simulated draft write failure');};
  const rejected=await ack(host,'weaponPick',{arrayIndex:0});assert.equal(rejected.ok,false);assert.equal(rejected.code,'PERSISTENCE_UNAVAILABLE');
 }finally{RoomStore.prototype.save=normalSave;}
 assert.deepEqual(running.controller.rooms.get(created.roomId).draft.picks.host,[],'failed draft write left an in-memory pick');
 assert.equal(fs.readFileSync(filename,'utf8'),durableDraftBeforeFailure,'failed write damaged prior file');
 const guestAway=event(host,'sessionPaused');guest.disconnect();await guestAway;
 assert.equal((await ack(host,'weaponPick',{arrayIndex:0})).ok,true,'host could not take draft turn while opponent offline');
 const diskDraft=JSON.parse(fs.readFileSync(filename,'utf8'));assert.deepEqual(diskDraft.rooms[0].draft.picks.host,[0],'draft pick acknowledged before durability');
 assert.equal(fs.statSync(filename).mode&0o777,0o600);assert.equal(fs.statSync(path.dirname(filename)).mode&0o777,0o700);
 assert.equal('socketId' in diskDraft.rooms[0].host,false);assert.equal('timer' in diskDraft.rooms[0].host,false);assert.equal('connected' in diskDraft.rooms[0].host,false);
 // Close the entire relay and reload solely from disk; no client JS is involved.
 host.disconnect();await stop();running=await start();
 const restoredRoom=running.controller.rooms.get(created.roomId);assert.ok(restoredRoom);assert.equal(restoredRoom.host.connected,false);assert.equal(restoredRoom.player.connected,false);assert.equal(restoredRoom.host.socketId,null);
 const hostResume=await client(hostSession,true),guestResume=await client(guestSession,true);host=hostResume.socket;guest=guestResume.socket;
 assert.deepEqual(hostResume.data.draft.picks.host,[0]);assert.equal(guestResume.data.playerId,joined.playerId);
 const complete=event(guest,'draftState',state=>state.turn===null);host.emit('randomWeapons',{});guest.emit('randomWeapons',{});await complete;
 const guestReady=event(host,'draftState',state=>state.ready.player);guest.emit('ready',{});await guestReady;
 const readyGuestAway=event(host,'sessionPaused');guest.disconnect();await readyGuestAway;
 const match=event(host,'startGame');host.emit('ready',{});await match;assert.equal(running.controller.rooms.get(created.roomId).phase,'match','offline ready peer prevented match start');
 assert.equal((await ack(host,'saveMatch',{state:snapshot(0,'host')})).ok,true);
 const durableMatchBeforeFailure=fs.readFileSync(filename,'utf8');
 try{
  RoomStore.prototype.save=function(){throw new Error('simulated checkpoint write failure');};
  assert.equal((await ack(host,'saveMatch',{state:snapshot(0,'host',999)})).ok,false);
 }finally{RoomStore.prototype.save=normalSave;}
 assert.equal(running.controller.rooms.get(created.roomId).snapshot.state.turnNumber,0,'failed checkpoint write mutated current state');
 assert.equal(fs.readFileSync(filename,'utf8'),durableMatchBeforeFailure);

 const connectedGuest=await client(guestSession,true);guest=connectedGuest.socket;assert.equal(connectedGuest.data.snapshot.state.turnNumber,0);
 let checkpoints=0;guest.on('matchCheckpoint',()=>checkpoints++);
 assert.equal((await ack(host,'saveMatch',{state:snapshot(0,'host',1)})).ok,true);await wait(20);assert.equal(checkpoints,0,'idle checkpoint unnecessarily broadcast');
 const offlineAgain=event(host,'sessionPaused');guest.disconnect();await offlineAgain;
 await approve(host);
 const completed=snapshot(1,'player',15);assert.equal((await ack(host,'saveMatch',{state:completed})).ok,true,'offline opponent prevented completing owned turn');
 assert.deepEqual(JSON.parse(fs.readFileSync(filename,'utf8')).rooms[0].snapshot.state,completed,'move acknowledged before durability');
 assert.equal((await ack(host,'saveMatch',{state:snapshot(1,'host',999)})).notTurnOwner,true,'previous owner rewrote completed turn');
 host.disconnect();await stop();
 // A save that is older than a day is still a match, not an expired session.
 const oldDocument=JSON.parse(fs.readFileSync(filename,'utf8'));oldDocument.savedAt=Date.now()-48*60*60*1000;oldDocument.rooms[0].snapshot.savedAt=oldDocument.savedAt;fs.writeFileSync(filename,JSON.stringify(oldDocument),{mode:0o600});
 running=await start();const guestReturns=await client(guestSession,true);guest=guestReturns.socket;
 assert.deepEqual(guestReturns.data.snapshot.state,completed);assert.equal(guestReturns.data.snapshot.role,'host');
 assert.equal(guestReturns.data.paused,false);assert.equal(guestReturns.data.waitingForOpponent,false);assert.equal(guestReturns.data.opponentAvailable,false);
 await approve(guest);
 const guestMove=snapshot(2,'host',25);assert.equal((await ack(guest,'saveMatch',{state:guestMove})).ok,true,'guest could not complete turn while host offline');
 const hostReturns=await client(hostSession,true);host=hostReturns.socket;assert.deepEqual(hostReturns.data.snapshot.state,guestMove);assert.equal(hostReturns.data.snapshot.role,'player');
 assert.equal(hostReturns.data.waitingForOpponent,false);
 const selfHidden=event(guest,'roomSession');guest.emit('suspendSession');guest.emit('requestRoomSession');const hidden=await selfHidden;assert.equal(hidden.paused,true);
 const visibleState=event(host,'roomSession');host.emit('requestRoomSession');const visible=await visibleState;assert.equal(visible.paused,false);assert.equal(visible.opponentAvailable,false);
 const hostStep=event(guest,'opponentStepLeft');host.emit('stepLeft',{});await hostStep;
 let wrongRoleInputs=0;host.on('opponentStepLeft',()=>wrongRoleInputs++);guest.emit('stepLeft',{});await wait(20);assert.equal(wrongRoleInputs,0);
 await approve(host);
 const newTurn=event(guest,'matchCheckpoint',data=>data.snapshot.state.turnNumber===3);assert.equal((await ack(host,'saveMatch',{state:snapshot(3,'player',40)})).ok,true);const broadcast=await newTurn;assert.equal(broadcast.roomId,created.roomId);
 const noTimer=running.controller.rooms.get(created.roomId);assert.equal(noTimer.player.timer,null);assert.equal(noTimer.host.timer,null);assert.equal(noTimer.player.expiresAt,null);
 // Broken JSON is never silently replaced by an empty room store.
 const broken=path.join(directory,'broken.json');fs.writeFileSync(broken,'{unfinished');assert.throws(()=>new RoomStore(broken).load(),/refusing to overwrite corrupt data/);assert.equal(fs.readFileSync(broken,'utf8'),'{unfinished');
 const unsupported=path.join(directory,'unsupported.json');fs.writeFileSync(unsupported,JSON.stringify({version:999,rooms:[]}));assert.throws(()=>new RoomStore(unsupported).load(),/refusing to overwrite/);
 assert.equal(running.controller.storageError,null);
 const deleted=event(host,'opponentLeft');host.emit('leaveRoom',{});await deleted;assert.equal(JSON.parse(fs.readFileSync(filename,'utf8')).rooms.length,0,'explicit deletion was not durable');
 console.log(JSON.stringify({noExpiry:true,offlineLobbyJoin:true,offlineDraft:true,offlineTurns:true,restarts:2,preservedPlayerIds:true,ownedTurnBroadcast:true,noIdleBroadcast:true,checkpointDurableBeforeAck:true,secretFileMode:'0600',corruptionProtected:true,failedWriteRollback:true,explicitDeletionDurable:true}));
} finally {
 sockets.forEach(socket=>socket.disconnect());await stop();fs.rmSync(directory,{recursive:true,force:true});
}
