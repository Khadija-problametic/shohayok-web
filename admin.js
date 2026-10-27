/* Shohayok অ্যাডমিন পোর্টাল: লগইন · লগআউট · NID অনুমোদন/বাতিল · অভিযোগ নিষ্পত্তি · কাজের মনিটর */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API = 'api/';

async function call(file, { method = 'GET', body } = {}) {
  const headers = { 'X-Requested-With': 'fetch' };
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(API + file, { method, headers, body: payload, credentials: 'same-origin' }); }
  catch { throw new Error('সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না। Apache ও MySQL চালু আছে কিনা দেখুন'); }
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((j && j.error) || 'কিছু ভুল হয়েছে'); e.status = r.status; throw e; }
  return j;
}
const Api = {
  users:  () => call('admin_helpers.php'),
  login:  (phone, password) => call('admin_login.php', { method: 'POST', body: { phone, password } }),
  me:     async () => { try { return await call('me.php'); } catch { return null; } },
  logout: () => call('logout.php', { method: 'POST' }).catch(() => {}),
  review: (id, status, reason = '') => call('admin_review.php', { method: 'POST', body: { id, status, reason } })
};

const norm = p => { let d = String(p).replace(/\D/g, ''); if (d.startsWith('880')) d = d.slice(2); return d.startsWith('0') ? d : '0' + d; };
const fmtDate = iso => new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
let tt; function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + type;
  clearTimeout(tt); tt = setTimeout(() => t.className = 'toast', 3200);
}
function openModal(html) { $('#mbox').innerHTML = `<button class="mx" aria-label="বন্ধ করুন">✕</button>${html}`; $('#modal').classList.add('on'); }
const closeModal = () => $('#modal').classList.remove('on');
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.classList.contains('mx')) closeModal(); });
document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());

/* ---------- লগইন / লগআউট ও সেশন ---------- */
const showView = n => { $$('.view').forEach(v => v.classList.remove('on')); $('#v-' + n).classList.add('on'); scrollTo(0, 0); };
const themeBtn = () => `<button class="icon" id="theme" aria-label="থিম বদলান">${document.documentElement.dataset.theme === 'dark' ? '☾' : '☀'}</button>`;

function loggedOutView(msg) {
  sig = ''; $('#aList').innerHTML = ''; $('#aStats').innerHTML = ''; closeModal();
  $('#aNav').innerHTML = themeBtn();
  showView('alogin');
  if (msg) toast(msg, 'err');
}
async function boot() {
  const u = await Api.me();
  if (!u || u.role !== 'admin') return loggedOutView();
  $('#aNav').innerHTML = themeBtn() + `<span class="uname">${esc(u.name)}</span><button class="btn main sm" id="alogout">লগআউট</button>`;
  showView('admin');
  await renderAdmin();
}
$('#aLogin').addEventListener('submit', async e => {
  e.preventDefault(); const fd = new FormData(e.target), btn = $('button', e.target);
  const phone = norm(fd.get('phone'));
  if (!/^01\d{9}$/.test(phone)) return toast('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন', 'err');
  btn.disabled = true;
  try { await Api.login(phone, fd.get('password')); e.target.reset(); toast('স্বাগতম'); await boot(); }
  catch (err) { toast(err.message, 'err'); }
  btn.disabled = false;
});
document.addEventListener('click', async e => {
  if (e.target.closest('#theme')) { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; e.target.closest('#theme').textContent = r.dataset.theme === 'dark' ? '☾' : '☀'; }
  if (e.target.closest('#alogout')) { await Api.logout(); loggedOutView(); toast('লগআউট হয়েছে'); }
});

/* ---------- ড্যাশবোর্ড ---------- */
let adminTab = 'pending', sig = '';
const LBL = { pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'বাতিল', dispute: '⚠️ বিতর্ক' };
const CAT_NAME = { pharmacy: 'ওষুধ', grocery: 'বাজার', hospital: 'হাসপাতালে সঙ্গী', other: 'অন্যান্য' };

async function renderAdmin(quiet = false) {
  let hs = [], allTasks = [];
  try { 
    hs = await Api.users(); 
    const taskRes = await call('tasks.php').catch(() => ({ tasks: [] }));
    allTasks = taskRes.tasks || [];
  }
  catch (err) { return (err.status === 401 || err.status === 403) ? loggedOutView('সেশন শেষ হয়েছে, আবার লগইন করুন') : toast(err.message, 'err'); }
  
  const cnt = s => hs.filter(h => h.status === s).length;
  // Server-side calculated admin_fee use kora hocche[cite: 2]
  const adminIncome = allTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + Number(t.admin_fee ?? (Number(t.base_fee) * 0.10)), 0);

  $('#aStats').innerHTML = `
    <div><b>${cnt('pending').toLocaleString('bn-BD')}</b><span>অপেক্ষমাণ</span></div>
    <div><b>${cnt('approved').toLocaleString('bn-BD')}</b><span>অনুমোদিত</span></div>
    <div><b>${cnt('rejected').toLocaleString('bn-BD')}</b><span>বাতিল</span></div>
    <div><b style="color:var(--teal)">৳${adminIncome.toLocaleString('bn-BD')}</b><span>অ্যাডমিন ইনকাম (১০%)</span></div>
  `;

  $$('#aTabs .tab').forEach(t => {
    t.classList.toggle('on', t.dataset.s === adminTab);
    if (t.dataset.s === 'pending') t.textContent = 'অপেক্ষমাণ' + (cnt('pending') ? ` (${cnt('pending').toLocaleString('bn-BD')})` : '');
  });

  if (adminTab === 'tasks') { try { $('#aList').innerHTML = await Dash.adminTasks(); } catch (err) { toast(err.message, 'err'); } return; }

  /* --- বিতর্ক / অভিযোগ ট্যাব --- */
  if (adminTab === 'dispute') {
    const disputes = allTasks.filter(t => t.is_disputed || t.dispute_reason);
    $('#aList').innerHTML = disputes.length ? disputes.map(t => `
      <div class="acard" style="border:1.5px solid var(--rose);">
        <div>
          <h3>কাজ #${t.id} · ${esc(CAT_NAME[t.category] || t.category)} <span class="badge rejected">অভিযোগাধীন</span></h3>
          <div class="meta" style="margin-top:8px">
            <span>👴 প্রবীণ: <b>${esc(t.requester_name)}</b> (${esc(t.requester_phone)})</span>
            <span>🤝 সহায়ক: <b>${esc(t.helper_name || 'নির্ধারিত হয়নি')}</b> (${esc(t.helper_phone || '-')})</span>
          </div>
          <div class="reason" style="margin-top:10px">
            <b>অভিযোগকারী (${esc(t.dispute_by || 'ব্যবহারকারী')}):</b> ${esc(t.dispute_reason)}
          </div>
          ${t.admin_note ? `<div class="meta" style="margin-top:6px"><b>অ্যাডমিন নোট:</b> ${esc(t.admin_note)}</div>` : ''}
        </div>
        <div class="acts">
          <button class="btn main sm" data-resolve="${t.id}">সিদ্ধান্ত দিন</button>
        </div>
      </div>
    `).join('') : '<div class="empty">কোনো ঝুলন্ত অভিযোগ নেই 🎉</div>';
    return;
  }

  const list = hs.filter(h => h.status === adminTab);
  const s = adminTab + JSON.stringify(list) + adminIncome; if (quiet && s === sig) return; sig = s;
  $('#aList').innerHTML = list.length ? list.map(h => `
    <div class="acard"><div>
      <h3>${esc(h.name)} <span class="badge ${h.status}">${LBL[h.status]}</span></h3>
      <div class="meta"><span>📞 ${esc(h.phone)}</span><span>📍 ${esc(h.area)}</span><span>NID: ${esc(h.nid_number)}</span><span>${h.created ? fmtDate(h.created) : ''}</span></div>
      ${h.reason ? `<div class="meta" style="margin-top:6px">কারণ: ${esc(h.reason)}</div>` : ''}
      <div class="thumbs"><img src="${esc(h.nid_front)}" alt="NID সামনে" data-img="${h.id}"><img src="${esc(h.nid_back)}" alt="NID পেছনে" data-img="${h.id}"></div>
      <p class="mute small" style="margin-top:6px">ছবিতে ক্লিক করে বড় করে দেখুন</p>
    </div><div class="acts">
      ${h.status !== 'approved' ? `<button class="btn ok sm" data-ok="${h.id}" data-name="${esc(h.name)}">অনুমোদন দিন</button>` : ''}
      ${h.status !== 'rejected' ? `<button class="btn bad sm" data-no="${h.id}">বাতিল করুন</button>` : ''}
    </div></div>`).join('') : `<div class="empty">${adminTab === 'pending' ? 'যাচাইয়ের অপেক্ষায় কোনো সহায়ক নেই 🎉' : 'এই তালিকায় কিছু নেই'}</div>`;
}
$('#aTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { adminTab = t.dataset.s; sig = ''; renderAdmin(); } });

$('#aList').addEventListener('click', async e => {
  const img = e.target.closest('[data-img]'), ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'), resolveBtn = e.target.closest('[data-resolve]');
  if (img) {
    const [f, b] = $$('img', img.parentElement);
    return openModal(`<h3 style="margin-bottom:10px">NID যাচাই</h3><p class="mute small">সামনের পাশ</p><img src="${f.src}" alt="NID সামনে"><p class="mute small" style="margin-top:12px">পেছনের পাশ</p><img src="${b.src}" alt="NID পেছনে">`);
  }
  if (resolveBtn) {
    const taskId = +resolveBtn.dataset.resolve;
    openModal(`
      <h3 style="margin-bottom:8px">অভিযোগ নিষ্পত্তি করুন</h3>
      <p class="mute small">উভয় পক্ষের সাথে কথা বলে আপনার সিদ্ধান্ত ও নোট লিখুন:</p>
      <textarea id="admNote" placeholder="যেমন: উভয় পক্ষের সাথে কথা বলে কাজটি বাতিল করা হলো / সম্পন্ন ঘোষণা করা হলো।"></textarea>
      <div class="acts2" style="margin-top:12px">
        <button class="btn ok full" id="forceDone">কাজ সম্পন্ন ঘোষণা (সহায়ক টাকা পাবেন)</button>
        <button class="btn bad full" id="forceCancel" style="margin-top:8px">কাজ বাতিল ঘোষণা</button>
      </div>
    `);

    $('#forceDone').onclick = async () => {
      const note = $('#admNote').value.trim();
      try {
        await call('admin_resolve.php', { method: 'POST', body: { id: taskId, action: 'completed', note } });
        closeModal(); toast('কাজটি সম্পন্ন ঘোষণা করা হলো'); renderAdmin();
      } catch (err) { toast(err.message, 'err'); }
    };

    $('#forceCancel').onclick = async () => {
      const note = $('#admNote').value.trim();
      try {
        await call('admin_resolve.php', { method: 'POST', body: { id: taskId, action: 'cancelled', note } });
        closeModal(); toast('কাজটি বাতিল ঘোষণা করা হলো'); renderAdmin();
      } catch (err) { toast(err.message, 'err'); }
    };
    return;
  }
  try {
    if (ok) {
      if (!confirm(`${ok.dataset.name}-কে অনুমোদন দিতে চান? NID ছবি ও নম্বর মিলিয়ে দেখেছেন তো?`)) return;
      await Api.review(+ok.dataset.ok, 'approved'); toast('সহায়ক অনুমোদিত হয়েছেন, তার একাউন্ট এখন চালু'); renderAdmin();
    }
    if (no) {
      openModal(`<h3 style="margin-bottom:6px">বাতিলের কারণ লিখুন</h3><p class="mute">সহায়ক এই কারণটি দেখতে পাবেন।</p>
        <textarea id="rsn" maxlength="255" placeholder="যেমন: NID-এর ছবি অস্পষ্ট"></textarea><button class="btn bad full" id="rsnOk">বাতিল নিশ্চিত করুন</button>`);
      $('#rsnOk').onclick = async () => {
        const reason = $('#rsn').value.trim(); if (reason.length < 3) return toast('বাতিলের কারণ লিখুন', 'err');
        try { await Api.review(+no.dataset.no, 'rejected', reason); closeModal(); toast('আবেদন বাতিল করা হয়েছে'); renderAdmin(); }
        catch (err) { toast(err.message, 'err'); }
      };
    }
  } catch (err) { (err.status === 401 || err.status === 403) ? loggedOutView('সেশন শেষ হয়েছে') : toast(err.message, 'err'); }
});

setInterval(() => { if ($('#v-admin').classList.contains('on') && !$('#modal').classList.contains('on') && adminTab !== 'tasks') renderAdmin(true); }, 20000);
boot();