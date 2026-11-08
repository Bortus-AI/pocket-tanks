// Real relay/durable store; only the initial shared pool and baseline gate are
// fixture controls. Every draft, shot, reaction and save uses production code.
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import mainsocket from '../../../server/socket-io/main.js';
const require=createRequire(new URL('../../../server/package.json',import.meta.url));
const express=require('express'),{Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2*1024*1024});
app.use(express.static(process.env.CLIENT_BUILD_PATH||fileURLToPath(new URL('../../build',import.meta.url))));
const controller=mainsocket(io,{storagePath:process.env.DEVICE_STORE,graceMs:null});
let baselineReady=process.env.DEVICE_RECOVERED==='1';
io.on('connection',socket=>socket.use((packet,next)=>{
 if(packet[0]==='saveMatch'&&!baselineReady){const ack=packet[packet.length-1];if(typeof ack==='function')ack({ok:false,stale:true,code:'FIXTURE_BASELINE_WAIT'});return;}
 next();
}));
process.on('message',message=>{
 const reply=data=>process.send?.({type:'reply',requestId:message.requestId,data});
 const room=controller.rooms.get(message.roomId);
 if(message.type==='pool'){
  if(!room?.draft||room.draft.picks.host.length||room.draft.picks.player.length)return reply({ok:false,message:'Pool must be configured before any picks'});
  room.draft.pool=message.pool;room.randomArray=message.pool;
  io.to(room.roomId).emit('setWeaponArray',{randomArray:message.pool});io.to(room.roomId).emit('draftState',room.draft);return reply({ok:true});
 }
 if(message.type==='baseline'){baselineReady=true;return reply({ok:true});}
 if(message.type==='duplicateCheckpoint'){
  if(room?.snapshot)io.to(room.roomId).emit('matchCheckpoint',{roomId:room.roomId,matchId:room.matchId,turn:{number:room.turn.number,activeRole:room.turn.activeRole,pendingShotId:null},pendingShot:null,snapshot:room.snapshot});
  return reply({ok:!!room?.snapshot});
 }
 if(message.type==='inspect'){
  const member=value=>value?{connected:value.connected,suspended:value.suspended,playerId:value.playerId}:null;
  return reply(room?{roomId:room.roomId,phase:room.phase,matchId:room.matchId,host:member(room.host),player:member(room.player),draft:room.draft,turn:room.turn,snapshot:room.snapshot,completedShots:room.completedShots}:null);
 }
});
const shutdown=()=>{controller.dispose();io.close(()=>process.exit(0));};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
server.listen(Number(process.env.DEVICE_PORT)||0,'127.0.0.1',()=>process.send?.({type:'ready',port:server.address().port}));
