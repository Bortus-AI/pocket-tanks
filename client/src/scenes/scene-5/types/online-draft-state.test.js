import { draftActions, draftInventory } from './online-draft-state';
const state = () => ({pool:Array.from({length:20},(_,i)=>100+i),picks:{host:[],player:[]},turn:'host',ready:{host:false,player:false},autoPick:{host:false,player:false}});

test('a row must be selected and unclaimed before the Select action becomes available',()=>{
    const draft=state();
    expect(draftActions(draft,'host',null).select).toBe(false);
    expect(draftActions(draft,'host',3).select).toBe(true);
    draft.picks.player=[3];
    expect(draftActions(draft,'host',3).select).toBe(false);
    expect(draftActions(draft,'host',25).select).toBe(false);
});

test('only the current player can select or random-pick; Random All is available on either turn',()=>{
    const draft=state();
    expect(draftActions(draft,'player',2)).toMatchObject({select:false,random:false,randomAll:true,randomRemaining:true,continue:false});
    expect(draftActions(draft,'host',2,{pending:true})).toMatchObject({select:false,random:false,randomAll:false,randomRemaining:false});
    expect(draftActions(draft,'host',2,{paused:true})).toMatchObject({select:false,random:false,randomAll:false,randomRemaining:false});
    draft.autoPick.host=true;
    expect(draftActions(draft,'host',2).randomAll).toBe(true);
    draft.ready.host=true;
    expect(draftActions(draft,'host',2).randomAll).toBe(false);
});

test('Continue is gated on both ten-weapon inventories and disables after ready',()=>{
    const draft=state();draft.picks.host=Array.from({length:10},(_,i)=>i);
    expect(draftActions(draft,'host',null).continue).toBe(false);
    draft.picks.player=Array.from({length:10},(_,i)=>i+10);draft.turn=null;
    expect(draftActions(draft,'host',null)).toMatchObject({continue:true,select:false,random:false,randomAll:false,randomRemaining:false});
    draft.ready.host=true;
    expect(draftActions(draft,'host',null).continue).toBe(false);
});

test('loadouts follow authoritative pool-slot picks and retain weapon type even for duplicate pool IDs',()=>{
    const draft=state();draft.pool=[42,42,99];draft.picks.host=[1];draft.picks.player=[2];
    const lookup={42:{id:42,name:'Shield',type:2},99:{id:99,name:'Digger',type:1}};
    expect(draftInventory(draft,'host',lookup)).toEqual([{id:42,name:'Shield',type:2}]);
    expect(draftInventory(draft,'player',lookup)).toEqual([{id:99,name:'Digger',type:1}]);
    expect(draft.picks.host).toEqual([1]);
});
