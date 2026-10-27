const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AREAS = ['ধানমন্ডি', 'মিরপুর', 'উত্তরা', 'গুলশান', 'বনানী', 'মোহাম্মদপুর'];

/* থিম মনে রাখা */
try { const th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th; } catch {}

/* ---------- সার্ভারের সঙ্গে যোগাযোগ ---------- */
const API = 'api/';
async function call(file, { method = 'GET', body } = {}) {
  const headers = { 'X-Requested-With': 'fetch' };
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(API + file, { method, headers, body: payload, credentials: 'same-origin' }); }
  catch { throw new Error('সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না। XAMPP-এর Apache ও MySQL চালু আছে কিনা দেখুন'); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || 'কিছু ভুল হয়েছে');
  return j;
}
const Api = {
  async register(d) {
    const fd = new FormData();
    ['role', 'name', 'phone', 'area', 'password', 'nid_number'].forEach(k => d[k] !== undefined && fd.append(k, d[k]));
    if (d.role === 'helper') {
      fd.append('nid_front', await (await fetch(d.nid_front)).blob(), 'front.jpg');
      fd.append('nid_back', await (await fetch(d.nid_back)).blob(), 'back.jpg');
    }
    return call('register.php', { method: 'POST', body: fd });
  },
  login: (phone, password) => call('login.php', { method: 'POST', body: { phone, password } }),
  async me() { try { const u = await call('me.php'); return u && u.role === 'admin' ? null : u; } catch { return null; } },
  logout: () => call('logout.php', { method: 'POST' }).catch(() => {})
};

/* ---------- ছোট সহায়ক ফাংশন ---------- */
const norm = p => { let d = String(p).replace(/\D/g, ''); if (d.startsWith('880')) d = d.slice(2); return d.startsWith('0') ? d : '0' + d; };
const fmtDate = iso => new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
let tt; function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + type;
  clearTimeout(tt); tt = setTimeout(() => t.className = 'toast', 3400);
}
function openModal(html) { $('#mbox').innerHTML = `<button class="mx" aria-label="বন্ধ করুন">✕</button>${html}`; $('#modal').classList.add('on'); }
const closeModal = () => $('#modal').classList.remove('on');
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.classList.contains('mx')) closeModal(); });
document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());

/* ছবি ছোট করে পাঠানো (NID আপলোডের আগে সাইজ কমে) */
const readImage = file => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => { const im = new Image(); im.onload = () => {
    const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    res(c.toDataURL('image/jpeg', .72)); }; im.onerror = rej; im.src = fr.result; };
  fr.onerror = rej; fr.readAsDataURL(file);
});

/* ---------- পেজ নিয়ন্ত্রণ ---------- */
function show(name) { $$('.view').forEach(v => v.classList.remove('on')); $('#v-' + name).classList.add('on'); scrollTo(0, 0); }
async function renderNav() {
  const u = await Api.me();
  $('#navAuth').innerHTML = `<button class="icon" id="theme" aria-label="থিম বদলান">${document.documentElement.dataset.theme === 'dark' ? '☾' : '☀'}</button>` +
    (u ? `${typeof Notif !== 'undefined' ? Notif.bell() : ''}<span class="uname">${esc(u.name)}</span><a class="btn line sm" href="#" data-go="dash">ড্যাশবোর্ড</a><button class="btn main sm" id="logout">লগআউট</button>`
       : `<a class="btn line sm" href="#" data-go="login">লগইন</a><a class="btn main sm" href="#" data-go="register">সাইন আপ</a>`);
  if (typeof Notif !== 'undefined') u ? Notif.start() : Notif.stop();
}
async function route() {
  const u = await Api.me(); await renderNav();
  if (!u) return show('home');
  if (u.role === 'helper' && u.status !== 'approved') { renderPending(u); return show('pending'); }
  if (typeof Dash === 'undefined') return toast('tasks.js লোড হয়নি। ফাইলটি ঠিক জায়গায় আছে কিনা দেখুন', 'err');
  await Dash.render(u); show('dash');
}

/* ---------- সহায়কের অনুমোদনের অবস্থা ---------- */
function renderPending(u) {
  const rej = u.status === 'rejected';
  $('#pendingBox').innerHTML = `
    <div class="bigicon">${rej ? '✕' : '⏳'}</div>
    <span class="badge ${u.status}">${rej ? 'বাতিল' : 'অনুমোদনের অপেক্ষায়'}</span>
    <h2 style="margin-top:14px">${rej ? 'আবেদন গৃহীত হয়নি' : 'আপনার NID যাচাই চলছে'}</h2>
    <p>${rej ? 'অ্যাডমিন আপনার আবেদনটি বাতিল করেছেন।' : 'অ্যাডমিন আপনার NID দেখে অনুমোদন দিলে একাউন্ট চালু হবে। অনুগ্রহ করে অপেক্ষা করুন।'}</p>
    ${rej && u.reason ? `<p class="reason"><b>কারণ:</b> ${esc(u.reason)}</p>` : ''}
    <button class="btn main" id="recheck">অবস্থা আবার দেখুন</button>
    <button class="btn line" id="logout2">লগআউট</button>`;
}

/* ---------- সাইন আপ ফর্ম ---------- */
$('#areaSel').innerHTML = AREAS.map(a => `<option>${a}</option>`).join('');
const imgs = {};
[['dropFront', 'front'], ['dropBack', 'back']].forEach(([id, key]) => {
  const box = $('#' + id), input = $('input', box);
  input.addEventListener('change', async () => {
    const f = input.files[0]; if (!f) return;
    if (!f.type.startsWith('image/')) return toast('শুধু ছবি আপলোড করুন', 'err');
    imgs[key] = await readImage(f); $('img', box).src = imgs[key]; box.classList.add('has');
  });
});
$$('#regForm [name=role]').forEach(r => r.addEventListener('change', () => $('#helperBox').classList.toggle('on', r.value === 'helper' && r.checked)));
$('#regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target), role = fd.get('role');
  const d = { role, name: fd.get('name').trim(), phone: norm(fd.get('phone')), area: fd.get('area'), password: fd.get('password') };
  if (d.name.length < 3) return toast('পুরো নাম লিখুন', 'err');
  if (!/^01\d{9}$/.test(d.phone)) return toast('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন', 'err');
  if (d.password.length < 6) return toast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'err');
  if (role === 'helper') {
    d.nid_number = String(fd.get('nid_number')).trim();
    if (!/^(\d{10}|\d{13}|\d{17})$/.test(d.nid_number)) return toast('NID নম্বর ১০, ১৩ বা ১৭ সংখ্যার হতে হবে', 'err');
    if (!imgs.front || !imgs.back) return toast('NID-এর সামনের ও পেছনের ছবি দিন', 'err');
    d.nid_front = imgs.front; d.nid_back = imgs.back;
  }
  try {
    await Api.register(d);
    toast(role === 'helper' ? 'আবেদন জমা হয়েছে। অ্যাডমিনের অনুমোদনের অপেক্ষা করুন' : 'একাউন্ট তৈরি হয়েছে');
    e.target.reset(); $('#helperBox').classList.remove('on'); $$('.drop').forEach(x => x.classList.remove('has')); delete imgs.front; delete imgs.back;
    route();
  } catch (err) { toast(err.message, 'err'); }
});

/* ---------- লগইন ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { await Api.login(norm(fd.get('phone')), fd.get('password')); e.target.reset(); route(); }
  catch (err) { toast(err.message, 'err'); }
});

/* ---------- নেভিগেশন, থিম, লগআউট ---------- */
document.addEventListener('click', async e => {
  const go = e.target.closest('[data-go]'), sec = e.target.closest('[data-sec]');
  if (go) {
    e.preventDefault();
    if (go.dataset.go === 'dash') return route();
    if (go.dataset.go === 'home') { show('home'); renderNav(); return; }
    show(go.dataset.go);
    if (go.dataset.role) { const r = $(`#regForm [value=${go.dataset.role}]`); r.checked = true; r.dispatchEvent(new Event('change')); }
  }
  if (sec) { e.preventDefault(); show('home'); setTimeout(() => document.getElementById(sec.dataset.sec).scrollIntoView({ behavior: 'smooth' }), 60); }
  if (e.target.closest('#theme')) {
    const root = document.documentElement; root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    $('#theme').textContent = root.dataset.theme === 'dark' ? '☾' : '☀';
  }
  if (e.target.closest('#logout') || e.target.closest('#logout2')) { await Api.logout(); toast('লগআউট হয়েছে'); route(); }
  if (e.target.closest('#recheck')) { await route(); const u = await Api.me(); if (u && u.status === 'pending') toast('এখনো অনুমোদন হয়নি'); }
});

/* ---------- হোম পেজের অংশ ---------- */
$('#marq').innerHTML = [...AREAS, ...AREAS, ...AREAS, ...AREAS].map(a => `<span>${a}</span>`).join('');
$$('.tab[data-p]').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab[data-p]').forEach(t => t.classList.remove('on')); $$('.panel').forEach(p => p.classList.remove('on'));
  tab.classList.add('on'); $$('.panel')[+tab.dataset.p].classList.add('on');
}));
$('#areaList').innerHTML = AREAS.map(a => `<button class="area">${a}</button>`).join('');
$$('.area').forEach(btn => btn.addEventListener('click', () => {
  $$('.area').forEach(x => x.classList.remove('on')); btn.classList.add('on');
  $('#find').innerHTML = `<b>${btn.textContent}</b> এলাকায় সহায়ক বা সেবা গ্রহণকারী হিসেবে <a href="#" data-go="register">নিবন্ধন করুন</a>।`;
}));

route();

if (location.protocol === 'file:') document.body.insertAdjacentHTML('afterbegin', '<div class="warnbar">⚠ পেজটি ফাইল হিসেবে খোলা হয়েছে, তাই সার্ভারের সঙ্গে যুক্ত হবে না। XAMPP চালু করে <b>http://localhost:8080/shohayok/</b> ঠিকানায় খুলুন (পোর্ট আলাদা হলে সেটি দিন)।</div>');
