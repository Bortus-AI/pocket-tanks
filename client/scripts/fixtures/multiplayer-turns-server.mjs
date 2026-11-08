// Independent real relay process, with controlled wire latency/duplication.
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import mainsocket from '../../../server/socket-io/main.js';
const require=createRequire(new URL('../../../server/package.json',import.meta.url));
const express=require('express'),{Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2*1024*1024});
app.use(express.static(process.env.CLIENT_BUILD_PATH||fileURLToPath(new URL('../../build',import.meta.url))));
const pool=[0,30,31,1,70,180,140,230,190,260,320,350,32,33,34,35,36,37,38,39];let draws=0;
const controller=mainsocket(io,{storagePath:process.env.TURNS_STORE,graceMs:null,random:()=>pool[(draws++)%pool.length]/770+.0000001});
const wire=new Map(),timers=new Set(),events=[];
const adapter=io.of('/').adapter,broadcast=adapter.broadcast.bind(adapter);
const schedule=(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);};
adapter.broadcast=(packet,options)=>{
 const event=packet.data?.[0],rule=wire.get(event);if(!rule)return broadcast(packet,options);
 events.push({event,at:Date.now(),rule});
 const copied=JSON.parse(JSON.stringify(packet)),opts={...options,rooms:new Set(options.rooms),except:new Set(options.except)};
 if(rule.delayMs)schedule(()=>broadcast(copied,opts),rule.delayMs);else broadcast(packet,options);
 if(rule.duplicateAfter)schedule(()=>broadcast(copied,opts),rule.duplicateAfter);
};
process.on('message',message=>{
 if(message?.type==='wire'){wire.set(message.event,message.rule||{});process.send?.({type:'reply',requestId:message.requestId,data:true});return;}
 if(message?.type==='staleLegacy'){
  const s=controller.rooms.get(message.roomId)?.snapshot?.state;
  if(s){const own=s.players.host,other=s.players.player;io.to(message.roomId).emit('recieveTurn',{terrainData:s.terrainMask,tactics:s.tactics,pos1:{x:own.x,y:own.y},pos2:{x:other.x,y:other.y},rotation1:own.rotation,rotation2:other.rotation});}
  process.send?.({type:'reply',requestId:message.requestId,data:!!s});return;
 }
 if(message?.type!=='inspect')return;
 const room=controller.rooms.get(message.roomId),member=value=>value?{connected:value.connected,suspended:value.suspended,playerId:value.playerId}:null;
 process.send?.({type:'reply',requestId:message.requestId,data:room?{roomId:room.roomId,phase:room.phase,host:member(room.host),player:member(room.player),draft:room.draft,snapshot:room.snapshot,lastTurn:room.lastTurn,matchId:room.matchId,turn:room.turn,pendingShot:room.pendingShot,completedShots:room.completedShots,events}:null});
});
const shutdown=()=>{for(const timer of timers)clearTimeout(timer);controller.dispose();io.close(()=>process.exit(0));};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
server.listen(Number(process.env.TURNS_PORT)||0,'127.0.0.1',()=>process.send?.({type:'ready',port:server.address().port}));
