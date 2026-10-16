/* ============ Admin App: Store + Modules ============ */
const DB_NAME = 'trainhub_admin';
const DB_VER = 1;
const DB_STORE = 'data';

function idbOpen() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej('no-idb');
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const st = tx.objectStore(DB_STORE);
      const r = st.get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    try { return JSON.parse(localStorage.getItem('ah_' + key)); } catch (e2) { return null; }
  }
}

async function idbSet(key, value) {
  try {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const st = tx.objectStore(DB_STORE);
      const r = st.put({ key, value });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    try { localStorage.setItem('ah_' + key, JSON.stringify(value)); } catch (e2) {}
  }
}

async function idbClear() {
  try {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const st = tx.objectStore(DB_STORE);
      const r = st.clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch (e) {}
}

const store = {
  data: null,
  async load() {
    let d = await idbGet('state');
    if (!d) {
      try {
        const res = await fetch('assets/data/seed.json');
        d = await res.json();
      } catch (e) {
        d = { enquiries:[], courses:[], gallery:[], testimonials:[], placements:[], settings:{} };
      }
      await idbSet('state', d);
    }
    this.data = d;
    return d;
  },
  async save() {
    if (this.data) await idbSet('state', this.data);
  },
  get() { return this.data; }
};

function uid(prefix='id') {
  try { return prefix + '_' + crypto.randomUUID(); } catch(e) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2); }
}

function makeSystemId(existing = []) {
  let id;
  do {
    id = 'STU-' + Math.floor(100000 + Math.random() * 900000);
  } while (existing.some(s => s.systemId === id));
  return id;
}

function comboBox({ options = [], placeholder = 'Select', onChange } = {}) {
  const wrap = h(`<div class="combo">
    <input type="text" class="combo-input" autocomplete="off" placeholder="${esc(placeholder)}">
    <div class="combo-list" hidden></div>
  </div>`);
  const input = $('.combo-input', wrap);
  const list = $('.combo-list', wrap);
  let value = '';
  let opts = options.slice();

  function renderList(q) {
    const query = (q || '').trim().toLowerCase();
    const filtered = query ? opts.filter(o => o.label.toLowerCase().includes(query)) : opts;
    list.innerHTML = filtered.length
      ? filtered.map(o => `<div role="option" data-v="${esc(o.value)}"${o.value === value ? ' aria-selected="true"' : ''}>${esc(o.label)}</div>`).join('')
      : '<div class="empty">No matches</div>';
  }
  function open() { list.hidden = false; renderList(input.value); }
  function close() { list.hidden = true; }

  input.addEventListener('focus', open);
  input.addEventListener('input', () => { if (value) { value = ''; } open(); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  list.addEventListener('mousedown', e => {
    const div = e.target.closest('[data-v]');
    if (!div) return;
    e.preventDefault();
    value = div.dataset.v;
    const o = opts.find(x => x.value === value);
    input.value = o ? o.label : '';
    close();
    if (typeof onChange === 'function') onChange(value);
  });

  wrap._combo = {
    get value() { return value; },
    set value(v) {
      value = v || '';
      const o = opts.find(x => x.value === value);
      input.value = o ? o.label : '';
    },
    setOptions(n) { opts = n.slice(); },
    clear() { value = ''; input.value = ''; }
  };
  return wrap;
}

function fmtDate(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString('en-IN'); } catch(e) { return s; }
}

const statusToneMap = { new:'warn', contacted:'ok', closed:'bad', Active:'ok', Invited:'warn', Suspended:'bad', Paid:'ok', Pending:'warn', Refunded:'bad' };

function badge(v) {
  const t = statusToneMap[v] || '';
  return `<span class="badge ${t}">${esc(v||'')}</span>`;
}

async function bootApp() {
  if (typeof requireAuth === 'function' && !requireAuth()) return;
  await store.load();
  const d = store.get();

  // Ensure modules array exists
  if (typeof Modules === 'undefined') window.Modules = [];

  // Dashboard
  if (!Modules.find(m=>m.id==='dashboard')) {
    register({ id:'dashboard', title:'Dashboard', icon:'home', render(el) {
      const courses = d.courses||[];
      const batches = d.batches||[];
      const admissions = d.admissions||[];
      const exams = d.exams||[];
      const results = d.examResults||[];

      const now = new Date();
      const curKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
      const prevD = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const prevKey = prevD.getFullYear()+'-'+String(prevD.getMonth()+1).padStart(2,'0');
      const inMonth = (a,k) => (a.admissionDate||'').slice(0,7)===k;
      const admCur = admissions.filter(a=>inMonth(a,curKey));
      const admPrev = admissions.filter(a=>inMonth(a,prevKey));
      const money = n => Number(n||0);
      const revCur = admCur.reduce((s,a)=>s+money(a.totalFees),0);
      const revPrev = admPrev.reduce((s,a)=>s+money(a.totalFees),0);
      const revenue = admissions.reduce((s,a)=>s+money(a.totalFees),0);
      const pct = (c,p) => p>0 ? Math.round((c-p)/p*100) : (c>0?100:0);
      const activeCourses = courses.filter(c=>c.active).length;
      const enrolled = new Set(admissions.filter(a=>a.name).map(a=>(a.name||'').toLowerCase()+'|'+(a.contactNumber||''))).size;
      const seatsUsed = admissions.filter(a=>a.batchId).length;
      const today = now.toISOString().slice(0,10);
      const upcoming = exams.filter(e=>(e.date||'')>=today).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const recent = [...admissions].sort((a,b)=>(b.admissionDate||'').localeCompare(a.admissionDate||'')).slice(0,5);

      el.append(h(`<div class="stats">${[
          {label:'Students', value:String(enrolled), sub:`${admissions.length} admission${admissions.length===1?'':'s'}`},
        {label:'Admissions', value:String(admissions.length), delta:pct(admCur.length, admPrev.length)},
        {label:'Active Courses', value:String(activeCourses), sub:`${courses.length} total courses`},
        {label:'Batches', value:String(batches.length), sub:`${seatsUsed} seat${seatsUsed===1?'':'s'} filled`},
        {label:'Revenue', value:inr(revenue), delta:pct(revCur, revPrev)}
      ].map(statCard).join('')}</div>`));

      const months = [];
      for (let i=5;i>=0;i--) months.push(new Date(now.getFullYear(), now.getMonth()-i, 1));
      const labels = months.map(mo=>mo.toLocaleString('en-US',{month:'short'}));
      const values = months.map(mo=>{
        const k = mo.getFullYear()+'-'+String(mo.getMonth()+1).padStart(2,'0');
        return admissions.filter(a=>(a.admissionDate||'').slice(0,7)===k).length;
      });

      el.append(h(`<div class="split">
        <div class="card"><h2>Admissions trend · last 6 months</h2>${lineChart({labels,values})}</div>
        <div class="card"><h2>Fee collection by month</h2>${barList(months.map((mo,i)=>{
          const k = mo.getFullYear()+'-'+String(mo.getMonth()+1).padStart(2,'0');
          const v = admissions.filter(a=>(a.admissionDate||'').slice(0,7)===k).reduce((s,a)=>s+money(a.totalFees),0);
          return {label:labels[i], value:v, sub:inr(v)};
        }))}</div>
      </div>`));

      const byCourse = courses
        .map(c=>({label:c.title, value:admissions.filter(a=>a.courseId===c.id).length}))
        .filter(x=>x.value>0).sort((a,b)=>b.value-a.value);

      const gradeOrder=['A+','A','B+','B','C','D','F'];
      const gradeCounts={};
      results.forEach(r=>{ const g=r.grade||'—'; gradeCounts[g]=(gradeCounts[g]||0)+1; });
      const grades=gradeOrder.filter(g=>gradeCounts[g]).map(g=>({label:'Grade '+g, value:gradeCounts[g]}));

      el.append(h(`<div class="grid2">
        <div class="card"><h2>Admissions by course</h2>${barList(byCourse)}</div>
        <div class="card"><h2>Batch seat utilisation</h2>${barList(batches.map(b=>{
          const used = admissions.filter(a=>a.batchId===b.id).length;
          const cap = b.seatType==='unlimited' ? null : Number(b.seats||0);
          return {label:b.name, value:used, sub: cap ? `${used}/${cap} seats` : `${used} · unlimited`};
        }))}</div>
      </div>`));

      el.append(h(`<div class="grid2">
        <div class="card"><h2>Recent admissions</h2>${recent.length? recent.map(a=>{
          const c = courses.find(x=>x.id===a.courseId)||{};
          return `<div class="row"><div><b>${esc(a.name || '—')}</b><p>${esc(c.title||'')} • ${esc(a.admissionDate||'')}</p></div><span class="badge ok">${inr(a.totalFees)}</span></div>`;
        }).join('') : '<div class="empty">No admissions yet</div>'}</div>
        <div class="card"><h2>Upcoming exams</h2>${upcoming.length? upcoming.slice(0,5).map(ex=>{
          const b = batches.find(x=>x.id===ex.batchId)||{};
          return `<div class="row"><div><b>${esc(ex.examName)}</b><p>${esc(b.name||'')} • ${esc(ex.date||'')}</p></div><span class="badge">${esc(ex.totalMarks)} marks</span></div>`;
        }).join('') : '<div class="empty">No upcoming exams</div>'}</div>
      </div>`));

      el.append(h(`<div class="card"><h2>Exam grade distribution</h2>${barList(grades)}</div>`));

      el.append(h(`<div class="card"><h2>Quick actions</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="location.hash='#/courses'">Manage Courses</button>
          <button class="btn" onclick="location.hash='#/batches'">Manage Batches</button>
          <button class="btn primary" onclick="location.hash='#/admissions'">Add Admission</button>
          <button class="btn" onclick="location.hash='#/exams'">Manage Exams</button>
        </div>
      </div>`));
    }});
  }

  // Enquiries
  if (!Modules.find(m=>m.id==='enquiries')) {
    register({ id:'enquiries', title:'Enquiries', icon:'users', render(el) {
      const t = dataTable({
        columns:[
          {key:'name',label:'Name'},
          {key:'phone',label:'Phone'},
          {key:'course',label:'Course'},
          {key:'status',label:'Status',render:badge},
          {key:'date',label:'Date',render:(v)=>fmtDate(v)}
        ],
        rows: d.enquiries||[],
        pageSize: 8,
        filters:[{key:'status',label:'Status',options:['new','contacted','closed']}],
        toolbar:'',
        rowActions:x => `<button class="btn sm" data-view="${x.id}">View</button> <button class="btn sm" data-stat="${x.id}">Status</button> <button class="btn sm danger" data-del="${x.id}">Delete</button>`
      });
      el.append(t);
      t.addEventListener('click', async (e)=>{
        const vid = e.target.dataset.view, sid = e.target.dataset.stat, did = e.target.dataset.del;
        if (vid) {
          const enq = (d.enquiries||[]).find(x=>x.id===vid);
          if (!enq) return;
          modal({ title:'Enquiry', confirmLabel:'Close', body:`
            <div style="display:grid;gap:8px">
              <div><b>Name:</b> ${esc(enq.name)}</div>
              <div><b>Phone:</b> ${esc(enq.phone||'')}</div>
              <div><b>Email:</b> ${esc(enq.email||'')}</div>
              <div><b>Course:</b> ${esc(enq.course||'')}</div>
              <div><b>Status:</b> ${badge(enq.status)}</div>
              <div><b>Date:</b> ${fmtDate(enq.date)}</div>
              <div style="white-space:pre-wrap"><b>Message:</b><br>${esc(enq.message||'')}</div>
            </div>`, onConfirm:()=>{} });
        }
        if (sid) {
          const enq = (d.enquiries||[]).find(x=>x.id===sid);
          if (!enq) return;
          modal({ title:'Update Status', confirmLabel:'Save', body:`
            <label class="field">Status<select name="status">
              <option value="new" ${enq.status==='new'?'selected':''}>new</option>
              <option value="contacted" ${enq.status==='contacted'?'selected':''}>contacted</option>
              <option value="closed" ${enq.status==='closed'?'selected':''}>closed</option>
            </select></label>`, onConfirm:async (v)=>{
              enq.status = v.status; await store.save(); t.refresh(); toast('Status updated');
            }});
        }
        if (did) {
          const idx = (d.enquiries||[]).findIndex(x=>x.id===did);
          if (idx>=0) { (d.enquiries||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); }
        }
      });
    }});
  }

  // Courses
  if (!Modules.find(m=>m.id==='courses')) {
    register({ id:'courses', title:'Courses', icon:'cart', render(el) {
      const rows = d.courses||[];
      const t = dataTable({
        columns:[
          {key:'title',label:'Title'},
          {key:'category',label:'Category'},
          {key:'fee',label:'Fee'},
          {key:'duration',label:'Duration'},
          {key:'active',label:'Active',render:(v)=> v?'Yes':'No'}
        ],
        rows, pageSize:8,
        toolbar:'<button class="btn primary" id="addc">Add Course</button>',
        rowActions:x => `<button class="btn sm" data-ec="${x.id}">Edit</button> <button class="btn sm" data-tc="${x.id}">${x.active?'Disable':'Enable'}</button> <button class="btn sm danger" data-dc="${x.id}">Delete</button>`
      });
      el.append(t);
      const addForm = (item=null, cb)=>{
        modal({ title: item?'Edit Course':'Add Course', confirmLabel: item?'Save':'Add', body:`
          <label class="field">Title<input name="title" required value="${esc(item?.title||'')}"></label>
          <label class="field">Category<input name="category" value="${esc(item?.category||'')}"></label>
          <label class="field">Fee<input name="fee" value="${esc(item?.fee||'')}"></label>
          <label class="field">Duration<input name="duration" value="${esc(item?.duration||'')}"></label>
          <label class="field">Short desc<input name="short" value="${esc(item?.short||'')}"></label>
          <label class="field">Active<select name="active"><option value="true" ${item?.active!==false?'selected':''}>Yes</option><option value="false" ${item?.active===false?'selected':''}>No</option></select></label>
        `, onConfirm:cb});
      };
      t.addEventListener('click', async (e)=>{
        if (e.target.id === 'addc') { addForm(null, async (v)=>{
          const c = { id: uid('c'), title:v.title, category:v.category, fee:v.fee, duration:v.duration, short:v.short, active: v.active==='true' };
          (d.courses||[]).unshift(c); await store.save(); t.refresh(); toast('Course added');
        }); return; }
        const ec = e.target.dataset.ec, tc = e.target.dataset.tc, dc = e.target.dataset.dc;
        if (ec) { const it = (d.courses||[]).find(x=>x.id===ec); if (!it) return; addForm(it, async (v)=>{ Object.assign(it,{title:v.title,category:v.category,fee:v.fee,duration:v.duration,short:v.short,active:v.active==='true'}); await store.save(); t.refresh(); toast('Course saved'); }); }
        if (tc) { const it = (d.courses||[]).find(x=>x.id===tc); if (!it) return; it.active = !it.active; await store.save(); t.refresh(); toast(it.active?'Enabled':'Disabled'); }
        if (dc) { const idx=(d.courses||[]).findIndex(x=>x.id===dc); if (idx>=0){ (d.courses||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
    }});
  }

  // Batches
  if (!Modules.find(m=>m.id==='batches')) {
    register({ id:'batches', title:'Batches', icon:'cart', render(el) {
      const rows = (d.batches = d.batches || []);
      const courses = d.courses || [];
      const courseName = x => {
        const c = courses.find(c=>c.id===x.courseId) || courses.find(c=>c.title===x.course);
        return c ? c.title : (x.course || x.courseId || '—');
      };
      const seatLabel = x => x.seatType === 'unlimited' ? 'Unlimited' : (x.seats || 0);
      const t = dataTable({
        columns:[
          {key:'courseId',label:'Course',render:(v,x)=> esc(courseName(x))},
          {key:'name',label:'Batch'},
          {key:'year',label:'Year'},
          {key:'seats',label:'Seats',render:(v,x)=> seatLabel(x)}
        ],
        rows, pageSize:8,
        toolbar:'<button class="btn primary" id="addb">Add Batch</button>',
        rowActions:x => `<button class="btn sm" data-eb="${x.id}">Edit</button> <button class="btn sm danger" data-db="${x.id}">Delete</button>`
      });
      el.append(t);
      const form = (item=null, cb)=>{
        const it = item || {};
        const selId = it.courseId || ((courses.find(c=>c.title===it.course)||{}).id) || '';
        const dlg = modal({ title:it.id?'Edit Batch':'Add Batch', confirmLabel:it.id?'Save':'Add', body:`
          <label class="field">Course<select name="courseId" required>
            <option value="" disabled ${selId?'':'selected'}>Select course</option>
            ${courses.map(c=>`<option value="${esc(c.id)}" ${selId===c.id?'selected':''}>${esc(c.title)}</option>`).join('')}
          </select></label>
          <label class="field">Batch name<input name="name" required value="${esc(it.name||'')}"></label>
          <label class="field">Year<input name="year" type="number" min="2000" max="2100" required value="${esc(it.year||new Date().getFullYear())}"></label>
          <label class="field">Seats<select name="seatType">
            <option value="fixed" ${it.seatType!=='unlimited'?'selected':''}>Fixed</option>
            <option value="unlimited" ${it.seatType==='unlimited'?'selected':''}>Unlimited</option>
          </select></label>
          <label class="field">Seat count<input name="seats" type="number" min="1" value="${it.seatType==='unlimited'?'':esc(it.seats ?? '')}"></label>
        `, onConfirm:cb});
        const typeSel = $('[name=seatType]', dlg);
        const seatInput = $('[name=seats]', dlg);
        const syncSeats = ()=>{
          const unlimited = typeSel.value === 'unlimited';
          seatInput.disabled = unlimited;
          seatInput.required = !unlimited;
          if (unlimited) seatInput.value = '';
        };
        typeSel.onchange = syncSeats;
        syncSeats();
      };
      t.addEventListener('click', (e)=>{
        if (e.target.id !== 'addb') return;
        form(null, async (v)=>{
          rows.unshift({ id: uid('b'), courseId:v.courseId, name:v.name, year:v.year, seatType:v.seatType, seats: v.seatType==='unlimited' ? null : Number(v.seats||0) });
          await store.save(); t.refresh(); toast('Batch added');
        });
      });
      t.addEventListener('click', async (e)=>{
        const eb=e.target.dataset.eb, db=e.target.dataset.db;
        if (eb){ const it=rows.find(x=>x.id===eb); if(!it)return; form(it, async (v)=>{ Object.assign(it,{courseId:v.courseId,name:v.name,year:v.year,seatType:v.seatType,seats: v.seatType==='unlimited' ? null : Number(v.seats||0)}); delete it.course; await store.save(); t.refresh(); toast('Batch saved'); }); }
        if (db){ const idx=rows.findIndex(x=>x.id===db); if(idx>=0){ rows.splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
    }});
  }

  // Admissions
  if (!Modules.find(m=>m.id==='admissions')) {
    register({ id:'admissions', title:'Admissions', icon:'doc', render(el) {
      const admissions = (d.admissions = d.admissions || []);
      const students = d.students || [];
      const courses = d.courses || [];
      const batches = d.batches || [];

      const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const money = n => '₹' + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
      const parseMoney = v => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
      const studentName = id => {
        const s = students.find(x=>x.id===id);
        if (s) return s.name + (s.phone ? ` (${s.phone})` : '');
        const a = (d.admissions||[]).find(x=>x.id===id || x.admissionId===id); // not expected
        return a?.name || '—';
      };
      const studentNameFromAdm = a => (a && a.name) ? (a.contactNumber ? `${a.name} (${a.contactNumber})` : a.name) : studentName(a?.studentId);
      const admissionStudentLabel = a => (a?.name || studentName(a?.studentId) === '—') ? (a?.name || '—') + (a?.contactNumber ? ` (${a?.contactNumber})` : '') : studentName(a?.studentId);
      const courseTitle = id => (courses.find(c=>c.id===id) || {}).title || '—';
      const courseTypes = Array.from(new Set(courses.map(c=>c.category).filter(Boolean)));

      function nextAdmissionId() {
        const year = new Date().getFullYear();
        const nums = admissions.map(a => { const m = /(\d+)\s*$/.exec(a.admissionId || ''); return m ? +m[1] : 0; });
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return `ADM-${year}-${String(next).padStart(4, '0')}`;
      }
      function availableSeats(batchId, excludeId) {
        const b = batches.find(x=>x.id===batchId);
        if (!b) return '';
        if (b.seatType === 'unlimited') return 'Unlimited';
        const used = admissions.filter(a=>a.batchId===batchId && a.id!==excludeId).length;
        return String(Math.max(0, (b.seats||0) - used));
      }

      function showList() {
        el.innerHTML = '';
        const t = dataTable({
          columns:[
            {key:'admissionId',label:'Admission ID'},
             {key:'name',label:'Name',render:(v,x)=>esc(x.name || studentName(x.studentId))},
             {key:'contactNumber',label:'Contact',render:(v,x)=>esc(x.contactNumber || (students.find(s=>s.id===x.studentId)||{}).phone || '')},
            {key:'courseId',label:'Course',render:v=>esc(courseTitle(v))},
            {key:'totalFees',label:'Total Fees',render:v=>money(v)},
            {key:'admissionDate',label:'Date'}
          ],
          rows: admissions, pageSize:8,
          toolbar:'<button class="btn primary" id="addAdm">Add Admission</button>',
          rowActions:x => `<button class="btn sm" data-ea="${x.id}">Edit</button> <button class="btn sm danger" data-da="${x.id}">Delete</button>`
        });
        el.append(t);
        t.addEventListener('click', async (e)=>{
          if (e.target.id === 'addAdm') { showForm(null); return; }
          const ea = e.target.dataset.ea, da = e.target.dataset.da;
          if (ea) showForm(ea);
          if (da) { const idx = admissions.findIndex(a=>a.id===da); if (idx>=0) { admissions.splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
        });
      }

      function showForm(id) {
        const editing = id ? admissions.find(a=>a.id===id) : null;
        const adm = editing || { admissionId: nextAdmissionId(), discountType:'amount', discountValue:0, gstTaken:false, admissionFee:'', admissionDate: new Date().toISOString().slice(0,10) };

        el.innerHTML = '';
        const form = h(`<form class="card aform" novalidate>
          <div class="form-head">
            <h2 style="margin:0">${editing ? 'Edit Admission' : 'Add Admission'}</h2>
            <span class="badge">${esc(adm.admissionId)}</span>
          </div>
          <div class="arow">
            <label class="field">Name<input name="name" required value="${esc(adm.name||'')}"></label>
            <label class="field">Father Name<input name="fatherName" value="${esc(adm.fatherName||'')}"></label>
            <label class="field">Contact Number<input name="contactNumber" value="${esc(adm.contactNumber||'')}"></label>
          </div>
          <div class="arow">
            <label class="field">Marital Status<select name="maritalStatus">
              <option value="" ${!adm.maritalStatus?'selected':''}>Select</option>
              ${['Single','Married','Divorced','Widowed'].map(o=>`<option value="${o}" ${adm.maritalStatus===o?'selected':''}>${o}</option>`).join('')}
            </select></label>
            <label class="field">Gender<select name="gender">
              <option value="" ${!adm.gender?'selected':''}>Select</option>
              ${['Male','Female','Other'].map(o=>`<option value="${o}" ${adm.gender===o?'selected':''}>${o}</option>`).join('')}
            </select></label>
            <label class="field">Qualification<input name="qualification" value="${esc(adm.qualification||'')}"></label>
          </div>
          <div class="arow">
            <label class="field">Technical Qualification<input name="technicalQualification" value="${esc(adm.technicalQualification||'')}"></label>
            <label class="field">Aadhaar Number<input name="aadharNumber" value="${esc(adm.aadharNumber||'')}"></label>
            <label class="field">Religion<input name="religion" value="${esc(adm.religion||'')}"></label>
          </div>
          <div class="arow">
            <label class="field">Nationality<input name="nationality" value="${esc(adm.nationality||'Indian')}"></label>
            <label class="field">Caste<input name="caste" value="${esc(adm.caste||'')}"></label>
            <label class="field">Receipt Number<input name="receiptNumber" value="${esc(adm.receiptNumber||'')}"></label>
          </div>
          <div class="arow full">
            <label class="field">Present Address<textarea name="presentAddress" rows="2">${esc(adm.presentAddress||'')}</textarea></label>
          </div>
          <div class="arow full">
            <label class="field">Permanent Address<textarea name="permanentAddress" rows="2">${esc(adm.permanentAddress||'')}</textarea></label>
          </div>
          <div class="arow">
            <label class="field">Course Type<select name="courseType" required>
              <option value="" disabled ${adm.courseType ? '' : 'selected'}>Select Course Type</option>
              ${courseTypes.map(tp=>`<option value="${esc(tp)}" ${adm.courseType===tp?'selected':''}>${esc(cap(tp))}</option>`).join('')}
            </select></label>
            <label class="field">Course<select name="courseId" required><option value="" disabled selected>Select Course Type First</option></select></label>
            <label class="field">Course Fee<input name="courseFee" readonly value="0.00"></label>
          </div>
          <div class="arow">
            <label class="field">Discount Type<div class="radios">
              <label><input type="radio" name="discountType" value="amount" ${adm.discountType!=='percentage'?'checked':''}> Amount</label>
              <label><input type="radio" name="discountType" value="percentage" ${adm.discountType==='percentage'?'checked':''}> Percentage</label>
            </div></label>
            <label class="field">Discount Value<input name="discountValue" type="number" min="0" step="0.01" value="${esc(adm.discountValue ?? 0)}"></label>
            <label class="field">Is GST Taken?<div class="radios">
              <label><input type="radio" name="gstTaken" value="yes" ${adm.gstTaken?'checked':''}> Yes</label>
              <label><input type="radio" name="gstTaken" value="no" ${adm.gstTaken?'':'checked'}> No</label>
            </div></label>
          </div>
          <div class="arow">
            <label class="field">GST Amount<input name="gstAmount" type="number" min="0" step="0.01" value="${esc((adm.gstAmount != null ? Number(adm.gstAmount) : 0).toFixed(2))}"></label>
            <label class="field">Admission Fee<input name="admissionFee" type="number" min="0" step="0.01" value="${adm.admissionFee==null?'':esc(adm.admissionFee)}"></label>
            <label class="field">Total Fees<input name="totalFees" readonly value="${adm.totalFees==null?'':esc(adm.totalFees)}"></label>
          </div>
          <div class="arow">
            <label class="field">Admission Date<input name="admissionDate" type="date" required value="${esc(adm.admissionDate||'')}"></label>
            <label class="field">Batches<select name="batchId" required><option value="" disabled selected>Select Batch</option></select></label>
            <label class="field">Available Seats for This Batch<input name="availableSeats" readonly value="—"></label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn primary">${editing ? 'Save' : 'Add'}</button>
          </div>
        </form>`);
        el.append(form);

        const q = s => $(s, form);
        const courseTypeSel = q('[name=courseType]');
        const courseSel = q('[name=courseId]');
        const feeInput = q('[name=courseFee]');
        const discVal = q('[name=discountValue]');
        const gstAmt = q('[name=gstAmount]');
        const admFeeInput = q('[name=admissionFee]');
        const batchSel = q('[name=batchId]');
        const availInput = q('[name=availableSeats]');
        const totalFeesInput = q('[name=totalFees]');
        const radioVal = name => { const r = form.querySelector(`input[name=${name}]:checked`); return r ? r.value : ''; };

        function populateCourses(type) {
          const list = courses.filter(c => c.category === type);
          courseSel.innerHTML = `<option value="" disabled selected>${type ? (list.length ? 'Select Course' : 'No courses') : 'Select Course Type First'}</option>`
            + list.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
          courseSel.disabled = !type;
        }
        function populateBatches(courseId) {
          const list = batches.filter(b => b.courseId === courseId);
          batchSel.innerHTML = `<option value="" disabled selected>${courseId ? (list.length ? 'Select Batch' : 'No batches') : 'Select Batch'}</option>`
            + list.map(b => `<option value="${esc(b.id)}">${esc(b.name)} · ${esc(b.year)}</option>`).join('');
          availInput.value = '—';
        }
        function updateAvailable() {
          const v = availableSeats(batchSel.value, editing ? editing.id : null);
          availInput.value = v === '' ? '—' : String(v);
        }
        function recalc() {
          const course = courses.find(c => c.id === courseSel.value);
          const fee = course ? parseMoney(course.fee) : 0;
          feeInput.value = fee.toFixed(2);
          const dv = Number(discVal.value || 0);
          const discount = radioVal('discountType') === 'percentage' ? fee * dv / 100 : dv;
          const taxable = Math.max(0, fee - discount);
          const gst = radioVal('gstTaken') === 'yes' ? Number(gstAmt.value || 0) : 0;
          if (radioVal('gstTaken') !== 'yes') gstAmt.value = '0.00';
          const admFee = Number(admFeeInput.value || 0);
          totalFeesInput.value = (taxable + gst + admFee).toFixed(2);
        }
        function syncGst() {
          const yes = radioVal('gstTaken') === 'yes';
          gstAmt.disabled = !yes;
          if (!yes) gstAmt.value = '0.00';
          recalc();
        }
        // init from existing record
        courseTypeSel.value = adm.courseType || '';
        populateCourses(adm.courseType || '');
        if (adm.courseId) courseSel.value = adm.courseId;
        populateBatches(adm.courseId || '');
        if (adm.batchId) { batchSel.value = adm.batchId; updateAvailable(); }
        syncGst();

        courseTypeSel.onchange = () => { populateCourses(courseTypeSel.value); courseSel.value = ''; populateBatches(''); recalc(); };
        courseSel.onchange = () => { populateBatches(courseSel.value); recalc(); };
        batchSel.onchange = updateAvailable;
        discVal.oninput = recalc;
        gstAmt.oninput = recalc;
        admFeeInput.oninput = recalc;
        form.querySelectorAll('input[name=discountType]').forEach(r => r.onchange = recalc);
        form.querySelectorAll('input[name=gstTaken]').forEach(r => r.onchange = syncGst);
        q('[data-cancel]').onclick = () => showList();

        form.onsubmit = async (e) => {
          e.preventDefault();
          if (!q('[name=name]').value.trim()) return toast('Please enter name');
          if (!courseTypeSel.value) return toast('Please select a course type');
          if (!courseSel.value) return toast('Please select a course');
          if (!batchSel.value) return toast('Please select a batch');
          if (!q('[name=admissionDate]').value) return toast('Please select an admission date');
          const course = courses.find(c => c.id === courseSel.value) || {};
          const data = {
            admissionId: adm.admissionId,
            name: q('[name=name]').value.trim(),
            fatherName: q('[name=fatherName]').value.trim(),
            contactNumber: q('[name=contactNumber]').value.trim(),
            maritalStatus: q('[name=maritalStatus]').value,
            gender: q('[name=gender]').value,
            qualification: q('[name=qualification]').value.trim(),
            technicalQualification: q('[name=technicalQualification]').value.trim(),
            aadharNumber: q('[name=aadharNumber]').value.trim(),
            religion: q('[name=religion]').value.trim(),
            nationality: q('[name=nationality]').value.trim(),
            caste: q('[name=caste]').value.trim(),
            presentAddress: q('[name=presentAddress]').value.trim(),
            permanentAddress: q('[name=permanentAddress]').value.trim(),
            receiptNumber: q('[name=receiptNumber]').value.trim(),
            totalFees: q('[name=totalFees]').value === '' ? null : Number(q('[name=totalFees]').value),
            courseType: courseTypeSel.value,
            courseId: courseSel.value,
            courseFee: parseMoney(course.fee),
            discountType: radioVal('discountType') || 'amount',
            discountValue: Number(discVal.value || 0),
            gstTaken: radioVal('gstTaken') === 'yes',
            gstAmount: Number(gstAmt.value || 0),
            admissionFee: q('[name=admissionFee]').value === '' ? null : Number(q('[name=admissionFee]').value),
            admissionDate: q('[name=admissionDate]').value,
            batchId: batchSel.value
          };
          if (editing) { Object.assign(editing, data); delete editing.finalAmount; }
          else { admissions.unshift(Object.assign({ id: uid('ad') }, data)); }
          await store.save();
          toast(editing ? 'Admission saved' : 'Admission added');
          showList();
        };
      }

      showList();
    }});
  }

  // Gallery
  if (!Modules.find(m=>m.id==='gallery')) {
    register({ id:'gallery', title:'Gallery', icon:'gear', render(el) {
      const rows = d.gallery||[];
      const t = dataTable({
        columns:[
          {key:'src',label:'Image',render:(v,x)=> `<img src="${esc(v)}" alt="${esc(x.alt||'')}" style="height:40px;border-radius:6px;object-fit:cover">`},
          {key:'alt',label:'Alt'},
          {key:'visible',label:'Visible',render:(v)=>v?'Yes':'No'}
        ],
        rows,pageSize:8,
        toolbar:'<button class="btn primary" id="addg">Add Image</button>',
        rowActions:x => `<button class="btn sm" data-eg="${x.id}">Edit</button> <button class="btn sm" data-tg="${x.id}">${x.visible?'Hide':'Show'}</button> <button class="btn sm danger" data-dg="${x.id}">Delete</button>`
      });
      el.append(t);
      const addForm=(item=null,cb)=>modal({ title:item?'Edit Image':'Add Image', confirmLabel:item?'Save':'Add', body:`
        <label class="field">Image URL<input name="src" required value="${esc(item?.src||'')}"></label>
        <label class="field">Alt text<input name="alt" value="${esc(item?.alt||'')}"></label>
        <label class="field">Visible<select name="visible"><option value="true" ${item?.visible!==false?'selected':''}>Yes</option><option value="false" ${item?.visible===false?'selected':''}>No</option></select></label>
      `, onConfirm:cb});
      t.addEventListener('click', async (e)=>{
        if (e.target.id === 'addg') { addForm(null, async (v)=>{ (d.gallery||[]).unshift({id:uid('g'), src:v.src, alt:v.alt, visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Added'); }); return; }
        const eg=e.target.dataset.eg, tg=e.target.dataset.tg, dg=e.target.dataset.dg;
        if (eg){ const it=(d.gallery||[]).find(x=>x.id===eg); if(!it)return; addForm(it, async (v)=>{ Object.assign(it,{src:v.src,alt:v.alt,visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Saved'); }); }
        if (tg){ const it=(d.gallery||[]).find(x=>x.id===tg); if(!it)return; it.visible=!it.visible; await store.save(); t.refresh(); toast(it.visible?'Shown':'Hidden'); }
        if (dg){ const idx=(d.gallery||[]).findIndex(x=>x.id===dg); if(idx>=0){ (d.gallery||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
    }});
  }

  // Testimonials
  if (!Modules.find(m=>m.id==='testimonials')) {
    register({ id:'testimonials', title:'Testimonials', icon:'users', render(el) {
      const rows = d.testimonials||[];
      const t = dataTable({
        columns:[{key:'name',label:'Name'},{key:'role',label:'Role'},{key:'quote',label:'Quote',render:(v)=> esc(v).slice(0,40)+'...'},{key:'visible',label:'Visible',render:(v)=>v?'Yes':'No'}],
        rows,pageSize:8,
        toolbar:'<button class="btn primary" id="addt">Add Testimonial</button>',
        rowActions:x => `<button class="btn sm" data-et="${x.id}">Edit</button> <button class="btn sm" data-tt="${x.id}">${x.visible?'Hide':'Show'}</button> <button class="btn sm danger" data-dt="${x.id}">Delete</button>`
      });
      el.append(t);
      const addForm=(item=null,cb)=>modal({ title:item?'Edit Testimonial':'Add Testimonial', confirmLabel:item?'Save':'Add', body:`
        <label class="field">Name<input name="name" required value="${esc(item?.name||'')}"></label>
        <label class="field">Role<input name="role" value="${esc(item?.role||'')}"></label>
        <label class="field">Avatar URL<input name="avatar" value="${esc(item?.avatar||'')}"></label>
        <label class="field">Quote<textarea name="quote" rows="3" required>${esc(item?.quote||'')}</textarea></label>
        <label class="field">Visible<select name="visible"><option value="true" ${item?.visible!==false?'selected':''}>Yes</option><option value="false" ${item?.visible===false?'selected':''}>No</option></select></label>
      `, onConfirm:cb});
      t.addEventListener('click', async (e)=>{
        if (e.target.id === 'addt') { addForm(null, async (v)=>{ (d.testimonials||[]).unshift({id:uid('t'), name:v.name, role:v.role, avatar:v.avatar, quote:v.quote, visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Added'); }); return; }
        const et=e.target.dataset.et, tt=e.target.dataset.tt, dt=e.target.dataset.dt;
        if (et){ const it=(d.testimonials||[]).find(x=>x.id===et); if(!it)return; addForm(it, async (v)=>{ Object.assign(it,{name:v.name,role:v.role,avatar:v.avatar,quote:v.quote,visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Saved'); }); }
        if (tt){ const it=(d.testimonials||[]).find(x=>x.id===tt); if(!it)return; it.visible=!it.visible; await store.save(); t.refresh(); toast(it.visible?'Shown':'Hidden'); }
        if (dt){ const idx=(d.testimonials||[]).findIndex(x=>x.id===dt); if(idx>=0){ (d.testimonials||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
    }});
  }

  // Placements
  if (!Modules.find(m=>m.id==='placements')) {
    register({ id:'placements', title:'Placements', icon:'cart', render(el) {
      const rows = d.placements||[];
      const t = dataTable({
        columns:[{key:'company',label:'Company'},{key:'year',label:'Year'},{key:'count',label:'Count'}],
        rows,pageSize:8,
        toolbar:'<button class="btn primary" id="addp">Add Placement</button>',
        rowActions:x => `<button class="btn sm" data-ep="${x.id}">Edit</button> <button class="btn sm danger" data-dp="${x.id}">Delete</button>`
      });
      el.append(t);
      const addForm=(item=null,cb)=>modal({ title:item?'Edit Placement':'Add Placement', confirmLabel:item?'Save':'Add', body:`
        <label class="field">Company<input name="company" required value="${esc(item?.company||'')}"></label>
        <label class="field">Year<input name="year" value="${esc(item?.year||'')}"></label>
        <label class="field">Count<input name="count" type="number" value="${esc(item?.count||0)}"></label>
        <label class="field">Logo URL<input name="logo" value="${esc(item?.logo||'')}"></label>
      `, onConfirm:cb});
      t.addEventListener('click', async (e)=>{
        if (e.target.id === 'addp') { addForm(null, async (v)=>{ (d.placements||[]).unshift({id:uid('p'), company:v.company, year:v.year, count:Number(v.count||0), logo:v.logo}); await store.save(); t.refresh(); toast('Added'); }); return; }
        const ep=e.target.dataset.ep, dp=e.target.dataset.dp;
        if (ep){ const it=(d.placements||[]).find(x=>x.id===ep); if(!it)return; addForm(it, async (v)=>{ Object.assign(it,{company:v.company,year:v.year,count:Number(v.count||0),logo:v.logo}); await store.save(); t.refresh(); toast('Saved'); }); }
        if (dp){ const idx=(d.placements||[]).findIndex(x=>x.id===dp); if(idx>=0){ (d.placements||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
    }});
  }



  // Exams
  if (!Modules.find(m=>m.id==='exams')) {
    register({ id:'exams', title:'Exams', icon:'doc', render(el) {
      const exams = (d.exams = d.exams || []);
      const results = (d.examResults = d.examResults || []);
      const students = d.students || [];
      const courses = d.courses || [];
      const batches = d.batches || [];
      const admissions = d.admissions || [];

      const cap = s=>s? s.charAt(0).toUpperCase()+s.slice(1):s;
      const courseTitle = id => (courses.find(c=>c.id===id)||{}).title || '—';
      const batchName = id => { const b = batches.find(x=>x.id===id); return b ? b.name : '—'; };
      const studentName = id => { const st = students.find(x=>x.id===id); return st ? st.name : '—'; };
      const sysId = id => { const st = students.find(x=>x.id===id); return st ? st.systemId : ''; };

      function showList() {
        el.innerHTML='';
        const t = dataTable({
          columns:[
            {key:'examName',label:'Exam Name'},
            {key:'courseId',label:'Course',render:v=>esc(courseTitle(v))},
            {key:'batchId',label:'Batch',render:v=>esc(batchName(v))},
            {key:'date',label:'Date'},
            {key:'totalMarks',label:'Total Marks'}
          ],
          rows: exams, pageSize:8,
          toolbar:'<button class="btn primary" id="addEx">Add Exam</button>',
          rowActions:x => `<button class="btn sm" data-view="${x.id}">Results</button> <button class="btn sm" data-ex="${x.id}">Edit</button> <button class="btn sm danger" data-dx="${x.id}">Delete</button>`
        });
        el.append(t);
        t.addEventListener('click', async (e)=>{
          if (e.target.id==='addEx'){ showForm(null); return; }
          const ex=e.target.dataset.ex, dx=e.target.dataset.dx, v=e.target.dataset.view;
          if (v){ showBulkResults(v); return; }
          if (ex){ showForm(ex); return; }
          if (dx){ const idx=exams.findIndex(a=>a.id===dx); if(idx>=0){ exams.splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
        });
      }

      function showForm(id){
        const editing = id ? exams.find(a=>a.id===id) : null;
        const exm = editing || { examName:'', batchId:'', courseId:'', date:new Date().toISOString().slice(0,10), totalMarks:100, description:'' };
        el.innerHTML='';
        const form = h(`<form class="card aform" novalidate>
          <div class="form-head"><h2 style="margin:0">${editing?'Edit Exam':'Add Exam'}</h2></div>
          <div class="arow">
            <label class="field">Batch<select name="batchId" required>
              <option value="" disabled ${exm.batchId?'':'selected'}>Select Batch</option>
              ${batches.map(b=>`<option value="${esc(b.id)}" ${exm.batchId===b.id?'selected':''}>${esc(b.name)}${b.year?(' ('+esc(b.year)+')'):''}</option>`).join('')}
            </select></label>
            <label class="field">Course<input name="courseDisp" readonly value="${esc(courseTitle(exm.courseId))}"></label>
            <label class="field">Course ID<input name="courseId" readonly value="${esc(exm.courseId||'')}"></label>
          </div>
          <div class="arow">
            <label class="field">Exam Name<input name="examName" required value="${esc(exm.examName||'')}"></label>
            <label class="field">Date<input name="date" type="date" required value="${esc(exm.date||'')}"></label>
            <label class="field">Total Marks<input name="totalMarks" type="number" min="0" step="0.01" required value="${esc(exm.totalMarks??100)}"></label>
          </div>
          <div class="arow full"><label class="field">Description<textarea name="description" rows="2">${esc(exm.description||'')}</textarea></label></div>
          <div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">${editing?'Save':'Add'}</button></div>
        </form>`);
        el.append(form);
        const q=s=>form.querySelector(s);
        const batchSel=q('[name=batchId]');
        const courseDisp=q('[name=courseDisp]');
        const courseIdInp=q('[name=courseId]');
        function fillCourseFromBatch(id){
          const b=batches.find(x=>x.id===id); if(!b){ courseDisp.value=''; courseIdInp.value=''; return; }
          courseDisp.value=courseTitle(b.courseId); courseIdInp.value=b.courseId||'';
        }
        batchSel.onchange=e=>fillCourseFromBatch(e.target.value);
        if(exm.batchId) fillCourseFromBatch(exm.batchId);
        q('[data-cancel]').onclick=showList;
        form.onsubmit=async e=>{
          e.preventDefault();
          if(!batchSel.value) return toast('Select batch');
          if(!q('[name=examName]').value) return toast('Enter exam name');
          const data={
            examName:q('[name=examName]').value.trim(),
            batchId:batchSel.value,
            courseId:courseIdInp.value,
            date:q('[name=date]').value,
            totalMarks: Number(q('[name=totalMarks]').value||0),
            description:q('[name=description]').value
          };
          if(editing){ Object.assign(editing,data); }
          else { exams.unshift(Object.assign({id:uid('ex')},data)); }
          await store.save(); toast(editing?'Exam saved':'Exam added'); showList();
        };
      }

      function gradeFor(p){
        if (p===null||isNaN(p)) return '';
        if (p>=90) return 'A+';
        if (p>=80) return 'A';
        if (p>=70) return 'B+';
        if (p>=60) return 'B';
        if (p>=50) return 'C';
        if (p>=40) return 'D';
        return 'F';
      }

      function showBulkResults(examId){
        const exam = exams.find(e=>e.id===examId); if(!exam) return showList();
        // get students in this batch: from admissions (unique studentId in batch)
        const inBatch = new Map();
        admissions.forEach(a=>{
          if(a.batchId===exam.batchId){
            inBatch.set(a.studentId || a.id || a.admissionId, {
              admissionId: a.admissionId || a.id,
              studentId: a.studentId || '',
              name: a.name || '',
              contactNumber: a.contactNumber || ''
            });
          }
        });
        // fallback: if none, show students? but better by admissions
        // build list
        let list = Array.from(inBatch.values()).map(x=>{
          const st = students.find(s=>s.id===x.studentId)||{};
          const r = results.find(rr=>rr.examId===examId && (rr.studentId===x.studentId || (x.studentId==='' && rr.admissionId===x.admissionId)));
          return {
            studentId:x.studentId,
            systemId: st.systemId||'',
            name: x.name || st.name || '',
            admissionId: x.admissionId||'',
            marksObtained: r ? r.marksObtained : '',
            grade: r ? r.grade : '',
            remarks: r ? r.remarks : '',
            has: !!r
          };
        });
        // if empty, include all students (no admissions yet)? maybe empty list
        el.innerHTML='';
        const card = h(`<div class="card">
          <div class="form-head" style="margin-bottom:10px">
            <h2 style="margin:0">Results: ${esc(exam.examName)}</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn sm" id="rBack">Back to Exams</button>
              <button class="btn sm" id="rCsv">Export CSV</button>
              <button class="btn sm danger" id="rClear">Clear</button>
              <button class="btn sm primary" id="rSave">Save All</button>
            </div>
          </div>
          <div style="color:var(--muted);margin-bottom:10px">${esc(courseTitle(exam.courseId))} • ${esc(batchName(exam.batchId))} • Total ${esc(exam.totalMarks)}</div>
          <div class="scroll"></div>
        </div>`);
        el.append(card);
        const wrap = $('.scroll', card);
        if(list.length===0){
          wrap.innerHTML = '<div class="empty">No students found for this batch (based on admissions)</div>';
        } else {
          const tbl = h(`<table><thead><tr><th>Name</th><th>Admission ID</th><th>Marks Obtained</th><th>Grade</th><th>Remarks</th></tr></thead><tbody></tbody></table>`);
          const tbody = $('tbody', tbl);
          list.forEach((it,i)=>{
            const tr = h(`<tr>
              <td>${esc(it.name)}</td>
              <td>${esc(it.admissionId)}</td>
              <td><input name="m_${i}" type="number" min="0" max="${exam.totalMarks}" step="0.01" value="${it.marksObtained!==''?it.marksObtained:''}" style="width:110px"></td>
              <td><input name="g_${i}" value="${esc(it.grade||'')}" style="width:80px" placeholder="A/A+/B"></td>
              <td><input name="rm_${i}" value="${esc(it.remarks||'')}" style="width:200px"></td>
            </tr>`);
            // auto grade on marks change
            const m = $('input[name=m_'+i+']', tr);
            const g = $('input[name=g_'+i+']', tr);
            m.oninput = ()=>{
              const v = parseFloat(m.value); if(!isNaN(v)) g.value = gradeFor((v*100)/Number(exam.totalMarks||100));
            };
            // if empty grade and has marks, compute
            if(it.marksObtained!=='' && !it.grade){ const v=parseFloat(it.marksObtained); if(!isNaN(v)) g.value = gradeFor((v*100)/Number(exam.totalMarks||100)); }
            tbody.append(tr);
          });
          tbl.append(tbody); wrap.append(tbl);
        }
        $('#rBack', card).onclick=showList;
        $('#rClear', card).onclick=async()=>{
          if(!list.length) return; if(!confirm('Clear all results for this exam?')) return;
          results.forEach((rr,idx)=>{
            if(rr.examId===examId) results.splice(idx,1);
          });
          // rebuild in place? better filter
          d.examResults = results.filter(rr=>rr.examId!==examId);
          results.length=0; results.push(...d.examResults);
          await store.save(); toast('Cleared'); showBulkResults(examId);
        };
        $('#rCsv', card).onclick=()=>{
          if(!list.length) return;
          const rowsCsv = [['System ID','Name','Admission ID','Marks Obtained','Total Marks','Percentage','Grade','Remarks']];
          list.forEach(it=>{
            const m = parseFloat(it.marksObtained); const tot=Number(exam.totalMarks||100); const p = !isNaN(m)&&tot>0? ((m/tot)*100).toFixed(2):'';
            rowsCsv.push([it.systemId,it.name,it.admissionId, it.marksObtained!==''?it.marksObtained:'', String(tot), p, it.grade||'', it.remarks||'']);
          });
          const csv = rowsCsv.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
          const blob = new Blob([csv],{type:'text/csv'});
          const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`results_${exam.examName.replace(/\\s+/g,'_')}.csv`; a.click(); URL.revokeObjectURL(url);
        };
        $('#rSave', card).onclick=async()=>{
          if(!list.length) return;
          let saved=0, updated=0;
          list.forEach((it,i)=>{
            const admv = it.admissionId;
            const mv = $('input[name=m_'+i+']', wrap).value;
            const gv = $('input[name=g_'+i+']', wrap).value.trim();
            const rmv = $('input[name=rm_'+i+']', wrap).value.trim();
            it.marksObtained = mv===''? '' : Number(mv);
            it.grade = gv; it.remarks = rmv;             // admission id is read-only in display; keep as is
            let r = results.find(rr=>rr.examId===examId && (rr.studentId===it.studentId || rr.admissionId===it.admissionId));
            const mnum = it.marksObtained===''? null : Number(it.marksObtained);
            const tot = Number(exam.totalMarks||100);
            const pcent = (mnum!==null && tot>0) ? ((mnum/tot)*100) : null;
            const gcalc = gv || (pcent!==null? gradeFor(pcent): '');
            if(!r){
              r = { id: uid('er'), examId, studentId:it.studentId, systemId:it.systemId, batchId:exam.batchId, totalMarks:tot, admissionId:admv, name:it.name };
              results.unshift(r); saved++;
            } else { updated++; }
            r.marksObtained = mnum; r.percentage = pcent; r.grade = gcalc; r.remarks = rmv; r.admissionId = admv; r.totalMarks = tot; if(it.name) r.name = it.name;
          });
          await store.save(); toast(`Saved (new ${saved}, updated ${updated})`); showBulkResults(examId);
        };
      }

      showList();
    }});
  }
  // Settings
  if (!Modules.find(m=>m.id==='settings')) {
    register({ id:'settings', title:'Settings', icon:'gear', render(el) {
      const s = d.settings||{};
      const card = h(`<div class="card" style="max-width:760px">
        <h2>Institute Settings</h2>
        <form id="setForm">
          <label class="field">Institute Name<input name="instituteName" value="${esc(s.instituteName||'')}"></label>
          <label class="field">Email<input name="email" value="${esc(s.email||'')}"></label>
          <label class="field">Address<textarea name="address" rows="2">${esc(s.address||'')}</textarea></label>
          <label class="field">Phone 1<input name="phone1" value="${esc((s.phone&&s.phone[0])||'')}"></label>
          <label class="field">Phone 2<input name="phone2" value="${esc((s.phone&&s.phone[1])||'')}"></label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn primary" type="submit">Save Settings</button>
            <button class="btn" type="button" id="exp">Export JSON</button>
            <button class="btn" type="button" id="impBtn">Import JSON</button>
            <input type="file" id="imp" accept="application/json" style="display:none">
            <button class="btn danger" type="button" id="reset">Reset to Seed</button>
            <button class="btn" type="button" id="logout">Logout</button>
          </div>
        </form>
      </div>`);
      el.append(card);
      $('#setForm', card).onsubmit = async (e)=>{
        e.preventDefault();
        const f = new FormData(e.target);
        d.settings = {
          instituteName: f.get('instituteName'),
          email: f.get('email'),
          address: f.get('address'),
          phone: [f.get('phone1')||'', f.get('phone2')||''].filter(Boolean),
          theme: s.theme||'auto'
        };
        await store.save(); toast('Settings saved');
      };
      $('#exp', card).onclick = ()=>{
        const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='trainhub_admin_data.json'; a.click(); URL.revokeObjectURL(url); toast('Exported');
      };
      $('#impBtn', card).onclick = ()=> $('#imp', card).click();
      $('#imp', card).onchange = async (e)=>{
        const file = e.target.files[0]; if (!file) return;
        try { const txt = await file.text(); const j = JSON.parse(txt); Object.assign(d, j); await store.save(); toast('Imported'); setTimeout(()=>location.reload(),600); } catch (err){ toast('Import failed'); }
      };
      $('#reset', card).onclick = async ()=>{
        if (!confirm('Reset all data to seed? This cannot be undone.')) return;
        await idbClear();
        await store.load(); toast('Reset done'); setTimeout(()=>location.reload(),600);
      };
      $('#logout', card).onclick = ()=> { if (typeof logout==='function') logout(); else { sessionStorage.removeItem('admin_authed'); location.reload(); } };
    }});
  }

  // Re-render nav after modules registered
  if (typeof renderNav === 'function') renderNav();
  if (typeof route === 'function') route();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  // logout link in top if exists
  const lg = document.getElementById('adminLogout');
  if (lg) lg.onclick = ()=> { if (typeof logout==='function') logout(); };
  if (typeof initAuth === 'function') initAuth();
  if (typeof isAuthed === 'function' && isAuthed()) await bootApp();
});
