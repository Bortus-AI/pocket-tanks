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
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const event=(socket,name,predicate=()=>true)=>new Promise((resolve,reject)=>{
 const listener=data=>{if(!predicate(data))return;clearTimeout(timer);socket.off(name,listener);resolve(data);};
 const timer=setTimeout(()=>{socket.off(name,listener);reject(new Error(`Timed out waiting for ${name}`));},3000);socket.on(name,listener);
});
const ack=(socket,name,data={})=>new Promise((resolve,reject)=>socket.timeout(2000).emit(name,data,(error,result)=>error?reject(error):resolve(result)));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-random-all-')),filename=path.join(directory,'rooms.json');
let running,host,guest;const sockets=[];const ids={host:randomUUID(),player:randomUUID()};
const start=async()=>{
 const server=http.createServer(),io=new Server(server),controller=mainsocket(io,{storagePath:filename,random:()=>.43});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 running={server,io,controller,url:`http://127.0.0.1:${server.address().port}`};
};
const stop=async()=>{if(!running)return;running.controller.dispose();await new Promise(resolve=>running.io.close(resolve));running.server.close();running=null;};
const client=async(role,resume=false)=>{
 const socket=connect(running.url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{sessionId:ids[role]}});sockets.push(socket);
 const ready=event(socket,resume?'roomSession':'connect');socket.connect();return {socket,data:await ready};
};
const createDraft=async()=>{
 const membership=event(host,'roomSession');assert.equal((await ack(host,'createRoom',{player:{name:'Host'}})).ok,true);const room=await membership;
 assert.equal((await ack(guest,'joinRoom',{roomId:room.roomId,name:'Guest'})).ok,true);
 const pool=event(guest,'draftState');host.emit('createWeaponArray',{count:20,max:770});await pool;return running.controller.rooms.get(room.roomId);
};
const clone=value=>JSON.parse(JSON.stringify(value));
try {
 await start();host=(await client('host')).socket;guest=(await client('player')).socket;
 let room=await createDraft();const firstRoomId=room.roomId;
 const away=event(host,'sessionPaused');guest.disconnect();await away;
 const before=fs.readFileSync(filename,'utf8'),originalSave=RoomStore.prototype.save;
 try{
  RoomStore.prototype.save=function(){throw Error('simulated Random All write failure');};
  const rejected=await ack(host,'randomAllWeapons');assert.equal(rejected.ok,false);assert.equal(rejected.code,'PERSISTENCE_UNAVAILABLE');
 }finally{RoomStore.prototype.save=originalSave;}
 room=running.controller.rooms.get(firstRoomId);assert.deepEqual(room.draft.picks,{host:[],player:[]});assert.equal(room.draft.turn,'host');assert.equal(fs.readFileSync(filename,'utf8'),before);
 const selected=await ack(host,'randomAllWeapons');assert.deepEqual(selected,{ok:true,selected:10,added:10});
 room=running.controller.rooms.get(firstRoomId);assert.equal(room.draft.picks.host.length,10);assert.equal(room.draft.picks.player.length,0);assert.equal(room.draft.turn,'player');assert.deepEqual(room.draft.ready,{host:false,player:false});
 const chosen=clone(room.draft.picks.host);assert.equal(new Set(chosen).size,10);
 const repeated=await ack(host,'randomAllWeapons');assert.equal(repeated.added,0);assert.deepEqual(room.draft.picks.host,chosen);
 assert.deepEqual(JSON.parse(fs.readFileSync(filename,'utf8')).rooms[0].draft.picks.host,chosen,'Random All acknowledged before durable save');
 host.disconnect();await stop();await start();
 const restoredHost=await client('host',true),restoredGuest=await client('player',true);host=restoredHost.socket;guest=restoredGuest.socket;
 assert.deepEqual(restoredHost.data.draft.picks.host,chosen);assert.deepEqual(restoredGuest.data.draft.picks.player,[]);assert.deepEqual(restoredHost.data.draft.ready,{host:false,player:false});
 // Requesting Random All between turns preserves manual picks on both sides.
 room=await createDraft();assert.equal((await ack(host,'weaponPick',{arrayIndex:0})).ok,true);assert.equal((await ack(guest,'weaponPick',{arrayIndex:1})).ok,true);
 assert.equal(room.draft.turn,'host');assert.equal((await ack(guest,'randomAllWeapons')).added,9);
 assert.deepEqual(room.draft.picks.host,[0]);assert.equal(room.draft.picks.player[0],1);assert.equal(room.draft.picks.player.length,10);assert.equal(room.draft.turn,'host');
 assert.equal((await ack(host,'randomAllWeapons')).added,9);assert.equal(room.draft.picks.host[0],0);assert.equal(room.draft.turn,null);
 const all=[...room.draft.picks.host,...room.draft.picks.player];assert.equal(all.length,20);assert.equal(new Set(all).size,20);assert.deepEqual(room.draft.ready,{host:false,player:false});
 const guestReady=event(host,'draftState',draft=>draft.ready.player);guest.emit('ready');await guestReady;
 assert.equal((await ack(guest,'randomAllWeapons')).ok,false,'confirmed loadout should reject Random All');
 const game=event(host,'startGame');host.emit('ready');await game;assert.equal((await ack(host,'randomAllWeapons')).ok,false,'match phase should reject Random All');
 // A suspended browser cannot select; the visible peer can still fill its own loadout.
 room=await createDraft();const suspended=event(host,'sessionPaused');host.emit('suspendSession');await suspended;
 assert.equal((await ack(host,'randomAllWeapons')).ok,false);assert.deepEqual(room.draft.picks.host,[]);
 assert.equal((await ack(guest,'randomAllWeapons')).selected,10);assert.equal(room.draft.picks.host.length,0);assert.equal(room.draft.turn,'host');
 const resumed=event(host,'roomSession');host.emit('resumeSession');await resumed;assert.equal((await ack(host,'randomAllWeapons')).selected,10);
 // Old queued Random Remaining compatibility only affects a consenting opponent.
 room=await createDraft();const queued=event(host,'draftState',draft=>draft.autoPick.player);guest.emit('randomWeapons');await queued;
 assert.equal(room.draft.picks.player.length,0);assert.equal((await ack(host,'randomAllWeapons')).selected,10);
 assert.equal(room.draft.picks.player.length,10);assert.equal(room.draft.turn,null);assert.deepEqual(room.draft.ready,{host:false,player:false});
 assert.equal(running.controller.storageError,null);
 console.log(JSON.stringify({oneTapOwnTen:true,opponentUntouched:true,manualPicksPreserved:true,betweenTurns:true,repeatIdempotent:true,uniquePoolSlots:20,noAutomaticReadiness:true,confirmedOrMatchRejected:true,selfSuspendedBlocked:true,offlineOpponentAllowed:true,restartDurable:true,failedWriteRollback:true,queuedCompatibility:true}));
} finally {sockets.forEach(socket=>socket.disconnect());await stop();fs.rmSync(directory,{recursive:true,force:true});}
