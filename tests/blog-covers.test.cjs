// Run with: node tests/blog-covers.test.cjs (no dependencies or build step).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const helpers = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'blog-covers.js'), 'utf8').replace(/^export /gm, ''), Object.assign(helpers, { URL }));
const {safeImageUrl, createImageFieldReader, renderCoverTitle, bindCoverFallbacks, renderImageAttribution} = helpers;
const coverUrl = 'https://images.example.test/cover.jpg?x=1&y=2';
assert.equal(safeImageUrl('  ' + coverUrl + '  '), coverUrl);
for (const invalid of ['', null, 2, 'javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.test/a.jpg', 'https://user:secret@example.test/a.jpg', '/cover.jpg']) {
    assert.equal(safeImageUrl(invalid), '', `Unsafe URL accepted: ${invalid}`);
}
const readFields = createImageFieldReader(['Image Status', 'Image Source URL', 'Title', 'Image URL', 'Image', ' Image Source '].map(label => ({label})));
const imageFields = readFields(['Matched', 'https://source.example.test/item', 'Test', coverUrl, '#N/A', 'Source & Library'].map(v => ({v})));
assert.equal(imageFields.imageUrl, coverUrl);
assert.equal(imageFields.imageSource, 'Source & Library');
assert.equal(imageFields.imageStatus, 'Matched');
assert.equal(createImageFieldReader([{label:'Title'}])([{v:'Book'}]).imageUrl, '');
assert.equal(readFields([]).imageUrl, '');
const markup = renderCoverTitle({id: 3, title: 'A <book> "quote"', ...imageFields});
assert.match(markup, /type="button"/);
assert.match(markup, /alt=""/);
assert.match(markup, /loading="lazy"/);
assert.match(markup, /referrerpolicy="no-referrer"/);
assert.match(markup, /A &lt;book&gt; &quot;quote&quot;/);
assert.match(markup, /x=1&amp;y=2/);
assert.doesNotMatch(renderCoverTitle({id:1, title:'No cover'}), /<img/);
assert.match(renderCoverTitle({id:1, title:'No cover'}), /blog-cover-placeholder/);
assert.doesNotMatch(renderCoverTitle({id:1, title:'Unsafe', imageUrl:'javascript:alert(1)'}), /<img/);
assert.match(renderImageAttribution(imageFields), /Source &amp; Library/);
assert.match(renderImageAttribution(imageFields), /rel="noopener noreferrer"/);
assert.equal(renderImageAttribution({imageSource: 'No image'}), '');
assert.match(renderImageAttribution({...imageFields, imageSource:'TVMaze'}), /TVMaze data: CC BY-SA/);
assert.doesNotMatch(renderImageAttribution({...imageFields, imageSourceUrl: 'javascript:alert(1)'}), /<a/);
const commonsCredit = renderImageAttribution({...imageFields, imageAttribution:'Alan Light & <creator>', imageLicense:'CC BY-SA 3.0', imageLicenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'});
assert.match(commonsCredit, /Alan Light &amp; &lt;creator&gt;/);
assert.match(commonsCredit, /CC BY-SA 3.0/);
assert.match(commonsCredit, /https:\/\/creativecommons.org\/licenses\/by-sa\/3.0\//);
const optionalFields=createImageFieldReader(['Image URL','Image Attribution','Image License','Image License URL'].map(label=>({label})))([coverUrl,'Alan Light','CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0/'].map(v=>({v})));
assert.equal(optionalFields.imageAttribution,'Alan Light');
assert.equal(optionalFields.imageLicense,'CC BY-SA 3.0');
assert.equal(optionalFields.imageLicenseUrl,'https://creativecommons.org/licenses/by-sa/3.0/');
assert.match(renderImageAttribution(optionalFields), /Alan Light/);
const images = [
    {complete:true, naturalWidth:0, addEventListener(type, fn){this.error=fn;}},
    {complete:true, naturalWidth:32, addEventListener(type, fn){this.error=fn;}},
    {complete:false, naturalWidth:0, addEventListener(type, fn){this.error=fn;}}
];
bindCoverFallbacks({querySelectorAll(){return images;}});
assert.equal(images[0].hidden,true);
assert.notEqual(images[1].hidden,true);
assert.notEqual(images[2].hidden,true);
images[2].error();
assert.equal(images[2].hidden,true);

function element() {
    const classes = new Set();
    let innerHTML='', text='';
    return {style:{}, dataset:{}, children:[],
        get innerHTML(){return innerHTML;}, set innerHTML(value){innerHTML=value;},
        get textContent(){return text;}, set textContent(value){text=String(value);innerHTML=text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));},
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
        focus(){}, addEventListener(){}, querySelectorAll(){return [];}
    };
}
async function testPage(file,noun,expectedGid) {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
        .replace(/^\s*import .*$/gm,'')
        .replace(/^\s*fetchSheetData\(\);\s*$/gm,'')
        .replace(/^\s*setInterval\(fetchSheetData,.*$/gm,'')
        .replace(/^\s*initSocialIcons\(\);\s*$/gm,'');
    const elements=new Map();
    const document={body:element(),createElement:element,querySelectorAll(){return [];},addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
    const context = vm.createContext({...helpers, document, console:{error(){}}, URL});
    vm.runInContext(script,context);
    const run = code => vm.runInContext(code,context);
    const base = noun==='game' ? ['Title','Rating','Review Date','Review'] : ['Title','Rating','Year','Creator','Review Date','Review'];
    const cells= noun==='game' ? ['Alpha',8,'11/4/2026','A review'] : ['Alpha',8,2020,'A creator','11/4/2026','A review'];
    const data={status:'ok',table:{cols:[...base,'Image URL','Image','Image Source','Image Source URL','Image Status'].map(label=>({label})),rows:[{c:[...cells,coverUrl,null,'Test source','https://source.example.test/item','Matched'].map(v=>({v}))}]}};
    const response = value => ({ok:true,text:async()=>`google.visualization.Query.setResponse(${JSON.stringify(value)});`});
    let fetchedUrl;
    context.fetch = async url=>{fetchedUrl=url; return response(data);};
    await run('fetchSheetData()');
    assert.ok(fetchedUrl.includes('gid='+expectedGid), file+' gid');
    assert.ok(fetchedUrl.includes('headers=1'), file+' header contract');
    const collection = noun==='film'?'allFilms':noun==='book'?'allBooks':'allGames';
    assert.equal(run(collection+'[0].imageUrl'), coverUrl);
    assert.match(document.getElementById('content').innerHTML,/blog-cover-image/);
    assert.match(document.getElementById('content').innerHTML,/Alpha/);
    run('currentSearch="nothing matches"; renderTable()');
    assert.doesNotMatch(document.getElementById('content').innerHTML,/<img/);
    run('currentSearch="Alpha"; renderTable()');
    assert.match(document.getElementById('content').innerHTML,/blog-cover-image/);
    run(`openModal(${collection}[0])`);
    assert.equal(document.getElementById('modal-title').textContent,'Alpha');
    assert.match(document.getElementById('modal-meta').innerHTML,/Cover source/);
    assert.equal(document.body.style.overflow,'hidden');
    run('closeModal()');
    assert.equal(document.body.style.overflow,'');
    // A stale fetch must not replace a newer search/tab refresh.
    let finishOld;
    context.fetch=()=>new Promise(resolve=>{finishOld=resolve;});
    const old=run('fetchSheetData()');
    const newer=JSON.parse(JSON.stringify(data));
    newer.table.rows[0].c[0].v='Newer';
    context.fetch=async()=>response(newer);
    if(noun==='film')run("currentType='tv'");
    await run('fetchSheetData()');
    finishOld(response(data));
    await old;
    assert.equal(run(collection+'[0].title'),'Newer');
    // Missing image fields leave existing reviews fully functional.
    context.fetch=async()=>response({status:'ok',table:{cols:base.map(label=>({label})),rows:[{c:cells.map(v=>({v}))}]}});
    await run('fetchSheetData()');
    assert.equal(run(collection+'[0].imageUrl'),'');
    assert.doesNotMatch(document.getElementById('content').innerHTML,/<img/);
    context.fetch=async()=>({ok:false,status:503});
    await run('fetchSheetData()');
    assert.match(document.getElementById('content').innerHTML,/Unable to load/);
}
(async()=>{
    await testPage('filmtv.html','film','577417898');
    await testPage('reading.html','book','1684786692');
    await testPage('games.html','game','1604154728');
    console.log('PASS: image header mapping, safe URLs and escaping, lazy loading, missing/broken fallback, source credit, all three blog pages, search, modal open/close, stale response protection, and HTTP failures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
