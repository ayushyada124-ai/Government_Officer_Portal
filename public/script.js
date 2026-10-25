/* Government Officer Portal - frontend. Talks to the Flask API (/api/...).
   If window.DEMO_MODE is true (preview.html) a built-in browser demo replaces the server. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => d ? String(d).slice(0, 10) : '-';
const badge = t => `<span class="badge ${String(t).toLowerCase().replace(' ', '-')}">${esc(t)}</span>`;
const fld = (n, l, t = 'text', x = '') => `<label>${l}<input name="${n}" type="${t}" ${x}></label>`;
const tbl = (h, r) => r.length ? `<div class="tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.map(x => `<tr>${x.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted pad">Nothing here yet.</p>';
const BASE = window.API_BASE || (location.protocol === 'file:' ? 'http://localhost:5000/api' : '/api');
const S = {token: null, user: null, role: 'officer'};
try { S.token = localStorage.getItem('gp_token'); } catch (e) {}

/* ---------- API ---------- */
async function api(m, p, b) {
  if (window.DEMO_MODE) return new Promise((res, rej) => setTimeout(() => { try { res(route(m, p, b || {})); } catch (e) { rej(e); } }, 120));
    let r;
  try {
    r = await fetch(BASE + p, {method: m, headers: {'Content-Type': 'application/json', ...(S.token ? {Authorization: 'Bearer ' + S.token} : {})}, body: b ? JSON.stringify(b) : undefined});
  } catch (e) {
    throw new Error(navigator.onLine === false ? 'No internet connection. Please check your network and try again.' : 'Cannot reach the server. Please try again in a moment.');
  } const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && S.token) logout(); throw new Error(d.error || 'Request failed'); }
  return d;
}

/* ---------- UI helpers ---------- */
function toast(msg, bad) {
  const t = document.createElement('div'); t.className = 't' + (bad ? ' bad' : ''); t.textContent = msg;
  $('#toast').append(t); setTimeout(() => t.remove(), 3200);
}
function modal(title, html, cb, btn = 'Save') {
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<form class="dlg"><h3>${title}</h3>${html}<div class="row end"><button type="button" class="btn ghost" id="mx">Cancel</button><button class="btn">${btn}</button></div></form>`;
  const close = () => m.hidden = true;
  $('#mx').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.firstChild.onsubmit = async e => { e.preventDefault(); try { await cb(Object.fromEntries(new FormData(e.target))); close(); } catch (x) { toast(x.message, 1); } };
}
document.querySelectorAll('.wheel').forEach(w => {
  w.innerHTML = '<circle cx="50" cy="50" r="46" stroke-width="3"/><circle cx="50" cy="50" r="8" stroke-width="3"/>' +
    Array.from({length: 24}, (_, i) => `<line x1="50" y1="50" x2="${50 + 46 * Math.cos(i * Math.PI / 12)}" y2="${50 + 46 * Math.sin(i * Math.PI / 12)}" stroke-width="1.6"/>`).join('');
});

/* ---------- Auth ---------- */
function setRole(r) {
  S.role = r;
  document.querySelectorAll('#roleTabs button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
  const f = $('#loginForm'); f.email.value = ''; f.password.value = ''; $('#err').textContent = ''; $('#info').textContent = '';
}
$('#roleTabs').onclick = e => e.target.dataset.r && setRole(e.target.dataset.r);
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target; $('#info').textContent = '';
  try {
    const d = await api('POST', '/login', {email: f.email.value, password: f.password.value, role: S.role});
    S.token = d.token; S.user = d.user;
    try { localStorage.setItem('gp_token', d.token); } catch (x) {}
    showApp();
  } catch (x) { $('#err').textContent = x.message; }
};
$('#regLink').onclick = e => {
  e.preventDefault();
  modal('Register as an officer', fld('name', 'Full name', 'text', 'required') + fld('email', 'Email', 'email', 'required') + fld('password', 'Password (6+ characters)', 'password', 'required minlength="6"') + fld('department', 'Department') + fld('designation', 'Designation') + fld('phone', 'Phone', 'tel'),
    async d => { const r = await api('POST', '/register', d); $('#err').textContent = ''; $('#info').textContent = r.message || 'Registration sent. You can sign in after the admin approves it.'; }, 'Send registration');
};
function logout() {
  S.token = S.user = null; try { localStorage.removeItem('gp_token'); } catch (e) {}
  $('#app').hidden = true; $('#login').hidden = false; setRole(S.role);
}

/* ---------- Shell ---------- */
const NAV = {
  admin: [['dashboard','🏠','Dashboard'],['officers','👥','Officers'],['registrations','📝','Registrations'],['tasks','📋','Tasks'],['leaves','🗓️','Leave requests'],['attendance','🕘','Attendance'],['reports','📈','Reports'],['news','📢','Announcements'],['profile','👤','My profile']],
  officer: [['dashboard','🏠','Dashboard'],['tasks','📋','My tasks'],['leaves','🗓️','My leave'],['attendance','🕘','My attendance'],['news','📢','Announcements'],['profile','👤','My profile']]
};
function showApp() {
  const u = S.user, adm = u.role === 'admin';
  $('#login').hidden = true; $('#app').hidden = false;
  $('#date').textContent = new Date().toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  $('#side').innerHTML = `<div class="brand"><span style="font-size:1.6rem">🏛️</span><span>Govt. Officer Portal<small>${adm ? 'Admin console' : 'Officer workspace'}</small></span></div>
    <nav>${NAV[u.role].map(n => `<button class="nv" data-v="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join('')}</nav>
    <div class="me"><b>${esc(u.name)}</b><small>${adm ? 'Administrator' : esc(u.designation)}</small><button class="btn ghost sm" id="out">Sign out</button></div>`;
  $('#side').querySelector('nav').onclick = e => { const b = e.target.closest('.nv'); b && go(b.dataset.v); };
  $('#out').onclick = logout;
  go('dashboard');
  regBadge();
}
async function regBadge() {  // shows how many registrations are waiting next to the menu item
  if (!S.user || S.user.role !== 'admin') return;
  try {
    const n = (await api('GET', '/registrations')).filter(r => r.status === 'Pending').length;
    const b = document.querySelector('.nv[data-v=registrations]'); if (!b) return;
    const old = b.querySelector('.cnt'); if (old) old.remove();
    if (n) b.insertAdjacentHTML('beforeend', `<span class="cnt">${n}</span>`);
  } catch (e) {}
}
$('#burger').onclick = () => $('#side').classList.toggle('open');
async function go(v) {
  document.querySelectorAll('.nv').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#title').textContent = NAV[S.user.role].find(x => x[0] === v)[2];
  $('#side').classList.remove('open');
  try { await V[v]($('#view')); } catch (e) { $('#view').innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
}

/* ---------- Views ---------- */
const V = {};
V.dashboard = async el => {
  const adm = S.user.role === 'admin';
  const [s, ann, items] = await Promise.all([api('GET', '/stats'), api('GET', '/announcements'), api('GET', adm ? '/leaves' : '/tasks')]);
  const cards = adm
    ? [['Officers', s.officers, '👥', 'c1'], ['Total tasks', s.tasks, '📋', 'c2'], ['Completed', s.completed, '✅', 'c3'], ['Leave to review', s.pending_leaves, '⏳', 'c4']]
    : [['My tasks', s.tasks, '📋', 'c1'], ['In progress', s.progress, '🔧', 'c2'], ['Completed', s.completed, '✅', 'c3'], ['Leave requests', s.leaves, '🗓️', 'c4']];
  const mx = Math.max(1, s.pending, s.progress, s.completed);
  const bar = (l, v, c) => `<div class="bar"><span>${l}</span><div><i class="${c}" style="width:${v / mx * 100}%"></i></div><b>${v}</b></div>`;
  const rows = adm
    ? items.filter(l => l.status === 'Pending').slice(0, 5).map(l => [`<b>${esc(l.officer_name)}</b>`, fmt(l.from_date) + ' to ' + fmt(l.to_date), esc(l.reason)])
    : items.filter(t => t.status !== 'Completed').slice(0, 5).map(t => [`<b>${esc(t.title)}</b>`, badge(t.priority), fmt(t.due_date), badge(t.status)]);
  el.innerHTML = `<div class="hello"><h2>Welcome, ${esc(S.user.name)}</h2><p>${esc(S.user.designation)}, ${esc(S.user.department)}</p></div>
    <div class="grid4">${cards.map(c => `<div class="stat ${c[3]}"><span class="ic">${c[2]}</span><div><b>${c[1]}</b><small>${c[0]}</small></div></div>`).join('')}</div>
    <div class="grid2"><div class="card"><h3>Task status</h3>${bar('Pending', s.pending, 'bp')}${bar('In progress', s.progress, 'bi')}${bar('Completed', s.completed, 'bc')}</div>
    <div class="card"><h3>Latest announcements</h3>${ann.slice(0, 3).map(a => `<div class="note"><b>${esc(a.title)}</b><p>${esc(a.body)}</p><small>${fmt(a.created_at)}</small></div>`).join('') || '<p class="muted">No announcements yet.</p>'}</div></div>
    <div class="card"><div class="bar-top"><h3>${adm ? 'Leave waiting for your decision' : 'Tasks that need your attention'}</h3><button class="btn ghost sm" id="all">Open ${adm ? 'leave requests' : 'my tasks'}</button></div>
    ${tbl(adm ? ['Officer', 'Dates', 'Reason'] : ['Task', 'Priority', 'Due', 'Status'], rows)}</div>`;
  $('#all').onclick = () => go(adm ? 'leaves' : 'tasks');
};

V.officers = async el => {
  let list = await api('GET', '/officers');
  el.innerHTML = `<div class="bar-top"><input id="q" class="search" placeholder="Search officers"><button class="btn" id="add">Add officer</button></div><div class="card" id="box"></div>`;
  const draw = () => { const k = $('#q').value.toLowerCase();
    $('#box').innerHTML = tbl(['Name', 'Email', 'Department', 'Designation', 'Phone', ''], list.filter(o => JSON.stringify(o).toLowerCase().includes(k))
      .map(o => [`<b>${esc(o.name)}</b>`, esc(o.email), esc(o.department), esc(o.designation), esc(o.phone) || '-', `<button class="btn sm danger" data-del="${o.id}">Remove</button>`])); };
  draw(); $('#q').oninput = draw;
  $('#box').onclick = async e => { const id = e.target.dataset.del;
    if (id && confirm('Remove this officer and all their tasks and leave records?')) { await api('DELETE', '/officers/' + id); list = list.filter(o => o.id != id); draw(); toast('Officer removed'); } };
  $('#add').onclick = () => modal('Add officer', fld('name', 'Full name', 'text', 'required') + fld('email', 'Email', 'email', 'required') + fld('password', 'Password (6+ characters)', 'password', 'required minlength="6"') + fld('department', 'Department') + fld('designation', 'Designation') + fld('phone', 'Phone', 'tel'),
    async d => { await api('POST', '/officers', d); toast('Officer added'); V.officers(el); }, 'Add officer');
};

V.tasks = async el => {
  const adm = S.user.role === 'admin'; let list = await api('GET', '/tasks'), f = 'All';
  el.innerHTML = `<div class="bar-top"><div class="chips">${['All', 'Pending', 'In Progress', 'Completed'].map(x => `<button class="chip${x === 'All' ? ' on' : ''}">${x}</button>`).join('')}</div>${adm ? '<button class="btn" id="add">Assign task</button>' : ''}</div><div class="card" id="box"></div>`;
    const draw = () => $('#box').innerHTML = tbl(['Task', ...(adm ? ['Officer'] : []), 'Priority', 'Due', 'Status', ...(adm ? [''] : [])],
    list.filter(t => f === 'All' || t.status === f).map(t => [`<b>${esc(t.title)}</b><small class="d">${esc(t.description)}</small>`, ...(adm ? [esc(t.officer_name)] : []), badge(t.priority), fmt(t.due_date),
      adm ? badge(t.status) : `<select data-st="${t.id}">${['Pending', 'In Progress', 'Completed'].map(s => `<option${s === t.status ? ' selected' : ''}>${s}</option>`).join('')}</select>`, ...(adm ? [`<button class="btn sm danger" data-del="${t.id}">Delete</button>`] : [])]));
  draw();
      el.querySelector('.chips').onclick = e => { if (e.target.classList.contains('chip')) { f = e.target.textContent; el.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.target)); draw(); } };
  $('#box').onchange = async e => { const id = e.target.dataset.st; if (!id) return;
    try { await api('PUT', '/tasks/' + id, {status: e.target.value}); list.find(t => t.id == id).status = e.target.value; toast('Task marked ' + e.target.value.toLowerCase()); draw(); } catch (x) { toast(x.message, 1); } };
  $('#box').onclick = async e => { const id = e.target.dataset.del;
    if (id && confirm('Delete this task?')) { await api('DELETE', '/tasks/' + id); list = list.filter(t => t.id != id); draw(); toast('Task deleted'); } };
  if (adm) $('#add').onclick = async () => { const off = await api('GET', '/officers');
    if (!off.length) return toast('Add an officer first', 1);
    modal('Assign task', fld('title', 'Task title', 'text', 'required') + `<label>Description<textarea name="description"></textarea></label>
      <label>Officer<select name="officer_id">${off.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
      <label>Priority<select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></label>` + fld('due_date', 'Due date', 'date'),
      async d => { await api('POST', '/tasks', d); toast('Task assigned'); V.tasks(el); }, 'Assign task'); };
};

V.leaves = async el => {
  const adm = S.user.role === 'admin'; let list = await api('GET', '/leaves');
  el.innerHTML = `<div class="bar-top"><h3>${adm ? 'All leave requests' : 'My leave applications'}</h3>${adm ? '' : '<button class="btn" id="add">Apply for leave</button>'}</div><div class="card" id="box"></div>`;
  const draw = () => $('#box').innerHTML = tbl([...(adm ? ['Officer'] : []), 'From', 'To', 'Reason', 'Status', ...(adm ? ['Decision'] : [])],
    list.map(l => [...(adm ? [`<b>${esc(l.officer_name)}</b>`] : []), fmt(l.from_date), fmt(l.to_date), esc(l.reason), badge(l.status),
      ...(adm ? [l.status === 'Pending' ? `<button class="btn sm ok" data-s="Approved" data-id="${l.id}">Approve</button> <button class="btn sm danger" data-s="Rejected" data-id="${l.id}">Reject</button>` : '-'] : [])]));
  draw();
  $('#box').onclick = async e => { const {s, id} = e.target.dataset; if (!s) return;
    await api('PUT', '/leaves/' + id, {status: s}); list.find(l => l.id == id).status = s; draw(); toast('Leave ' + s.toLowerCase()); };
  if (!adm) $('#add').onclick = () => modal('Apply for leave', fld('from_date', 'From', 'date', 'required') + fld('to_date', 'To', 'date', 'required') + `<label>Reason<textarea name="reason" required></textarea></label>`,
    async d => { await api('POST', '/leaves', d); toast('Leave application sent'); V.leaves(el); }, 'Send application');
};

V.news = async el => {
   const adm = S.user.role === 'admin'; let list = await api('GET', '/announcements');
   el.innerHTML = `<div class="bar-top"><h3>Department announcements</h3>${adm ? '<button class="btn" id="add">New announcement</button>' : ''}</div><div id="box" class="grid2"></div>`;
  const draw = () => $('#box').innerHTML = list.map(a => `<div class="card"><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p><div class="bar-top" style="margin-top:12px"><small class="muted">${fmt(a.created_at)}</small>${adm ? `<button class="btn sm danger" data-del="${a.id}">Delete</button>` : ''}</div></div>`).join('') || '<p class="muted">No announcements yet.</p>';
  draw()
  $('#box').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Delete this announcement?')) { await api('DELETE', '/announcements/' + id); list = list.filter(a => a.id != id); draw(); toast('Announcement deleted'); } };
  if (adm) $('#add').onclick = () => modal('New announcement', fld('title', 'Title', 'text', 'required') + `<label>Message<textarea name="body" required></textarea></label>`,
    async d => { await api('POST', '/announcements', d); toast('Announcement posted'); V.news(el); }, 'Post announcement');
};

V.profile = async el => {
  const u = S.user;
  el.innerHTML = `<div class="card prof"><div class="av">${esc(u.name[0])}</div><div><h3>${esc(u.name)}</h3><p class="muted">${esc(u.designation)}, ${esc(u.department)}</p><p>✉️ ${esc(u.email)}</p><p>🛡️ ${u.role === 'admin' ? 'Administrator' : 'Government officer'}</p></div></div>
    <form class="card" id="pf" style="display:grid;gap:12px;max-width:460px"><h3>Update my details</h3>${fld('phone', 'Phone', 'tel', `value="${esc(u.phone)}"`)}${fld('password', 'New password (leave blank to keep current)', 'password', 'minlength="6"')}<button class="btn">Save changes</button></form>`;
  $('#pf').onsubmit = async e => { e.preventDefault(); try { S.user = await api('PUT', '/me', Object.fromEntries(new FormData(e.target))); toast('Profile saved'); V.profile(el); } catch (x) { toast(x.message, 1); } };
};

V.registrations = async el => {
  let list = await api('GET', '/registrations');
  el.innerHTML = `<div class="bar-top"><h3>Officer registration requests</h3></div><div class="card" id="box"></div>`;
  const draw = () => $('#box').innerHTML = tbl(['Name', 'Email', 'Department', 'Designation', 'Phone', 'Applied', 'Status', 'Decision'],
    list.map(r => [`<b>${esc(r.name)}</b>`, esc(r.email), esc(r.department) || '-', esc(r.designation) || '-', esc(r.phone) || '-', fmt(r.created_at), badge(r.status),
      `<div class="acts"><button class="btn sm ok" data-s="Approved" data-id="${r.id}">Approve</button>${r.status === 'Pending' ? `<button class="btn sm danger" data-s="Rejected" data-id="${r.id}">Reject</button>` : ''}</div>`]));
  draw();
  $('#box').onclick = async e => { const {s, id} = e.target.dataset; if (!s) return;
    try {
      await api('PUT', '/registrations/' + id, {status: s});
      toast(s === 'Approved' ? 'Officer approved. They can sign in now.' : 'Registration rejected');
      list = s === 'Approved' ? list.filter(r => r.id != id) : list.map(r => r.id == id ? {...r, status: 'Rejected'} : r);
      draw(); regBadge();
    } catch (x) { toast(x.message, 1); } };
};

/* ---------- Attendance ---------- */
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const hm = t => t ? String(t).slice(0, 5) : '-';
const pill = (t, c) => `<span class="badge ${c}">${t}</span>`;
V.attendance = async el => {
  const adm = S.user.role === 'admin', list = await api('GET', '/attendance'), t = today();
  if (adm) {
    const off = await api('GET', '/officers'), inToday = list.filter(a => fmt(a.att_date) === t);
    const rows = off.map(o => { const a = inToday.find(x => x.officer_id === o.id);
      return [`<b>${esc(o.name)}</b>`, esc(o.department), a ? pill('Present', 'approved') : pill('Absent', 'rejected'), a ? hm(a.check_in) : '-', a ? hm(a.check_out) : '-']; });
    el.innerHTML = `<div class="grid4"><div class="stat c3"><span class="ic">✅</span><div><b>${inToday.length}</b><small>Present today</small></div></div>
      <div class="stat c4"><span class="ic">🚫</span><div><b>${off.length - inToday.length}</b><small>Absent today</small></div></div></div>
      <div class="card"><h3>Today, ${t}</h3>${tbl(['Officer', 'Department', 'Status', 'Check in', 'Check out'], rows)}</div>
      <div class="card"><h3>Recent attendance</h3>${tbl(['Date', 'Officer', 'Check in', 'Check out'], list.slice(0, 30).map(a => [fmt(a.att_date), esc(a.officer_name), hm(a.check_in), hm(a.check_out)]))}</div>`;
    return;
  }
  const r = list.find(a => fmt(a.att_date) === t);
  const act = async p => { try { await api('POST', p); toast(p.endsWith('checkin') ? 'Checked in' : 'Checked out'); V.attendance(el); } catch (x) { toast(x.message, 1); } };
  el.innerHTML = `<div class="hello"><h2>${r ? (r.check_out ? 'Your day is complete' : 'You are checked in') : 'You have not checked in yet'}</h2>
    <p>${t}${r ? ', in at ' + hm(r.check_in) + (r.check_out ? ', out at ' + hm(r.check_out) : '') : ''}</p></div>
    ${!r ? '<div><button class="btn" id="cin">Check in</button></div>' : !r.check_out ? '<div><button class="btn ok" id="cout">Check out</button></div>' : ''}
    <div class="card"><h3>My attendance history</h3>${tbl(['Date', 'Check in', 'Check out'], list.map(a => [fmt(a.att_date), hm(a.check_in), hm(a.check_out)]))}</div>`;
  if ($('#cin')) $('#cin').onclick = () => act('/attendance/checkin');
  if ($('#cout')) $('#cout').onclick = () => act('/attendance/checkout');
};

/* ---------- Reports (admin) ---------- */
V.reports = async el => {
  const rows = await api('GET', '/reports');
  const tot = k => rows.reduce((n, r) => n + Number(r[k]), 0);
  const seg = (v, c, t) => v ? `<i class="${c}" style="flex:${v}" title="${t}: ${v}"></i>` : '';
  el.innerHTML = `<div class="grid4">${[['Total tasks', tot('total'), '📋', 'c1'], ['Completed', tot('completed'), '✅', 'c3'], ['Overdue', tot('overdue'), '⚠️', 'c4'], ['Officers', rows.length, '👥', 'c2']]
      .map(c => `<div class="stat ${c[3]}"><span class="ic">${c[2]}</span><div><b>${c[1]}</b><small>${c[0]}</small></div></div>`).join('')}</div>
    <div class="card"><div class="bar-top"><h3>Task progress by officer</h3><button class="btn" id="csv">Download CSV</button></div>
    <p class="muted">Green is completed, blue is in progress, orange is pending.</p>
    ${tbl(['Officer', 'Department', 'Progress', 'Done', 'Overdue', 'Present this month'], rows.map(r => [`<b>${esc(r.name)}</b>`, esc(r.department),
      `<div class="stk">${seg(r.completed, 'bc', 'Completed')}${seg(r.progress, 'bi', 'In progress')}${seg(r.pending, 'bp', 'Pending')}</div>`,
      r.total ? Math.round(r.completed / r.total * 100) + '%' : '-', r.overdue, r.present + ' days']))}</div>`;
  $('#csv').onclick = () => {
    const head = ['Officer', 'Department', 'Total tasks', 'Completed', 'In progress', 'Pending', 'Overdue', 'Days present this month'];
    const lines = [head, ...rows.map(r => [r.name, r.department, r.total, r.completed, r.progress, r.pending, r.overdue, r.present])]
      .map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'}));
    a.download = 'officer-report.csv'; a.click();
  };
};



/* ---------- Start ---------- */
$('#demoNote').hidden = !window.DEMO_MODE;
setRole('officer');
if (S.token) api('GET', '/me').then(u => { S.user = u; S.role = u.role; showApp(); }).catch(logout);
