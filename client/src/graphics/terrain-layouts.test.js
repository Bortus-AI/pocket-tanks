import { TERRAIN_PROFILES, makeTerrainPath, seededTerrainRandom, chooseTankSpawn, pathHeightAt } from './terrain-layouts';

test.each(TERRAIN_PROFILES.map(profile=>[profile.key]))('%s stays playable across 30 seeds with distant level deployment pads',key=>{
 for(let seed=1;seed<=30;seed++){
  const width=1200,height=533,path=makeTerrainPath(width,height,key,seededTerrainRandom(seed));
  expect(path[0].x).toBe(-200);expect(path[path.length-1].x).toBe(width+200);
  expect(path[0].profile).toBe(key);
  path.forEach((point,index)=>{expect(Number.isFinite(point.y)).toBe(true);expect(point.y).toBeGreaterThanOrEqual(height*.24);expect(point.y).toBeLessThanOrEqual(height*.9);if(index)expect(point.x).toBeGreaterThan(path[index-1].x);});
  const a=chooseTankSpawn(path,width,height,1),b=chooseTankSpawn(path,width,height,2);
  expect(b.x-a.x).toBeGreaterThanOrEqual(width*.45);
  [a,b].forEach(spawn=>{expect(Math.abs(pathHeightAt(path,spawn.x-18)-pathHeightAt(path,spawn.x+18))).toBeLessThan(2);expect(spawn.y).toBeGreaterThan(0);expect(spawn.y).toBeLessThan(height);});
 }
});

test('a seed recreates the same path and deployment metadata',()=>{
 expect(makeTerrainPath(1200,533,'badlands',seededTerrainRandom(42))).toEqual(makeTerrainPath(1200,533,'badlands',seededTerrainRandom(42)));
});
test('profiles have distinct center/quarter silhouettes even using the same seed',()=>{
 const shapes=TERRAIN_PROFILES.map(({key})=>{const path=makeTerrainPath(1200,533,key,seededTerrainRandom(19));return [350,600,850].map(x=>Math.round(pathHeightAt(path,x))).join(',');});
 expect(new Set(shapes).size).toBe(TERRAIN_PROFILES.length);
});
test('spawn sectors also remain separated for old paths without metadata',()=>{
 const path=[{x:-200,y:350},{x:1400,y:350}];
 for(let seed=1;seed<=30;seed++){
  const a=chooseTankSpawn(path,1200,533,1,seededTerrainRandom(seed)),b=chooseTankSpawn(path,1200,533,2,seededTerrainRandom(seed+30));
  expect(b.x-a.x).toBeGreaterThanOrEqual(540);
 }
});
test('small and non-multiple widths include a valid endpoint and finite empty-mask fallback',()=>{
 const path=makeTerrainPath(391,260,'plateaus',seededTerrainRandom(9));expect(path.at(-1).x).toBe(591);
 const spawn=chooseTankSpawn([],391,260,1,()=>.5);expect(Number.isFinite(spawn.x)&&Number.isFinite(spawn.y)).toBe(true);
});
