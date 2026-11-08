// Real Socket.IO/RoomStore child process for the async browser regression.
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import mainsocket from '../../../server/socket-io/main.js';
const require=createRequire(new URL('../../../server/package.json',import.meta.url));
const express=require('express'),{Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2*1024*1024});
app.use(express.static(process.env.CLIENT_BUILD_PATH||fileURLToPath(new URL('../../build',import.meta.url))));
// A repeatable pool makes the tested real shots reproducible while retaining
// the same authoritative draft and selection protocol used by production.
const pool=[0,30,31,1,70,180,190,140,230,260,320,350,32,33,34,35,36,37,38,39];let draws=0;
const controller=mainsocket(io,{storagePath:process.env.ASYNC_STORE,graceMs:null,random:()=>pool[(draws++)%pool.length]/770+.0000001});
process.on('message',message=>{
 if(message?.type!=='inspect')return;
 const room=controller.rooms.get(message.roomId);
 process.send?.({type:'inspection',requestId:message.requestId,data:room?{roomId:room.roomId,phase:room.phase,graceMs:controller.graceMs,
  host:{connected:room.host.connected,expiresAt:room.host.expiresAt},player:room.player?{connected:room.player.connected,expiresAt:room.player.expiresAt}:null,
  draft:room.draft,snapshot:room.snapshot}:null});
});
const shutdown=()=>{controller.dispose();io.close(()=>process.exit(0));};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
server.listen(Number(process.env.ASYNC_PORT)||0,'127.0.0.1',()=>process.send?.({type:'ready',port:server.address().port}));
