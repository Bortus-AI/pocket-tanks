// Small shared presentation model. Selection ownership remains on the server.
export const draftInventory = (draft, role, lookup) => (draft?.picks?.[role] || []).map(index => {
    const weapon = lookup[draft.pool[index]];
    return weapon ? {id:weapon.id, name:weapon.name, type:weapon.type} : null;
}).filter(Boolean);

export const draftActions = (draft, role, selectedIndex, {pending=false, paused=false}={}) => {
    const own = draft?.picks?.[role] || [];
    const complete = draft?.picks?.host?.length === 10 && draft?.picks?.player?.length === 10;
    const claimed = [...(draft?.picks?.host || []), ...(draft?.picks?.player || [])];
    const canPick = !!draft && draft.turn === role && !draft.ready?.[role] && !pending && !paused;
    const randomAll = !!draft && own.length < 10 && !draft.ready?.[role] && !pending && !paused;
    const validSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < (draft?.pool?.length || 0);
    return {
        complete,
        select: canPick && validSelection && !claimed.includes(selectedIndex),
        random: canPick,
        randomAll,
        randomRemaining: randomAll,
        continue: complete && !draft.ready?.[role] && !pending && !paused,
    };
};
