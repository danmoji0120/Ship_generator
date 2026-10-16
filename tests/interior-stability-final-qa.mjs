import{execFile}from'node:child_process';import{promisify}from'node:util';import{writeFile}from'node:fs/promises';
const run=promisify(execFile),dir='qa/v1.8.6.2.1';
const steps=[
 ['placement-followup.log','npx',['vitest','run','tests/interior-stability.test.ts','-t','small/medium','--maxWorkers=1']],
 ['build-verified.log','npm',['run','build']],
 ['ui-verified.log','node',['tests/interior-stability-ui.mjs'],{SKIP_NATIVE_MATRIX:'1'}],
 ['memory.log','node',['tests/interior-stability-memory.mjs']],
 ['callbacks.log','node',['tests/interior-stability-callbacks.mjs']],
 ['recovery-browser.log','node',['tests/interior-stability-recovery-browser.mjs']],
 ['bundle.log','node',['tests/interior-stability-harness.mjs','build',process.cwd(),'/tmp/interior-621-after.mjs']],
 ['controls.log','node',['tests/interior-stability-controls.mjs']],
 ['performance.log','node',['tests/interior-stability-performance.mjs']],
 ['profile-before.log','node',['tests/interior-stability-profile.mjs','/tmp/621-before.mjs',`${dir}/orders/BALANCED.json`,`${dir}/before-scoped.cpuprofile.gz`]],
 ['profile-after.log','node',['tests/interior-stability-profile.mjs','/tmp/621-after.mjs',`${dir}/orders/BALANCED.json`,`${dir}/after-scoped.cpuprofile.gz`]]
];
for(const[file,cmd,args,env]of steps.slice(process.env.START_PHASE?steps.findIndex(s=>s[0]===process.env.START_PHASE):0)){console.log('START',file);try{const r=await run(cmd,args,{env:{...process.env,...env},maxBuffer:4*1048576});await writeFile(`${dir}/${file}`,r.stdout+r.stderr);console.log('PASS',file);}catch(e){await writeFile(`${dir}/${file}`,(e.stdout??'')+(e.stderr??'')+String(e));throw e;}}
