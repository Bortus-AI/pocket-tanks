import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const roles=['host','player'];
const identityValid=member=>member&&typeof member.sessionId==='string'&&member.sessionId.length>=16&&typeof member.playerId==='string'&&typeof member.name==='string';
const cleanMember=member=>member?Object.fromEntries(Object.entries(member).filter(([key])=>!['socketId','connected','suspended','timer','expiresAt'].includes(key))):null;

// Atomic single-writer store. A corrupt/unrecognized file aborts startup rather
// than replacing somebody's saved matches with an empty collection.
export class RoomStore {
    constructor(filename=null){this.filename=filename?path.resolve(filename):null;}
    load(){
        if(!this.filename)return [];
        let raw;try{raw=fs.readFileSync(this.filename,'utf8');}catch(error){if(error.code==='ENOENT')return [];throw error;}
        let document;try{document=JSON.parse(raw);}catch(error){throw new Error(`Cannot read saved rooms at ${this.filename}; refusing to overwrite corrupt data.`,{cause:error});}
        if(document?.version!==1||!Array.isArray(document.rooms))throw new Error(`Unsupported saved-room format at ${this.filename}; refusing to overwrite it.`);
        const roomIds=new Set(),sessionIds=new Set();
        for(const room of document.rooms){
            if(!room||typeof room.roomId!=='string'||roomIds.has(room.roomId)||!['lobby','draft','match'].includes(room.phase)||!identityValid(room.host)||(room.player&&!identityValid(room.player)))throw new Error(`Invalid saved room in ${this.filename}; refusing to overwrite it.`);
            roomIds.add(room.roomId);
            for(const role of roles){const member=room[role];if(!member)continue;if(sessionIds.has(member.sessionId))throw new Error(`Duplicate saved session in ${this.filename}.`);sessionIds.add(member.sessionId);}
            if(room.draft&&(!Array.isArray(room.draft.pool)||!Array.isArray(room.draft.picks?.host)||!Array.isArray(room.draft.picks?.player)))throw new Error(`Invalid saved draft in ${this.filename}.`);
            if(room.snapshot&&(!room.snapshot.state||!roles.includes(room.snapshot.role)))throw new Error(`Invalid saved checkpoint in ${this.filename}.`);
            if(room.matchId!=null&&typeof room.matchId!=='string')throw new Error(`Invalid saved match identity in ${this.filename}.`);
            if(room.turn){
                const turn=room.turn,pending=turn.pendingShot;
                if(!Number.isInteger(turn.number)||turn.number<0||(!roles.includes(turn.activeRole)&&turn.activeRole!==null))throw new Error(`Invalid saved turn in ${this.filename}.`);
                if(pending&&(!roles.includes(pending.role)||pending.role!==turn.activeRole||pending.turnNumber!==turn.number||pending.matchId!==room.matchId||typeof pending.shotId!=='string'||!pending.data||typeof pending.data!=='object'||!room.snapshot||room.snapshot.state.turnNumber!==turn.number))throw new Error(`Invalid saved pending shot in ${this.filename}.`);
            }
            if(room.completedShots&&!Array.isArray(room.completedShots))throw new Error(`Invalid completed-shot history in ${this.filename}.`);

        }
        fs.chmodSync(this.filename,0o600);
        return document.rooms.map(room=>({...room,host:{...room.host,socketId:null,connected:false,suspended:false,timer:null,expiresAt:null},player:room.player?{...room.player,socketId:null,connected:false,suspended:false,timer:null,expiresAt:null}:null}));
    }
    save(rooms){
        if(!this.filename)return;
        const directory=path.dirname(this.filename);fs.mkdirSync(directory,{recursive:true,mode:0o700});
        const document={version:1,savedAt:Date.now(),rooms:[...rooms].map(room=>({...room,host:cleanMember(room.host),player:cleanMember(room.player)}))};
        const encoded=JSON.stringify(document),temporary=`${this.filename}.${randomUUID()}.tmp`;
        let fd;
        try{
            fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,encoded,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
            fs.renameSync(temporary,this.filename);
            const directoryFd=fs.openSync(directory,'r');try{fs.fsyncSync(directoryFd);}finally{fs.closeSync(directoryFd);}
        }catch(error){if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temporary);}catch{}throw error;}
    }
}
