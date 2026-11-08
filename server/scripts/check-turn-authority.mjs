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
const require=createRequire(new URL('../../client/package.json',import.meta.url)),{io:connect}=require('socket.io-client');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-turn-authority-')),filename=path.join(directory,'rooms.json'),sockets=[];
const identities={host:randomUUID(),player:randomUUID()};let running,host,player,roomId,matchId;
const event=(socket,name,predicate=()=>true)=>new Promise((resolve,reject)=>{
 const listener=data=>{if(!predicate(data))return;clearTimeout(timer);socket.off(name,listener);resolve(data);};
 const timer=setTimeout(()=>{socket.off(name,listener);reject(Error(`Timed out waiting for ${name}`));},3000);socket.on(name,listener);
});
const ack=(socket,name,data={})=>new Promise((resolve,reject)=>socket.timeout(2000).emit(name,data,(error,result)=>error?reject(error):resolve(result)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=value=>JSON.parse(JSON.stringify(value));
const room=()=>running.controller.rooms.get(roomId);
const start=async()=>{const server=http.createServer(),io=new Server(server),controller=mainsocket(io,{storagePath:filename,random:()=>.4});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});running={server,io,controller,url:`http://127.0.0.1:${server.address().port}`};};
const stop=async()=>{if(!running)return;running.controller.dispose();await new Promise(resolve=>running.io.close(resolve));running.server.close();running=null;};
const client=async(role,resume=false)=>{const socket=connect(running.url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId:identities[role]}});sockets.push(socket);const ready=event(socket,resume?'roomSession':'connect');socket.connect();return {socket,data:await ready};};
const state=(number,activeRole)=>({version:1,matchId,turnNumber:number,activeRole,gameOver:false,players:{host:{name:'Host',weapons:[{id:70},{id:180},{id:31}]},player:{name:'Guest',weapons:[{id:180},{id:70},{id:31}]}},terrainMask:{version:2,runs:[100],values:[1]}});
const shot=(number,id=randomUUID(),idMatch=matchId)=>({matchId:idMatch,turnNumber:number,shotId:id,selectedWeapon:0,power:40,rotation:1,rotation1:0,rotation2:0,position1:{x:300,y:349},position2:{x:720,y:349}});
const save=(socket,value,completedShotId)=>ack(socket,'saveMatch',{matchId,state:value,completedShotId});
const beginRound=async()=>{const pool=event(player,'draftState');host.emit('createWeaponArray',{count:20,max:770});await pool;await ack(host,'randomAllWeapons');await ack(player,'randomAllWeapons');const started=event(host,'startGame');host.emit('ready');player.emit('ready');const metadata=await started;matchId=metadata.matchId;assert.deepEqual(metadata.turn,{number:0,activeRole:'host',pendingShotId:null});return metadata;};
try{
 await start();host=(await client('host')).socket;player=(await client('player')).socket;
 const membership=event(host,'roomSession');await ack(host,'createRoom',{player:{name:'Host'}});roomId=(await membership).roomId;await ack(player,'joinRoom',{roomId,name:'Guest'});await beginRound();
 let forwarded=0;player.on('opponentShoot',()=>forwarded++);
 assert.equal((await ack(player,'shoot',shot(0))).code,'NOT_YOUR_TURN','guest fired before first canonical checkpoint');
 assert.equal((await ack(host,'shoot',shot(0))).code,'CHECKPOINT_REQUIRED');
 assert.equal((await ack(host,'shoot',shot(0,randomUUID(),randomUUID()))).code,'STALE_MATCH');
 assert.equal((await save(host,state(0,'host'))).ok,true);
 assert.equal((await save(host,state(0,'player'))).code,'INVALID_TURN_OWNER','idle save changed owner');
 assert.equal((await save(player,state(1,'host'))).code,'NO_APPROVED_SHOT');
 assert.equal((await save(host,state(1,'player'))).code,'NO_APPROVED_SHOT');
 const first=shot(0),delivered=event(player,'opponentShoot');const accepted=await ack(host,'shoot',first);assert.equal(accepted.ok,true);await delivered;
 assert.equal(room().turn.pendingShot.shotId,first.shotId);assert.equal(JSON.parse(fs.readFileSync(filename,'utf8')).rooms[0].turn.pendingShot.shotId,first.shotId,'shot grant was not durable before ACK');
 assert.equal((await ack(host,'shoot',first)).duplicate,true);assert.equal((await ack(host,'shoot',shot(0))).code,'SHOT_IN_PROGRESS');assert.equal((await ack(player,'shoot',shot(0))).code,'NOT_YOUR_TURN');
 await wait(20);assert.equal(forwarded,1,'repeated shot was relayed more than once');
 let adjustmentRelays=0;player.on('opponentAngleChange',()=>adjustmentRelays++);host.emit('angleChange',{rotation:2});await wait(20);assert.equal(adjustmentRelays,0,'adjustment changed an accepted shot');
 let legacyHandoffs=0;player.on('recieveTurn',()=>legacyHandoffs++);
 const legacy={pos1:{x:300,y:349},pos2:{x:720,y:349},rotation1:0,rotation2:0};assert.equal((await ack(player,'giveTurn',legacy)).code,'LEGACY_HANDOFF_DISABLED');
 assert.equal((await ack(host,'giveTurn',{...legacy,matchId,turnNumber:1,shotId:first.shotId})).code,'LEGACY_HANDOFF_DISABLED');assert.equal(room().turn.activeRole,'host');
 const disconnect=event(player,'sessionPaused');host.disconnect();await disconnect;assert.equal(room().turn.pendingShot.shotId,first.shotId,'transport loss erased accepted shot');
 assert.equal((await save(player,state(1,'host'),first.shotId)).code,'NO_APPROVED_SHOT');
 const reattached=await client('host',true);host=reattached.socket;assert.deepEqual(reattached.data.pendingShot.data,room().turn.pendingShot.data);assert.equal(reattached.data.snapshot.state.turnNumber,0);assert.equal(reattached.data.turn.pendingShotId,first.shotId);
 assert.equal((await ack(host,'shoot',first)).duplicate,true);
 assert.equal((await save(host,state(1,'player'),randomUUID())).code,'NO_APPROVED_SHOT');
 assert.equal((await save(host,state(2,'player'),first.shotId)).code,'INVALID_TURN_NUMBER');
 assert.equal((await save(host,state(1,'host'),first.shotId)).code,'INVALID_TURN_OWNER');
 const badEnd={...state(1,null),gameOver:true};assert.equal((await save(host,badEnd,first.shotId)).code,'INVALID_GAME_OVER');
 const oldTime=room().snapshot.savedAt,realNow=Date.now;let completion;
 try{Date.now=()=>oldTime;completion=await save(host,state(1,'player'),first.shotId);}finally{Date.now=realNow;}
 assert.equal(completion.ok,true);assert.ok(completion.savedAt>oldTime,'checkpoint timestamp did not advance under same clock millisecond');
 assert.equal(room().turn.number,1);assert.equal(room().turn.activeRole,'player');assert.equal(room().turn.pendingShot,null);
 const committedAt=room().snapshot.savedAt;assert.equal((await save(host,state(1,'player'),first.shotId)).duplicate,true);assert.equal(room().snapshot.savedAt,committedAt);
 assert.equal((await save(host,state(0,'host'))).stale,true);
 assert.equal((await ack(host,'shoot',shot(0))).code,'STALE_TURN');assert.equal((await ack(host,'shoot',first)).completed,true);
 assert.equal((await ack(host,'giveTurn',legacy)).code,'LEGACY_HANDOFF_DISABLED');await wait(20);assert.equal(legacyHandoffs,0);assert.equal(room().turn.activeRole,'player');
 const second=shot(1);assert.equal((await ack(player,'shoot',second)).ok,true);
 const persistedPending=clone(room().turn.pendingShot);host.disconnect();player.disconnect();await stop();await start();
 assert.deepEqual(room().turn.pendingShot,persistedPending,'server restart lost accepted-shot replay data');
 const returningHost=await client('host',true),returningPlayer=await client('player',true);host=returningHost.socket;player=returningPlayer.socket;
 assert.equal(returningHost.data.pendingShot.role,'player');assert.equal(returningPlayer.data.pendingShot.shotId,second.shotId);assert.equal(returningPlayer.data.snapshot.state.turnNumber,1);
 assert.equal((await ack(host,'shoot',shot(1))).code,'NOT_YOUR_TURN');assert.equal((await ack(player,'shoot',second)).duplicate,true);
 host.disconnect();assert.equal((await save(player,state(2,'host'),second.shotId)).ok,true,'owner could not complete its approved shot while peer offline');
 const nextHost=await client('host',true);host=nextHost.socket;assert.equal(nextHost.data.turn.number,2);assert.equal(nextHost.data.turn.activeRole,'host');assert.equal(nextHost.data.pendingShot,null);
 assert.equal((await save(host,state(1,'player'),first.shotId)).duplicate,true,'old ACK retry did not deduplicate against committed shot history');assert.equal(room().turn.number,2);
 // A live membership that is temporarily not attached is recoverable, never an absent room.
 const hostTransport=running.io.sockets.sockets.get(host.id);hostTransport.roomRole=null;const unavailable=event(host,'sessionUnavailable');host.emit('requestRoomSession',{roomId});const recoverable=await unavailable;assert.equal(recoverable.definitive,false);assert.equal(recoverable.code,'SESSION_NOT_ATTACHED');assert.equal(recoverable.sessionId,identities.host);hostTransport.roomRole='host';
 // New rounds get a new generation, so old queued packets cannot enter them.
 const priorMatchId=matchId;const replay=event(host,'playAgain');host.emit('playAgainRequest');player.emit('playAgainRequest');await replay;assert.equal(room().phase,'draft');assert.equal(room().turn,null);
 await beginRound();assert.notEqual(matchId,priorMatchId);assert.equal((await ack(host,'shoot',shot(0,randomUUID(),priorMatchId))).code,'STALE_MATCH');assert.equal((await ack(host,'saveMatch',{matchId:priorMatchId,state:state(3,'player'),completedShotId:first.shotId})).code,'STALE_MATCH');
 assert.equal((await save(host,state(0,'host'))).ok,true);
 const originalSave=RoomStore.prototype.save,third=shot(0),before=fs.readFileSync(filename,'utf8');
 try{RoomStore.prototype.save=function(){throw Error('simulated shot reservation write failure');};assert.equal((await ack(host,'shoot',third)).code,'PERSISTENCE_UNAVAILABLE');}finally{RoomStore.prototype.save=originalSave;}
 assert.equal(room().turn.pendingShot,null);assert.equal(fs.readFileSync(filename,'utf8'),before);
 assert.equal((await ack(host,'shoot',third)).ok,true);const beforeCompletion=fs.readFileSync(filename,'utf8');
 try{RoomStore.prototype.save=function(){throw Error('simulated completed-shot write failure');};assert.equal((await save(host,state(1,'player'),third.shotId)).ok,false);}finally{RoomStore.prototype.save=originalSave;}
 assert.equal(room().turn.number,0);assert.equal(room().turn.pendingShot.shotId,third.shotId);assert.equal(room().snapshot.state.turnNumber,0);assert.equal(fs.readFileSync(filename,'utf8'),beforeCompletion);
 assert.equal((await save(host,state(1,'player'),third.shotId)).ok,true);assert.equal(room().turn.activeRole,'player');
 console.log(JSON.stringify({initialOwner:true,acknowledgedShotOnce:true,duplicateRelayBlocked:true,idleOwnerStable:true,wrongRoleOrEpochRejected:true,legacyHandoffDisabled:true,pendingShotReconnect:true,pendingShotRestart:true,exactOneTurnAdvance:true,committedRetriesIdempotent:true,matchGenerationGuard:true,monotonicCheckpointTime:true,recoverableMembershipNotDeleted:true,failedReservationAndCompletionRollback:true}));
}finally{sockets.forEach(socket=>socket.disconnect());await stop();fs.rmSync(directory,{recursive:true,force:true});}
