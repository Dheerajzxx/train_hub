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
      $('#addc', t)?.addEventListener('click', ()=> addForm(null, async (v)=>{
        const c = { id: uid('c'), title:v.title, category:v.category, fee:v.fee, duration:v.duration, short:v.short, active: v.active==='true' };
        (d.courses||[]).unshift(c); await store.save(); t.refresh(); toast('Course added');
      }));
      t.addEventListener('click', async (e)=>{
        const ec = e.target.dataset.ec, tc = e.target.dataset.tc, dc = e.target.dataset.dc;
        if (ec) { const it = (d.courses||[]).find(x=>x.id===ec); if (!it) return; addForm(it, async (v)=>{ Object.assign(it,{title:v.title,category:v.category,fee:v.fee,duration:v.duration,short:v.short,active:v.active==='true'}); await store.save(); t.refresh(); toast('Course saved'); }); }
        if (tc) { const it = (d.courses||[]).find(x=>x.id===tc); if (!it) return; it.active = !it.active; await store.save(); t.refresh(); toast(it.active?'Enabled':'Disabled'); }
        if (dc) { const idx=(d.courses||[]).findIndex(x=>x.id===dc); if (idx>=0){ (d.courses||[]).splice(idx,1); await store.save(); t.refresh(); toast('Deleted'); } }
      });
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
      $('#addg', t)?.addEventListener('click', ()=> addForm(null, async (v)=>{ (d.gallery||[]).unshift({id:uid('g'), src:v.src, alt:v.alt, visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Added'); }));
      t.addEventListener('click', async (e)=>{
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
      $('#addt', t)?.addEventListener('click', ()=> addForm(null, async (v)=>{ (d.testimonials||[]).unshift({id:uid('t'), name:v.name, role:v.role, avatar:v.avatar, quote:v.quote, visible:v.visible==='true'}); await store.save(); t.refresh(); toast('Added'); }));
      t.addEventListener('click', async (e)=>{
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
      $('#addp', t)?.addEventListener('click', ()=> addForm(null, async (v)=>{ (d.placements||[]).unshift({id:uid('p'), company:v.company, year:v.year, count:Number(v.count||0), logo:v.logo}); await store.save(); t.refresh(); toast('Added'); }));
      t.addEventListener('click', async (e)=>{
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
