/* Repeat the full arsenal audit against a production build. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const artifacts=process.env.CONTRACT_ARTIFACTS||'/tmp/pocket-weapon-contracts';fs.mkdirSync(artifacts,{recursive:true});
const checks=[
 {name:'generated',script:'check-generated-contracts.cjs',env:{ARTIFACT_PREFIX:path.join(artifacts,'generated')},report:path.join(artifacts,'generated.json')},
 {name:'originals and early classics',script:'check-early-contracts.cjs',env:{EARLY_CONTRACT_ARTIFACTS:path.join(artifacts,'early')},report:path.join(artifacts,'early/report.json')},
 {name:'later classics',script:'check-later-contracts.cjs',env:{LATER_CONTRACT_ARTIFACTS:path.join(artifacts,'later')},report:path.join(artifacts,'later/report.json')},
 {name:'native shot lifetimes',script:'check-native-contracts.cjs',env:{ARTIFACT_PREFIX:path.join(artifacts,'native')},report:path.join(artifacts,'native.json')},
 {name:'tether physics and renderers',script:'check-tether-contracts.cjs',env:{TETHER_CONTRACT_ARTIFACTS:path.join(artifacts,'tethers')},report:path.join(artifacts,'tethers/report.json')},
 {name:'Tar Ball renderers',script:'check-tar-ball.cjs',env:{TAR_ARTIFACTS:path.join(artifacts,'tar')},report:path.join(artifacts,'tar/report.json')},
];
(async()=>{
 const reports=[];
 for(const check of checks){
  console.log(`Checking ${check.name}`);
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,check.script)],{env:{...process.env,...check.env},stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${check.name} failed (${code})`)));});
  const result=JSON.parse(fs.readFileSync(check.report,'utf8'));assert.ok(result.passed,`${check.name} did not pass`);reports.push(result);
 }
 const ids=[...reports[0].outcomes,...reports[1].coverage,...reports[2].results].map(w=>w.id).sort((a,b)=>a-b);
 assert.deepEqual(ids,Array.from({length:770},(_,id)=>id),'audit omitted or duplicated canonical weapons');
 const report={passed:true,weapons:ids.length,generatedAssertions:reports[0].perIdAssertions,constructionPairs:reports[0].poisoned.length,drillTrajectories:reports[0].drill.length+reports[0].downward.length,earlyContracts:reports[1].checks.length,laterContracts:reports[2].contracts.length,nativeShots:reports[3].results.length,tetherRendererContracts:reports[4].contracts.length,tetherShots:reports[4].shots.length,tarRenderers:reports[5].report.length,reports:checks.map(c=>({name:c.name,path:c.report}))};
 fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
