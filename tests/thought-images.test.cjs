const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const helpers = {URL};
vm.runInNewContext(fs.readFileSync(path.join(root,'blog-covers.js'),'utf8').replace(/^export /gm,''),helpers);
const entries=JSON.parse(fs.readFileSync(path.join(root,'thought-images.json'),'utf8'));
assert.equal(entries.length,355);
assert.equal(new Set(entries.map(x=>x.title+'|'+x.date)).size,355);
for(const entry of entries){
 for(const key of ['imageUrl','imageFullUrl']){
  const file=path.join(root,new URL(entry[key]).pathname);
  assert.ok(fs.existsSync(file),file);
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 }
 assert.ok(entry.imageAlt);
}
assert.equal(new Set(entries.flatMap(x=>[x.imageUrl,x.imageFullUrl])).size,710);
assert.match(helpers.renderThoughtImage(entries[0]),/thought-001.webp/);
assert.doesNotMatch(helpers.renderThoughtImage(entries[0]),/thumb.webp/);
assert.match(helpers.renderThoughtImage({...entries[0],imageAlt:'A "quote" <test>'}),/A &quot;quote&quot; &lt;test&gt;/);
assert.equal(helpers.renderThoughtImage({imageFullUrl:'javascript:alert(1)'}),'');
assert.match(helpers.renderThoughtImage({imageUrl:entries[0].imageUrl}),/thumb.webp/);
function element(){
 let html='',text='';const classes=new Set();
 return {style:{},dataset:{},hidden:false,isConnected:true,children:[],scrollTop:0,
 get innerHTML(){return html},set innerHTML(x){html=x},get textContent(){return text},set textContent(x){text=String(x);html=text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))},
 classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
 focus(){this.focused=true},addEventListener(){},querySelectorAll(){return []},querySelector(){return null},contains(){return true}};
}
const html=fs.readFileSync(path.join(root,'thoughts.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*$/gm,'').replace(/^\s*fetchSheetData\(\);\s*$/gm,'').replace(/^\s*setInterval\(fetchSheetData,.*$/gm,'').replace(/^\s*initSocialIcons\(\);\s*$/gm,'');
const elements=new Map();
const document={body:element(),activeElement:element(),createElement:element,querySelectorAll(){return []},addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}};
const ctx=vm.createContext({...helpers,document,console:{error(){},log(){}}});vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);
const cols=['Title','Date','Full Contents','Image URL','Image','Image Source','Image Source URL','Image Status','Image Attribution','Image License','Image License URL','Image Alt','Image Full URL'];
const row=(entry,date='11/9/2026')=>({c:[entry.title,date,'Unchanged text '+entry.title,entry.imageUrl,null,entry.imageSource,entry.imageSourceUrl,'Matched','','','',entry.imageAlt,entry.imageFullUrl].map(v=>({v}))});
const data={status:'ok',table:{cols:cols.map(label=>({label})),rows:entries.map(x=>row(x))}};
const response=d=>({ok:true,text:async()=>`google.visualization.Query.setResponse(${JSON.stringify(d)});`});
(async()=>{
 let url;ctx.fetch=async u=>{url=u;return response(data)};
 await run('fetchSheetData()');
 assert.ok(url.includes('headers=1'));assert.equal(run('allThoughts.length'),355);
 assert.equal((elements.get('content').innerHTML.match(/blog-cover-image/g)||[]).length,355);
 run('currentSearch="The 3 Big Questions";renderTable()');
 assert.match(elements.get('content').innerHTML,/thought-001-thumb.webp/);
 run('currentSort={field:"thought",order:"desc"};renderTable()');assert.match(elements.get('content').innerHTML,/thought-001-thumb.webp/);
 run('openModal(allThoughts[0])');assert.match(elements.get('thought-image').innerHTML,/thought-001.webp/);assert.equal(elements.get('modal-title').textContent,'The 3 Big Questions');assert.equal(document.body.style.overflow,'hidden');
 run('closeModal()');assert.equal(elements.get('thought-image').innerHTML,'');assert.equal(document.body.style.overflow,'');assert.ok(document.activeElement.focused);
 // Repeated open must not retain previous image; absent metadata remains readable.
 run('openModal(allThoughts[1])');assert.match(elements.get('thought-image').innerHTML,/thought-002.webp/);
 run('openModal({thought:"No image",fullContents:"Still readable"})');assert.equal(elements.get('thought-image').hidden,true);assert.equal(elements.get('modal-content').textContent,'Still readable');run('closeModal()');
 // Failed full-size images hide only the artwork, never the text.
 const failed={complete:true,naturalWidth:0,addEventListener(){}};elements.get('thought-image').querySelector=()=>failed;run('openModal(allThoughts[0])');assert.equal(elements.get('thought-image').hidden,true);assert.match(elements.get('modal-content').textContent,/Unchanged text/);elements.get('thought-image').querySelector=()=>null;run('closeModal()');
 run('currentSearch="no match impossible";renderTable()');assert.match(elements.get('content').innerHTML,/No thoughts found/);run('currentSearch=""');
 // Stale responses cannot overwrite newer successful data.
 let resolveOld;ctx.fetch=()=>new Promise(resolve=>resolveOld=resolve);const old=run('fetchSheetData()');
 const newer={...data,table:{...data.table,rows:[row({...entries[0],title:'Newer'})]}};ctx.fetch=async()=>response(newer);await run('fetchSheetData()');resolveOld(response(data));await old;assert.equal(run('allThoughts[0].thought'),'Newer');
 ctx.fetch=async()=>response({table:{cols:cols.slice(0,3).map(label=>({label})),rows:[{c:['No image','11/9/2026','Body'].map(v=>({v}))}]}});await run('fetchSheetData()');assert.equal(run('allThoughts[0].imageUrl'),'');assert.doesNotMatch(elements.get('content').innerHTML,/<img/);
 ctx.fetch=async()=>({ok:false,status:503});await run('fetchSheetData()');assert.match(elements.get('content').innerHTML,/Unable to load thoughts/);
 console.log('PASS: 355 matched asset pairs, safe image markup, sheet headers, full-size on open, search/sort identity, repeat open/close and focus, broken/missing images, stale responses, HTTP errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
