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
      const enq = (d.enquiries||[]).length;
      const newEnq = (d.enquiries||[]).filter(e=>e.status==='new').length;
      const courses = (d.courses||[]).filter(c=>c.active).length;
      const gallery = (d.gallery||[]).filter(g=>g.visible).length;
      el.append(h(`<div class="stats">${[
        {label:'Enquiries', value:String(enq), delta: Math.max(0,newEnq)},
        {label:'New Enquiries', value:String(newEnq), delta:0},
        {label:'Active Courses', value:String(courses), delta:0},
        {label:'Gallery Items', value:String(gallery), delta:0}
      ].map(s=>statCard({label:s.label,value:s.value,delta:s.delta})).join('')}</div>`));
      const recent = [...(d.enquiries||[])].sort((a,b)=> (b.date||'').localeCompare(a.date||'')).slice(0,5);
      el.append(h(`<div class="split"><div class="card"><h2>Recent enquiries</h2>${recent.length? recent.map(r=>`<div class="row"><div><b>${esc(r.name)}</b><p>${esc(r.course||'')} • ${fmtDate(r.date)}</p></div>${badge(r.status)}</div>`).join('') : '<div class="empty">No enquiries</div>'}</div>
        <div class="card"><h2>Quick actions</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" onclick="location.hash='#/enquiries'">View Enquiries</button>
            <button class="btn" onclick="location.hash='#/courses'">Manage Courses</button>
            <button class="btn" onclick="location.hash='#/gallery'">Manage Gallery</button>
          </div>
        </div></div>`));
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

  // Students
  if (!Modules.find(m=>m.id==='students')) {
    register({ id:'students', title:'Students', icon:'users', render(el) {
      const rows = (d.students = d.students || []);
      const t = dataTable({
        columns:[
          {key:'systemId',label:'System ID'},
          {key:'name',label:'Name'},
          {key:'phone',label:'Phone'},
          {key:'email',label:'Email'}
        ],
        rows, pageSize:8,
        toolbar:'<button class="btn primary" id="adds">Add Student</button>',
        rowActions:x => `<button class="btn sm" data-es="${x.id}">Edit</button> <button class="btn sm danger" data-ds="${x.id}">Delete</button>`
      });
      el.append(t);
      const form = (item=null, cb)=> modal({ title:item?'Edit Student':'Add Student', confirmLabel:item?'Save':'Add', body:`
        <label class="field">System ID<input name="systemId" value="${esc(item?.systemId||'')}" readonly></label>
        <label class="field">Name<input name="name" required value="${esc(item?.name||'')}"></label>
        <label class="field">Phone<input name="phone" required value="${esc(item?.phone||'')}"></label>
        <label class="field">Email<input name="email" type="email" value="${esc(item?.email||'')}"></label>
      `, onConfirm:cb});
      t.addEventListener('click', async (e)=>{
        if (e.target.id === 'adds') { form({ systemId: makeSystemId(rows) }, async (v)=>{
          rows.unshift({ id: uid('s'), systemId: v.systemId, name: v.name, phone: v.phone, email: v.email });
          await store.save(); t.refresh(); toast('Student added');
        }); return; }
        const es=e.target.dataset.es, ds=e.target.dataset.ds;
        if (es){ const it=rows.find(x=>x.id===es); if(!it)return; form(it, async (v)=>{ it.name=v.name; it.phone=v.phone; it.email=v.email; await store.save(); t.refresh(); toast('Student saved'); }); }
        if (ds){ const idx=rows.findIndex(x=>x.id===ds); if(idx>=0){ rows.splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
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
      const studentName = id => { const s = students.find(x=>x.id===id); return s ? (s.name + (s.phone ? ` (${s.phone})` : '')) : '—'; };
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
            {key:'studentId',label:'Student',render:v=>esc(studentName(v))},
            {key:'courseId',label:'Course',render:v=>esc(courseTitle(v))},
            {key:'finalAmount',label:'Final Amount',render:v=>money(v)},
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
        const adm = editing || { admissionId: nextAdmissionId(), discountType:'amount', discountValue:0, gstTaken:false, admissionFee:'', admissionDate: new Date().toISOString().slice(0,10), referralStudentId:'' };

        el.innerHTML = '';
        const form = h(`<form class="card aform" novalidate>
          <div class="form-head">
            <h2 style="margin:0">${editing ? 'Edit Admission' : 'Add Admission'}</h2>
            <span class="badge">${esc(adm.admissionId)}</span>
          </div>
          <div class="arow full">
            <label class="field">Student<div id="slotStudent"></div></label>
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
            <label class="field">Final Amount<input name="finalAmount" readonly value="0.00"></label>
            <label class="field">Admission Fee<input name="admissionFee" type="number" min="0" step="0.01" value="${adm.admissionFee==null?'':esc(adm.admissionFee)}"></label>
          </div>
          <div class="arow">
            <label class="field">Admission Date<input name="admissionDate" type="date" required value="${esc(adm.admissionDate||'')}"></label>
            <label class="field">Batches<select name="batchId" required><option value="" disabled selected>Select Batch</option></select></label>
            <label class="field">Available Seats for This Batch<input name="availableSeats" readonly value="—"></label>
          </div>
          <div class="arow">
            <label class="field">Referral By<select name="referralStudentId" disabled><option value="">Select Student First</option></select></label>
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
        const finalAmt = q('[name=finalAmount]');
        const batchSel = q('[name=batchId]');
        const availInput = q('[name=availableSeats]');
        const referralSel = q('[name=referralStudentId]');
        const radioVal = name => { const r = form.querySelector(`input[name=${name}]:checked`); return r ? r.value : ''; };

        const studentCombo = comboBox({
          options: students.map(s => ({ value: s.id, label: s.name + (s.phone ? ` (${s.phone})` : '') })),
          placeholder: 'Select Student',
          onChange: () => { populateReferral(); }
        });
        q('#slotStudent').append(studentCombo);
        if (adm.studentId) studentCombo._combo.value = adm.studentId;

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
          finalAmt.value = (taxable + gst).toFixed(2);
        }
        function syncGst() {
          const yes = radioVal('gstTaken') === 'yes';
          gstAmt.disabled = !yes;
          if (!yes) gstAmt.value = '0.00';
          recalc();
        }
        function populateReferral() {
          const sid = studentCombo._combo.value;
          if (!sid) {
            referralSel.disabled = true;
            referralSel.innerHTML = '<option value="">Select Student First</option>';
            return;
          }
          const others = students.filter(s => s.id !== sid);
          referralSel.disabled = false;
          referralSel.innerHTML = '<option value="">Select Referral</option>'
            + others.map(s => `<option value="${esc(s.id)}" ${adm.referralStudentId===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
        }

        // init from existing record
        courseTypeSel.value = adm.courseType || '';
        populateCourses(adm.courseType || '');
        if (adm.courseId) courseSel.value = adm.courseId;
        populateBatches(adm.courseId || '');
        if (adm.batchId) { batchSel.value = adm.batchId; updateAvailable(); }
        populateReferral();
        syncGst();

        courseTypeSel.onchange = () => { populateCourses(courseTypeSel.value); courseSel.value = ''; populateBatches(''); recalc(); };
        courseSel.onchange = () => { populateBatches(courseSel.value); recalc(); };
        batchSel.onchange = updateAvailable;
        discVal.oninput = recalc;
        gstAmt.oninput = recalc;
        form.querySelectorAll('input[name=discountType]').forEach(r => r.onchange = recalc);
        form.querySelectorAll('input[name=gstTaken]').forEach(r => r.onchange = syncGst);
        q('[data-cancel]').onclick = () => showList();

        form.onsubmit = async (e) => {
          e.preventDefault();
          const studentId = studentCombo._combo.value;
          if (!studentId) return toast('Please select a student');
          if (!courseTypeSel.value) return toast('Please select a course type');
          if (!courseSel.value) return toast('Please select a course');
          if (!batchSel.value) return toast('Please select a batch');
          if (!q('[name=admissionDate]').value) return toast('Please select an admission date');
          const course = courses.find(c => c.id === courseSel.value) || {};
          const data = {
            admissionId: adm.admissionId,
            studentId,
            courseType: courseTypeSel.value,
            courseId: courseSel.value,
            courseFee: parseMoney(course.fee),
            discountType: radioVal('discountType') || 'amount',
            discountValue: Number(discVal.value || 0),
            gstTaken: radioVal('gstTaken') === 'yes',
            gstAmount: Number(gstAmt.value || 0),
            finalAmount: Number(finalAmt.value || 0),
            admissionFee: q('[name=admissionFee]').value === '' ? null : Number(q('[name=admissionFee]').value),
            admissionDate: q('[name=admissionDate]').value,
            batchId: batchSel.value,
            referralStudentId: referralSel.disabled ? '' : (referralSel.value || '')
          };
          if (editing) { Object.assign(editing, data); }
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
