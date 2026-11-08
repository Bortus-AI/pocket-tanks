// A saved match has no browser-side expiry. Older 15-minute cache entries are
// migrated on read; the server remains the authority on whether a room exists.
export const normalizeSavedRoom = saved => {
    if(!saved || typeof saved.sessionId!=='string' || !saved.sessionId || typeof saved.roomId!=='string' || !saved.roomId)return null;
    const {expiresAt,...room}=saved;
    return {...room,persistent:true,asynchronous:true};
};

// Delayed replies from an old transport/room must never erase the current room.
export const matchesMembership = (event, session) => Boolean(session?.roomId &&
    (!event?.roomId || event.roomId===session.roomId) &&
    (!event?.sessionId || event.sessionId===session.sessionId));
export const isDefinitiveSessionLoss = (event,session) => Boolean(
    event?.definitive===true && event.roomId===session?.roomId &&
    event.sessionId===session?.sessionId && matchesMembership(event,session) &&
    ['SESSION_NOT_FOUND','ROOM_NOT_FOUND','MATCH_ENDED'].includes(event.code));

export const canApplyCheckpoint = (snapshot, {savedAt=0,turnNumber=-1}={}, localTurn=0) => {
    if(!snapshot?.state?.players || !Array.isArray(snapshot.state.terrainPath))return false;
    const incomingAt=Number(snapshot.savedAt)||0,incomingTurn=Number(snapshot.state.turnNumber)||0;
    if(incomingAt && incomingAt<=savedAt)return false;
    if(incomingTurn<turnNumber || incomingTurn<localTurn)return false;
    return true;
};

export const onlinePresenceText = (session, {activeTank=0,gameOver=false}={}) => {
    if(!session?.roomId)return '';
    if(session.paused || session.restoring)return 'Reconnecting… Your match is saved.';
    if(gameOver)return 'MATCH COMPLETE · Your results are saved.';
    const other=session.role==='host'?session.player:session.host;
    const name=other?.name || 'your opponent';
    if(session.phase==='draft')return session.opponentAvailable===false?`${name} is away. Your weapon picks are saved.`:'';
    if(activeTank===1)return session.opponentAvailable===false?'YOUR TURN · Opponent away. You can play now.':'YOUR TURN';
    if(activeTank===2)return session.opponentAvailable===false?`TURN SAVED · Waiting for ${name}. You can return to the menu.`:`Waiting for ${name}…`;
    return session.waitingForOpponent?`Waiting for ${name}. Your match is saved.`:'';
};

// A match waiting for its host to create the initial terrain has no shot to
// finish. It must still be possible to park that waiting screen.
export const hasUnsettledShot = scene => Boolean(
    scene?.sys?.settings?.key === 'main-scene' && scene.terrain?.path?.length && (
        scene.tank1?.turret?.activeWeapon || scene.tank2?.turret?.activeWeapon ||
        scene.terrain.animate || scene.terrain.blastArray?.length ||
        !scene.tank1?.settled || !scene.tank2?.settled
    )
);
