// Run with: node tests/lifting.test.cjs (no dependencies or build step).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'lifting.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/\s*loadExercises\(\);\s*$/, '');
let intervals = new Map(), intervalId = 0;
const elements = new Map();
function element() {
    const classes = new Set();
    return {style:{}, hidden:false, textContent:'', innerHTML:'', disabled:false, children:[],
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
        addEventListener(){},setAttribute(){},focus(){},appendChild(child){this.children.push(child);}};
}
const document = {body:element(),addEventListener(){},createElement:element,
    querySelector(){return element();},
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
const context = vm.createContext({document,location:{hash:''},window:{addEventListener(){}},console,
    AbortController: class { constructor(){this.signal={aborted:false};} abort(){this.signal.aborted=true;} },
    setTimeout,clearTimeout,setInterval(fn){intervals.set(++intervalId,fn);return intervalId;},clearInterval(id){intervals.delete(id);}});
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
run('routines = buildRoutines(SAVED_LIFTING, SAVED_POSTURE_ABS)');
assert.deepStrictEqual(Array.from(run('[...routines.values()].map(r=>r.length)')), [10,11,11,11]);
assert.strictEqual(run("routines.get('wednesday')[0].name"), '1 minute wall sit (quads)');
assert.strictEqual(run("routines.get('wednesday')[0].time"), 90);
assert.strictEqual(run("routines.get('sunday')[9].name"), 'Include weighted situps on bench (abs, hip flexors)');
assert.deepStrictEqual(Array.from(run("routines.get('monday').map(e=>e.time)")), [90,90,90,null,null,null,null,120,60,null,null]);
assert.strictEqual(run("parseTimeToSeconds(null, null)"), null);
assert.strictEqual(run("parseTimeToSeconds([0,1,30], null)"), 90);
assert.strictEqual(run("parseTimeToSeconds(90/86400, null)"), 90);
assert.strictEqual(run("parseTimeToSeconds('invalid', null)"), null);
assert.throws(()=>run('buildRoutines(SAVED_LIFTING, [])'), /Missing day or phase/);
for(const id of ['sunday','monday','wednesday','thursday']) {
    run(`location.hash='#${id}'; selectDayFromHash(); startWorkout()`);
    assert.strictEqual(intervals.size, 1);
    run('togglePause()');
    [...intervals.values()][0]();
    assert.strictEqual(run('timeRemaining'), 90);
    run('togglePause()');
    [...intervals.values()][0]();
    assert.strictEqual(run('timeRemaining'), 89);
    run('timeRemaining=1');
    [...intervals.values()][0]();
    assert.strictEqual(run('currentExerciseIndex'), 1);
    assert.strictEqual(intervals.size, 1);
    run('prevExercise()');
    assert.strictEqual(run('currentExerciseIndex'), 0);
    while(run("exercises[currentExerciseIndex].phase === 'Lifting'"))run('nextExercise()');
    assert.strictEqual(intervals.size, 0, 'Untimed posture must not auto-advance');
    run('prevExercise()');
    assert.strictEqual(intervals.size, 1, 'Previous restores lifting timer');
    run('nextExercise()');
    const total=run('exercises.length');
    while(run('currentExerciseIndex') < total-1)run('nextExercise()');
    run('nextExercise()');
    assert.strictEqual(intervals.size, 0);
    assert.strictEqual(document.getElementById('workout-progress-fill').style.width, '100%');
    run('stopWorkout()');
    assert.strictEqual(document.body.style.overflow, '');
    run('startWorkout(); location.hash=""; selectDayFromHash()');
    assert.strictEqual(intervals.size, 0, 'Back navigation cancels timer');
    assert.strictEqual(document.getElementById('day-detail').hidden, true);
}
(async()=>{
    context.fetch=async()=>{throw new Error('offline');};
    await run('loadExercises()');
    assert.strictEqual(document.getElementById('routine-status').textContent, '');
    assert.strictEqual(document.getElementById('routine-status').hidden, true);
    assert.strictEqual(run('routines.size'),4);
    context.fetch=async url=>({ok:true,text:async()=>run(`'google.visualization.Query.setResponse('+JSON.stringify({table:{rows:${url.includes('798751319')?'SAVED_POSTURE_ABS':'SAVED_LIFTING'}.map(row=>({c:row.map(v=>({v}))}))}})+');'`)});
    await run('loadExercises()');
    assert.strictEqual(document.getElementById('routine-status').textContent, '');
    assert.strictEqual(document.getElementById('routine-status').hidden, true);
    assert.strictEqual(document.getElementById('routine-status').children.length, 0);
    console.log('PASS: four day mappings, exact labels, duration parsing, pause/resume, timer advance, manual steps, Previous, completion, stop/back cleanup, offline fallback and live loading.');
})().catch(err=>{console.error(err);process.exitCode=1;});
