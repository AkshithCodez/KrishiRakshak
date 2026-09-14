import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp, smooth, narrativeProgress, stageAt } from '../dashboard/story-timeline.js';
test('scroll input is clamped and desktop progress is unchanged',()=>{
  assert.equal(clamp(-10),0); assert.equal(clamp(10),1);
  for(const p of [0,.08,.16,.25,.35,.48,.60,.70,.78,.87,1]) assert.equal(narrativeProgress(p),p);
});
test('mobile mapping is continuous, monotonic and reaches every required part',()=>{
  let last=0;const stages=new Set();
  for(let i=0;i<=10000;i++){const p=narrativeProgress(i/10000,true);assert.ok(p>=last);assert.ok(p-last<.001);last=p;stages.add(stageAt(p,true));}
  assert.equal(last,1);assert.ok(!stages.has('analysis'));
  for(const stage of ['soil','growth','life','focus','capture','diagnosis','report','hotspot'])assert.ok(stages.has(stage));
});
test('growth is reversible, attached from the start, and full by 25 percent',()=>{
  const up=[0,.08,.12,.18,.25,.5,1].map(p=>smooth(.08,.25,p));
  const down=[1,.5,.25,.18,.12,.08,0].map(p=>smooth(.08,.25,p)).reverse();
  assert.deepEqual(up,down);assert.equal(up[0],0);assert.equal(up[1],0);assert.equal(up[4],1);
  assert.ok(up[2]>0 && up[2]<up[3] && up[3]<1);
});
test('semantic boundaries match the continuous desktop timeline',()=>{
  assert.deepEqual([0,.08,.25,.35,.48,.60,.70,.78,.87].map(p=>stageAt(p)),['soil','growth','life','focus','capture','analysis','diagnosis','report','hotspot']);
});
