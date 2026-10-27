/* কাজ পোস্ট, কাজ বাছাই, ট্র্যাকিং, সহায়কের প্রোফাইল ও নোটিফিকেশন */

/* ---------- নোটিফিকেশন (সব ভূমিকার জন্য) ---------- */
const Notif = (() => {
  let timer = null, last = null, items = [];
  const bell = () => `<button class="icon bell" id="bell" aria-label="নোটিফিকেশন">🔔<i id="bellN" hidden></i></button>`;
  const badge = n => { const b = $('#bellN'); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? '৯৯+' : n.toLocaleString('bn-BD'); };
  const when = iso => new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  async function poll() {
    try {
      const r = await call('notifications.php');
      items = r.items;
      if (last !== null) { const fresh = r.items.find(i => i.id > last && !i.is_read); if (fresh) toast('🔔 ' + fresh.title); }
      last = Math.max(last ?? 0, r.items.length ? r.items[0].id : 0);
      badge(r.unread);
    } catch { }
  }
  function start() { poll(); if (!timer) timer = setInterval(poll, 12000); }
  function stop() { clearInterval(timer); timer = null; last = null; items = []; }
  function open() {
    openModal(`<h3 style="margin-bottom:12px">নোটিফিকেশন</h3><div class="nlist">${items.length
      ? items.map(i => `<div class="nitem ${i.is_read ? '' : 'unread'}"><b>${esc(i.title)}</b>${i.body ? `<p>${esc(i.body)}</p>` : ''}<small>${when(i.created_at)}</small></div>`).join('')
      : '<div class="empty">এখনো কোনো নোটিফিকেশন নেই</div>'}</div>`);
    call('notifications.php', { method: 'POST', body: { action: 'read_all' } }).then(() => { items.forEach(i => i.is_read = 1); badge(0); }).catch(() => {});
  }
  return { bell, start, stop, open };
})();

const Dash = (() => {
  const CAT = { pharmacy: 'ওষুধ', grocery: 'বাজার', hospital: 'হাসপাতালে সঙ্গী', other: 'অন্যান্য' };
  const ST = { pending: 'সহায়ক খোঁজা হচ্ছে', accepted: 'সহায়ক ঠিক হয়েছে', on_the_way: 'সহায়ক পথে', arrived: 'দরজায় পৌঁছেছেন', completed: 'সম্পন্ন', cancelled: 'বাতিল' };
  const STEPS = ['গ্রহণ', 'পথে', 'দরজায়', 'শেষ'];
  const POS = { pending: 0, accepted: 1, on_the_way: 2, arrived: 3, completed: 4, cancelled: 0 };
  const taka = n => '৳' + Number(n).toLocaleString('bn-BD');
  const post = (id, action, extra = {}) => call('task_action.php', { method: 'POST', body: { id, action, ...extra } });
  const live = t => !['completed', 'cancelled'].includes(t.status);
  let user = null, timer = null, sig = '', gsig = '';

  // বিকাশ আসল অরিগামি পাখির অফিশিয়াল ভেক্টর লোগো (কোনো এক্সটার্নাল ইমেজ ফাইল লাগবে না)
  const bkashOrigamiSvg = (size = 36) => `
    <svg style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;border-radius:8px;background:#E2136E;padding:4px;box-sizing:border-box" viewBox="0 0 1000 1000">
      <path fill="#FFF" d="M187 186l444 38-74 278-370-316z"/>
      <path fill="#FFF" d="M187 236l79 66 156-42-235-24z"/>
      <path fill="#FFF" d="M500 224l228 156-91 163-137-319z"/>
      <path fill="#FFF" d="M422 490l306 43-70 148-236-191z"/>
      <path fill="#FFF" d="M728 380l58-2-19 62-39-60z"/>
      <path fill="#FFF" d="M786 378l63 63-71 4 8-67z"/>
      <path fill="#FFF" d="M422 490l47 217-142 108 95-325z"/>
      <path fill="#FFF" d="M469 707l259-131-15 32-244 99z"/>
    </svg>`;

  const head = t => `<div class="th"><b>#${t.id} · ${CAT[t.category]}${t.has_voice ? ' 🎤' : ''}</b><span class="badge ${t.status}">${ST[t.status]}</span></div>`;
  const voice = t => t.has_voice ? `<audio controls preload="none" src="api/voice.php?id=${t.id}"></audio>` : '';
  const stepper = s => `<ol class="stp">${STEPS.map((x, i) => `<li class="${i < POS[s] ? 'on' : ''}"><i>${i + 1}</i>${x}</li>`).join('')}</ol>`;
  const bill = t => `<div class="bill2"><div><span>কাজের ফি</span><b>${taka(t.base_fee)}</b></div><div><span>বখশিশ</span><b>${taka(t.tip_amount)}</b></div><div><span>দোকানের খরচ</span><b>${taka(t.item_cost)}</b></div><div class="tot"><span>মোট</span><b>${taka(t.total_amount)}</b></div></div>`;
  const paid = t => t.payment_status === 'paid' ? `<span class="badge approved">পরিশোধিত · ${t.payment_method === 'cash' ? 'নগদ' : 'বিকাশ'}</span>` : '';
  const btn = (act, id, label, cls = 'line', extra = '') => `<button class="btn ${cls} sm" data-act="${act}" data-id="${id}" ${extra}>${label}</button>`;
  
  // সরাসরি ফোন কল লিংক সহ সহায়কের কার্ড
  const helperLine = t => t.helper_name ? `
    <div style="background:var(--surf2); padding:14px; border-radius:14px; margin:14px 0;">
      <p class="who" style="margin:0; font-size:18px;">
        সহায়ক: <b>${esc(t.helper_name)}</b> ${t.helper_rating ? `· ★ ${Number(t.helper_rating).toFixed(1)}` : ''}
      </p>
      <div class="acts2" style="margin-top:10px;">
        ${t.helper_phone ? `<a href="tel:${esc(t.helper_phone)}" class="btn-call">📞 সরাসরি ফোন দিন (${esc(t.helper_phone)})</a>` : ''}
        <button class="btn line sm" data-profile="${t.helper_id}">👤 প্রোফাইল</button>
      </div>
    </div>` : '';

  /* ---------- ভয়েস: বলে লেখা ও রেকর্ড ---------- */
  const Voice = (() => {
    let blob = null, rec = null, sr = null, stop = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const clear = () => { blob = null; const p = $('#vPrev'); if (p) { p.hidden = true; p.removeAttribute('src'); } if ($('#vDel')) $('#vDel').hidden = true; if ($('#recBtn')) $('#recBtn').textContent = '⏺ ভয়েসে কথা বলুন (সহজ)'; };
    function bind() {
      const ta = $('#taskForm [name=description]'), stt = $('#sttBtn'), recB = $('#recBtn'), prev = $('#vPrev');
      if (stt) {
        stt.onclick = () => {
          if (!SR) return toast('বলে লেখা শুধু Chrome-এ চলে। ভয়েস রেকর্ড ব্যবহার করুন', 'err');
          if (sr) return sr.stop();
          sr = new SR(); sr.lang = 'bn-BD'; sr.continuous = true; sr.interimResults = true;
          const base = ta.value.trim() ? ta.value.trim() + ' ' : '';
          sr.onresult = e => { ta.value = base + [...e.results].map(r => r[0].transcript).join(' '); };
          sr.onerror = ev => toast(ev.error === 'not-allowed' ? 'মাইক্রোফোনের অনুমতি দিন' : 'কথা বুঝতে পারিনি, আবার চেষ্টা করুন', 'err');
          sr.onend = () => { sr = null; stt.textContent = '🎤 বলে লিখুন'; stt.classList.remove('main'); };
          sr.start(); stt.textContent = '⏹ থামুন'; stt.classList.add('main');
        };
      }
      if (recB) {
        recB.onclick = async () => {
          if (rec && rec.state === 'recording') return rec.stop();
          if (!navigator.mediaDevices || !window.MediaRecorder) return toast('এই ব্রাউজারে রেকর্ড চলে না (localhost বা HTTPS লাগে)', 'err');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [];
            rec = new MediaRecorder(stream);
            rec.ondataavailable = e => e.data.size && chunks.push(e.data);
            rec.onstop = () => {
              clearTimeout(stop); stream.getTracks().forEach(t => t.stop());
              blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
              prev.src = URL.createObjectURL(blob); prev.hidden = false; $('#vDel').hidden = false;
              recB.textContent = '⏺ আবার রেকর্ড'; recB.classList.remove('main');
            };
            rec.start(); recB.textContent = '⏹ রেকর্ড থামান'; recB.classList.add('main');
            stop = setTimeout(() => rec.state === 'recording' && rec.stop(), 120000);
          } catch { toast('মাইক্রোফোনের অনুমতি দিন', 'err'); }
        };
      }
      if ($('#vDel')) $('#vDel').onclick = clear;
    }
    return { bind, clear, blob: () => blob };
  })();

  /* ---------- প্রবীণের কার্ড ও ফর্ম ---------- */
  const reqCard = t => `<article class="tcard">${head(t)}<p class="mute">${esc(t.description)}</p>${voice(t)}
    ${t.status === 'cancelled' ? `<p class="mute">বাতিলের কারণ: ${esc(t.cancel_reason || '')}</p>` : stepper(t.status)}
    ${helperLine(t)}
    ${live(t) ? `<div class="pinbox"><small>দরজায় সহায়ককে এই পিন দেখান</small><b>${t.handshake_pin}</b></div>` : ''}
    ${bill(t)}
    <div class="acts2">${paid(t)}
      ${live(t) ? btn('tip', t.id, 'বখশিশ বাড়ান') : ''}
      ${['pending', 'accepted', 'on_the_way'].includes(t.status) && !t.item_cost ? btn('cancel', t.id, 'বাতিল করুন', 'bad') : ''}
      ${live(t) && !t.is_disputed && t.helper_id ? btn('dispute', t.id, '⚠️ অভিযোগ করুন', 'bad') : ''}
      ${t.is_disputed ? '<span class="badge rejected">⚠️ অভিযোগাধীন (অ্যাডমিন দেখছেন)</span>' : ''}
      ${t.status === 'completed' && t.payment_status === 'unpaid' ? `<button class="btn main sm" data-act="bkash" data-id="${t.id}" style="background:#E2136E">${bkashOrigamiSvg(22)} বিকাশে পরিশোধ</button><span class="mute small">নগদে দিলে সহায়ক নিশ্চিত করবেন</span>` : ''}
      ${t.can_review ? btn('review', t.id, '★ সহায়ককে রেটিং দিন', 'main') : ''}
    </div></article>`;

  function renderRequester() {
    $('#dashBox').innerHTML = `
      <div class="dash-head">
        <div>
          <h2>সহায়তা নিন</h2>
          <p>ভয়েস রেকর্ড করে অথবা লিখে সহজেই আপনার প্রয়োজনীয় কাজের অনুরোধ জানান।</p>
        </div>
      </div>
      <div id="gReq"></div>
      
      <div class="elder-task-box">
        <h3>কী সাহায্য চান?</h3>
        <form id="taskForm">
          <div class="rolepick four" style="margin-bottom:16px;">
            ${Object.entries(CAT).map(([k, v], i) => `
              <label>
                <input type="radio" name="category" value="${k}" ${i === 0 ? 'checked' : ''}>
                <span style="min-height:64px; text-align:center;"><b style="font-size:19px;">${v}</b></span>
              </label>
            `).join('')}
          </div>

          <div style="margin-bottom:14px;">
            <button type="button" class="btn main big-btn-voice" id="recBtn">⏺ ভয়েসে কথা বলুন (সহজ)</button>
            <div class="voicebar">
              <button type="button" class="btn line sm" id="sttBtn">🎤 বলে লিখে নিন</button>
              <button type="button" class="btn bad sm" id="vDel" hidden>ভয়েস মুছুন</button>
            </div>
            <audio id="vPrev" controls hidden style="margin-top:10px;"></audio>
          </div>

          <label class="field">
            কী কী লাগবে? (ঐচ্ছিক)
            <textarea name="description" placeholder="যেমন: প্রেসারের ওষুধ ২ পাতা, নাপা ১ পাতা..."></textarea>
          </label>

          <div class="two">
            <label class="field">দোকানের নাম বা ঠিকানা<input name="pickup" placeholder="যেমন: লাজ ফার্মা, মিরপুর" required></label>
            <label class="field">আপনার বাসার ঠিকানা<input name="delivery" placeholder="যেমন: রোড ২, বাড়ি ১২, ফ্ল্যাট ২বি" required></label>
          </div>

          <div class="two">
            <label class="field">দোকানের আনুমানিক খরচ (৳)<input name="item_cost" type="number" min="0" placeholder="যেমন: ৫০০"></label>
            <label class="field">বখশিশ (ঐচ্ছিক ৳)<input name="tip" type="number" min="0" max="1000" step="10" value="0" placeholder="০"></label>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surf2); padding:14px 18px; border-radius:12px; margin-bottom:16px;">
            <span>কাজের নির্ধারিত ফি: <b>৳১০০</b></span>
            <span style="color:var(--teal); font-weight:bold;">নিরাপদ সেবা</span>
          </div>

          <div class="field">
            <label style="font-weight:700; font-size:18px;">টাকা দেওয়ার মাধ্যম ও সময় বেছে নিন</label>
            <div class="pay-methods" id="payMethods">
              <label class="pay-card cod-active">
                <input type="radio" name="pay_choice" value="cod" checked>
                <span class="pay-icon" style="font-size:32px;">💵</span>
                <div>
                  <b>ক্যাশ অন ডেলিভারি</b>
                  <small style="display:block;">কাজ শেষে দরজায় নগদ</small>
                </div>
              </label>

              <label class="pay-card">
                <input type="radio" name="pay_choice" value="bkash_now">
                ${bkashOrigamiSvg(36)}
                <div>
                  <b>বিকাশ অগ্রিম পে</b>
                  <small style="display:block;">অর্ডার কনফার্ম হবে</small>
                </div>
              </label>

              <label class="pay-card">
                <input type="radio" name="pay_choice" value="bkash_later">
                ${bkashOrigamiSvg(36)}
                <div>
                  <b>বিকাশ কাজ শেষে</b>
                  <small style="display:block;">দরজায় পিন মিলিয়ে পে</small>
                </div>
              </label>
            </div>
          </div>

          <input type="hidden" name="payment_method" id="pMethod" value="cash">
          <input type="hidden" name="payment_timing" id="pTiming" value="on_delivery">

          <button class="btn ok full" style="min-height:56px; font-size:20px; margin-top:16px;" type="submit" id="submitTaskBtn">অনুরোধ পাঠান (নগদে পরিশোধ)</button>
        </form>
      </div>

      <div id="tList"></div>`;

    // কার্ড সিলেকশন ও বাটনের রঙ/লোগো পরিবর্তন
    $$('#payMethods .pay-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('#payMethods .pay-card').forEach(c => c.classList.remove('active', 'cod-active'));
        const input = $('input', card);
        input.checked = true;
        const v = input.value;
        const b = $('#submitTaskBtn');

        if (v === 'cod') {
          card.classList.add('cod-active');
          $('#pMethod').value = 'cash';
          $('#pTiming').value = 'on_delivery';
          b.style.background = 'var(--teal)';
          b.innerHTML = 'অনুরোধ পাঠান (নগদে পরিশোধ)';
        } else if (v === 'bkash_now') {
          card.classList.add('active');
          $('#pMethod').value = 'bkash';
          $('#pTiming').value = 'advance';
          b.style.background = '#d14180';
          b.innerHTML = `${bkashOrigamiSvg(24)} বিকাশে পে করুন ও অনুরোধ পাঠান`;
        } else {
          card.classList.add('active');
          $('#pMethod').value = 'bkash';
          $('#pTiming').value = 'on_delivery';
          b.style.background = 'var(--coral)';
          b.innerHTML = `${bkashOrigamiSvg(24)} অনুরোধ পাঠান (কাজ শেষে বিকাশ)`;
        }
      });
    });

    $('#taskForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (!String(fd.get('description')).trim() && !Voice.blob()) return toast('কিছু লিখে দিন অথবা ভয়েস রেকর্ড করুন', 'err');
      if (Voice.blob()) fd.append('voice_note', Voice.blob(), Voice.blob().type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
      
      const b = $('#submitTaskBtn'); 
      b.disabled = true;
      try { 
        const res = await call('task_create.php', { method: 'POST', body: fd }); 
        e.target.reset(); 
        Voice.clear(); 
        toast(res.paid ? `বিকাশ পেমেন্ট সফল (${res.trx_id || 'DEMO'})! কাজ পোস্ট হয়েছে` : 'সহায়তার অনুরোধ পাঠানো হয়েছে!'); 
        refresh(true); 
      }
      catch (err) { toast(err.message, 'err'); }
      b.disabled = false;
    });
    Voice.bind();
  }

  /* ---------- অভিভাবক ↔ প্রবীণ ---------- */
  const gcall = body => call('guardian.php', { method: 'POST', body });

  function renderGuardianShell() {
    $('#dashBox').innerHTML = `
      <div class="dash-head"><div><h2>অভিভাবক ড্যাশবোর্ড</h2><p>স্বাগতম, ${esc(user.name)}। প্রবীণের মোবাইল নম্বর দিয়ে অনুরোধ পাঠান। তিনি অনুমোদন দিলে তার কাজগুলো দেখতে পাবেন।</p></div></div>
      <form id="gForm" class="card" style="margin-top:0"><label class="field">প্রবীণের মোবাইল নম্বর<input name="phone" inputmode="numeric" placeholder="01XXXXXXXXX" required></label>
        <button class="btn main full" type="submit">অনুরোধ পাঠান</button></form>
      <div id="gList"></div>`;
    $('#gForm').addEventListener('submit', async e => {
      e.preventDefault();
      const b = $('button[type=submit]', e.target); b.disabled = true;
      try { await gcall({ action: 'link', phone: new FormData(e.target).get('phone') }); e.target.reset(); toast('অনুরোধ পাঠানো হয়েছে। প্রবীণের অনুমোদনের অপেক্ষা করুন'); refresh(true); }
      catch (err) { toast(err.message, 'err'); }
      b.disabled = false;
    });
  }
  const gCard = t => `<article class="tcard">${head(t)}<p class="mute">${esc(t.description)}</p>
    ${t.status === 'cancelled' ? '' : stepper(t.status)}
    ${t.helper_name ? `<p class="who">সহায়ক: <b>${esc(t.helper_name)}</b>${t.helper_rating ? ` · ★ ${Number(t.helper_rating).toFixed(1)}` : ''}</p>
      ${t.helper_id ? `<div class="acts2" style="margin:0 0 6px"><button class="btn line sm" data-profile="${t.helper_id}">👤 সহায়কের প্রোফাইল দেখুন</button></div>` : ''}` : ''}
    ${bill(t)}<div class="acts2">${paid(t)}${t.status === 'completed' && t.payment_status === 'unpaid' ? `<button class="btn main sm" data-act="bkash" data-id="${t.id}" style="background:#E2136E">${bkashOrigamiSvg(22)} বিকাশে পরিশোধ</button>` : ''}</div></article>`;
  
  function paintGuardian(r) {
    $('#gList').innerHTML = r.links.length ? r.links.map(l => l.status === 'pending'
      ? `<h3 class="sec">${esc(l.name)} · ${esc(l.phone)}</h3><div class="card" style="margin-top:0"><span class="badge pending">অনুমোদনের অপেক্ষায়</span> <p class="mute">${esc(l.name)} অনুমোদন দিলে তার কাজ এখানে দেখা যাবে।</p>
          <button class="btn bad sm" data-g="remove" data-id="${l.id}">অনুরোধ বাতিল করুন</button></div>`
      : `<h3 class="sec">${esc(l.name)} · ${esc(l.phone)} · ${esc(l.area)}</h3>
          ${l.tasks.length ? l.tasks.map(gCard).join('') : '<div class="empty">এখনো কোনো কাজ পোস্ট করা হয়নি</div>'}
          <button class="btn bad sm" data-g="remove" data-id="${l.id}">সংযোগ বিচ্ছিন্ন করুন</button>`).join('')
      : '<div class="empty">এখনো কোনো প্রবীণকে যুক্ত করা হয়নি</div>';
  }
  function paintLinks(r) {
    $('#gReq').innerHTML = r.links.length ? `<h3 class="sec">পরিবারের সদস্য (অভিভাবক)</h3>` + r.links.map(l => `<div class="card" style="margin:0 0 14px">
        <p><b>${esc(l.name)}</b> · ${esc(l.phone)}</p>
        ${l.status === 'pending'
          ? `<p class="mute">তিনি আপনার কাজগুলো দেখতে চান।</p><div class="acts2"><button class="btn ok sm" data-g="approve" data-id="${l.id}">অনুমোদন দিন</button><button class="btn bad sm" data-g="remove" data-id="${l.id}">প্রত্যাখ্যান করুন</button></div>`
          : `<p class="mute">তিনি আপনার কাজ দেখতে পারছেন।</p><button class="btn bad sm" data-g="remove" data-id="${l.id}">সরিয়ে দিন</button>`}
      </div>`).join('') : '';
  }

  /* ---------- সহায়কের কার্ড ---------- */
  const availCard = t => `<article class="tcard">${head(t)}<p class="mute">${esc(t.description)}</p>${voice(t)}
    <div class="acts2">
      <span class="badge pending">${esc(t.area)}</span>
      <span class="badge approved">★ প্রবীণের রেটিং: ${Number(t.requester_rating || 5).toFixed(1)}</span>
      <span>আয়: <b>${taka(t.helper_total_payout || (t.base_fee * 0.9 + t.tip_amount))}</b> + দোকানের খরচ ফেরত</span>
      ${btn('accept', t.id, 'কাজটি নিন', 'main')}
    </div></article>`;

  const mineCard = t => `<article class="tcard">${head(t)}<p class="mute">${esc(t.description)}</p>${voice(t)}
  <p class="who">
  ${esc(t.requester_name)} · <a href="tel:${esc(t.requester_phone)}" style="color:var(--coral);font-weight:700;text-decoration:underline">📞 ${esc(t.requester_phone)}</a><br>
  সংগ্রহ: ${esc(t.pickup)}<br>
  পৌঁছানো: ${esc(t.delivery)}
</p>
    ${t.status === 'cancelled' ? `<p class="mute">বাতিলের কারণ: ${esc(t.cancel_reason || '')}</p>` : stepper(t.status)}${bill(t)}
    <div class="acts2">${paid(t)}
      ${t.status === 'accepted' ? btn('status', t.id, 'রওনা দিয়েছি', 'main', 'data-to="on_the_way"') : ''}
      ${t.status === 'on_the_way' ? btn('status', t.id, 'দরজায় পৌঁছেছি', 'main', 'data-to="arrived"') : ''}
      ${live(t) && !t.is_disputed ? btn('dispute', t.id, '⚠️ অভিযোগ করুন', 'bad') : ''}
      ${t.is_disputed ? '<span class="badge rejected">⚠️ অভিযোগাধীন</span>' : ''}
      ${t.status === 'completed' && t.payment_status === 'unpaid' ? btn('cashpaid', t.id, 'নগদ টাকা পেয়েছি', 'ok') : ''}
    </div>
    ${live(t) ? `<div class="inl"><input id="r${t.id}" type="number" min="0" placeholder="দোকানের রসিদের খরচ (৳)" value="${t.item_cost || ''}">${btn('receipt', t.id, 'খরচ সংরক্ষণ')}</div>` : ''}
    ${t.status === 'arrived' ? `<div class="inl"><input id="p${t.id}" inputmode="numeric" maxlength="4" placeholder="৪ সংখ্যার পিন">${btn('complete', t.id, 'পিন মিলিয়ে কাজ শেষ', 'ok')}</div>` : ''}
  </article>`;

  const section = (title, items, empty) => `<h3 class="sec">${title}</h3>${items.length ? items.join('') : `<div class="empty">${empty}</div>`}`;

  function renderHelperShell() {
    $('#dashBox').innerHTML = `
      <div class="dash-head">
        <div><h2>সহায়ক ড্যাশবোর্ড</h2><p>${esc(user.name)} · ${esc(user.area)} এলাকার কাজ দেখানো হচ্ছে</p></div>
        <button class="btn line sm" data-profile="${user.id}">👤 আমার প্রোফাইল</button>
      </div>
      <div id="hStats"></div><div id="hMine"></div><div id="hAvail"></div><div id="hHist"></div>`;
  }
  function paintHelper(r) {
    const act = r.mine.filter(live), done = r.mine.filter(t => !live(t));
    const comp = r.mine.filter(t => t.status === 'completed');
    const earn = comp.reduce((s, t) => s + (t.helper_total_payout || (t.base_fee * 0.90 + t.tip_amount)), 0), back = comp.reduce((s, t) => s + t.item_cost, 0);
    $('#hStats').innerHTML = `<div class="astats" style="grid-template-columns:repeat(3,1fr)"><div><b>${comp.length.toLocaleString('bn-BD')}</b><span>সম্পন্ন কাজ</span></div><div><b>${taka(earn)}</b><span>আপনার আয় (ফি + বখশিশ)</span></div><div><b>${taka(back)}</b><span>দোকানের খরচ (ফেরত পাবেন)</span></div></div>`;
    $('#hMine').innerHTML = section('আপনার চলমান কাজ', act.map(mineCard), 'কোনো চলমান কাজ নেই');
    $('#hAvail').innerHTML = act.length ? '' : section('নতুন কাজ (আপনার এলাকায়)', r.available.map(availCard), 'এই মুহূর্তে আপনার এলাকায় কোনো খালি কাজ নেই');
    $('#hHist').innerHTML = done.length ? section('আগের কাজ', done.map(mineCard), '') : '';
  }

  /* ---------- অ্যাডমিন: সব কাজ ---------- */
  async function adminTasks() {
    const r = await call('tasks.php');
    return r.tasks.length ? r.tasks.map(t => `<article class="tcard">${head(t)}
      <p class="mute">${esc(t.description)}</p>${voice(t)}
      <p class="who">${esc(t.area)} · সেবা গ্রহণকারী: <b>${esc(t.requester_name)}</b> ${t.helper_name ? `→ সহায়ক: <b>${esc(t.helper_name)}</b>` : '(সহায়ক নেই)'}</p>
      <div class="acts2"><b>${taka(t.total_amount)}</b>${paid(t)}${t.is_disputed ? '<span class="badge rejected">⚠️ অভিযোগাধীন</span>' : ''}${['pending', 'accepted', 'on_the_way'].includes(t.status) ? btn('cancel', t.id, 'অ্যাডমিন হিসেবে বাতিল', 'bad') : ''}</div></article>`).join('')
      : '<div class="empty">এখনো কোনো কাজ নেই</div>';
  }

  /* ---------- সহায়কের প্রোফাইল পেজ (ফেসবুক ও ইমেইল সহ) ---------- */
  let pf = null;
  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  const avatar = p => p.has_photo 
  ? `<img src="api/helper_profile.php?photo=1&id=${p.id}&v=${p.photo_v}" alt="${esc(p.name)}">` 
  : `<span>${esc([...p.name.trim()][0] || '?')}</span>`;

  async function openProfile(id) {
    show('profile');
    $('#profileBox').innerHTML = '<div class="empty">প্রোফাইল লোড হচ্ছে…</div>';
    try { pf = await call('helper_profile.php?id=' + id); paintProfile(false); }
    catch (err) { toast(err.message, 'err'); show('dash'); }
  }
  function paintProfile(editing) {
    const { profile: p, dist, reviews } = pf;
    const skills = (p.skills || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
    const rate = p.rating ? `<i>${stars(p.rating)}</i>${p.rating.toLocaleString('bn-BD')} (${p.review_count.toLocaleString('bn-BD')}টি রেটিং)` : 'এখনো কোনো রেটিং নেই';
    
    const left = editing ? `
      <form class="pf-card" id="pfForm"><h3>প্রোফাইল সম্পাদনা</h3>
        <label class="field">প্রোফাইল ছবি (JPG, PNG বা WEBP, সর্বোচ্চ ২ MB)<input type="file" name="photo" accept="image/*"></label>
        <label class="field">আপনার সম্পর্কে<textarea name="bio" maxlength="500" placeholder="সংক্ষেপে নিজের পরিচয় লিখুন">${esc(p.bio || '')}</textarea></label>
        <div class="two">
          <label class="field">দক্ষতা (কমা দিয়ে লিখুন)<input name="skills" maxlength="200" placeholder="ওষুধ কেনা, বাজার করা" value="${esc(p.skills || '')}"></label>
          <label class="field">অভিজ্ঞতা<input name="experience" maxlength="60" placeholder="যেমন: ২ বছর" value="${esc(p.experience || '')}"></label>
        </div>
        <div class="two">
          <label class="field">ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক)<input name="fb_url" type="url" placeholder="https://facebook.com/username" value="${esc(p.fb_url || '')}"></label>
          <label class="field">যোগাযোগের ইমেইল (ঐচ্ছিক)<input name="contact_email" type="email" placeholder="example@email.com" value="${esc(p.contact_email || '')}"></label>
        </div>
        <div class="acts2"><button class="btn ok" type="submit">সংরক্ষণ করুন</button><button class="btn line" type="button" id="pfCancel">বাতিল</button></div>
      </form>` : `
      <div class="pf-card"><h3>পরিচিতি</h3><p>${p.bio ? esc(p.bio) : '<span class="mute">এখনো কোনো পরিচিতি লেখা হয়নি।</span>'}</p></div>
      <div class="pf-card"><h3>দক্ষতা ও অভিজ্ঞতা</h3>
        ${skills.length ? skills.map(s => `<span class="chip">${esc(s)}</span>`).join('') : '<span class="mute">দক্ষতা যোগ করা হয়নি।</span>'}
        ${p.experience ? `<p style="margin-top:8px">অভিজ্ঞতা: <b>${esc(p.experience)}</b></p>` : ''}</div>
      <div class="pf-card"><h3>সাম্প্রতিক মতামত</h3>${reviews.length ? reviews.map(r => `<div class="rev"><span class="st">${stars(r.rating)}</span> <b>${esc(r.name)}</b>
        <small class="mute"> · ${fmtDate(r.date)}</small>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('') : '<span class="mute">এখনো কেউ মতামত দেননি।</span>'}</div>`;

    $('#profileBox').innerHTML = `<div class="pf">
      <button class="back" id="pfBack">← ফিরে যান</button>
      <div class="pf-top">
        <div class="pf-av">${avatar(p)}</div>
        <div class="pf-info">
          <h2>${esc(p.name)} ${p.verified ? '<span class="badge approved">✓ NID যাচাইকৃত</span>' : '<span class="badge pending">যাচাই বাকি</span>'}</h2>
          <p class="pf-sub">📍 ${esc(p.area)} · ${fmtDate(p.joined)} থেকে সহায়ক</p>
          <p class="pf-rate">${rate}</p>
        </div>
        ${p.is_self && !editing ? '<button class="btn line sm" id="pfEdit">✏️ প্রোফাইল সম্পাদনা</button>' : ''}
      </div>
      <div class="pf-stats">
        <div><b>${p.completed.toLocaleString('bn-BD')}</b><span>সম্পন্ন কাজ</span></div>
        <div><b>${p.rating ? p.rating.toLocaleString('bn-BD') : '—'}</b><span>গড় রেটিং</span></div>
        <div><b>${p.review_count.toLocaleString('bn-BD')}</b><span>মোট রেটিং</span></div>
      </div>
      <div class="pf-grid"><div>${left}</div><div>
        <div class="pf-card"><h3>রেটিংয়ের বিবরণ</h3>${[5, 4, 3, 2, 1].map(k => {
          const pc = p.review_count ? Math.round(dist[k] / p.review_count * 100) : 0;
          return `<div class="dist"><span>${k} ★</span><div class="bar"><i style="width:${pc}%"></i></div><span>${pc.toLocaleString('bn-BD')}%</span></div>`; }).join('')}</div>
        <div class="pf-card"><h3>নিরাপত্তা ও সামাজিক তথ্য</h3>
          <div class="vrow"><span>জাতীয় পরিচয়পত্র (NID)</span>${p.verified ? '<span class="badge approved">যাচাইকৃত</span>' : '<span class="badge pending">অপেক্ষমাণ</span>'}</div>
          <div class="vrow"><span>অ্যাডমিন অনুমোদন</span>${p.verified ? '<span class="badge approved">অনুমোদিত</span>' : '<span class="badge pending">অপেক্ষমাণ</span>'}</div>
          ${p.phone ? `<div class="vrow"><span>মোবাইল</span><b>${esc(p.phone)}</b></div>` : ''}
          ${p.contact_email ? `<div class="vrow"><span>ইমেইল</span><b>${esc(p.contact_email)}</b></div>` : ''}
          ${p.fb_url ? `<div class="vrow"><span>ফেসবুক প্রোফাইল</span><a href="${esc(p.fb_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:700">🌐 ফেসবুক দেখুন ↗</a></div>` : ''}
        </div>
      </div></div></div>`;

    if (editing) $('#pfCancel').onclick = () => paintProfile(false);
    if (editing) $('#pfForm').onsubmit = async e => {
      e.preventDefault();
      const b = $('button[type=submit]', e.target); b.disabled = true;
      try { await call('helper_profile.php', { method: 'POST', body: new FormData(e.target) }); toast('প্রোফাইল হালনাগাদ হয়েছে'); openProfile(p.id); }
      catch (err) { toast(err.message, 'err'); b.disabled = false; }
    };
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-profile]');
    if (p) { e.preventDefault(); return openProfile(+p.dataset.profile); }
    if (e.target.closest('#pfBack')) return route();
    if (e.target.closest('#pfEdit')) return paintProfile(true);
    if (e.target.closest('#bell')) return Notif.open();
  });

  /* ---------- রিফ্রেশ ---------- */
  async function refresh(force = false) {
    if (!force) {
      const a = document.activeElement;
      if (a && ['INPUT', 'TEXTAREA'].includes(a.tagName) && $('#dashBox').contains(a)) return;
      if ($$('#dashBox audio').some(x => !x.paused)) return;
    }
    if (user.role === 'guardian') {
      let g; try { g = await call('guardian.php'); } catch { return; }
      const gs = JSON.stringify(g); if (!force && gs === sig) return; sig = gs;
      return paintGuardian(g);
    }
    if (user.role === 'elderly') {
      try { const g = await call('guardian.php'); const gs = JSON.stringify(g); if (force || gs !== gsig) { gsig = gs; paintLinks(g); } } catch {}
    }
    let r; try { r = await call('tasks.php'); } catch { return; }
    const s = JSON.stringify(r); if (!force && s === sig) return; sig = s;
    if (user.role === 'helper') paintHelper(r);
    else $('#tList').innerHTML = section('আমার সব কাজ', r.tasks.map(reqCard), 'এখনো কোনো কাজ পোস্ট করা হয়নি');
  }

  async function render(u) {
    user = u; sig = ''; gsig = ''; clearInterval(timer);
    if (u.role === 'guardian') renderGuardianShell();
    else if (u.role === 'helper') renderHelperShell();
    else renderRequester();
    await refresh(true);
    timer = setInterval(() => { if (!$('#v-dash').classList.contains('on')) return clearInterval(timer); refresh(); }, 8000);
  }

  /* ---------- বাটনের কাজ ---------- */
  function modal(title, body, onOk, label) {
    openModal(`<h3 style="margin-bottom:12px">${title}</h3>${body}<button class="btn main full" id="mOk">${label}</button>`);
    $('#mOk').onclick = async () => { try { await onOk(); closeModal(); } catch (err) { toast(err.message, 'err'); } };
  }
  const after = async () => { $('#v-admin') && $('#v-admin').classList.contains('on') ? renderAdmin() : refresh(true); };

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id, act = b.dataset.act;
    try {
      if (act === 'dispute') {
        return modal('অভিযোগ জমা দিন',
          `<p class="mute small">কী সমস্যা হচ্ছে বিস্তারিত লিখুন। কাজটি স্থগিত থাকবে এবং অ্যাডমিন বিষয়টি দেখবেন।</p>
           <textarea id="dispRs" placeholder="যেমন: দরজায় এসে পিন দিচ্ছেন না / অতিরিক্ত টাকা চাইছেন"></textarea>`,
          async () => {
            const reason = $('#dispRs').value.trim();
            if (!reason) throw new Error('অভিযোগের কারণ লিখুন');
            await post(id, 'dispute', { reason });
            toast('অভিযোগ জমা হয়েছে। অ্যাডমিন দেখছেন');
            await after();
          }, 'অভিযোগ পাঠান');
      }
      if (act === 'tip') {
        return modal('বখশিশ যোগ করুন', `<div class="chips">${[20, 50, 100].map(n => `<button type="button" data-v="${n}">+৳${n}</button>`).join('')}</div><input id="tipV" type="number" min="10" step="10" value="50" class="bigin">`,
          async () => { await post(id, 'tip', { amount: $('#tipV').value }); toast('বখশিশ যোগ হয়েছে'); await after(); }, 'নিশ্চিত করুন');
      }
      if (act === 'cancel') {
        return modal('কাজ বাতিল করুন', `<label class="field">বাতিলের কারণ<input id="cRs" placeholder="যেমন: আর প্রয়োজন নেই"></label>`,
          async () => { await post(id, 'cancel', { reason: $('#cRs').value }); toast('কাজ বাতিল হয়েছে'); await after(); }, 'বাতিল নিশ্চিত করুন');
      }
      if (act === 'review') {
        let rate = 5;
        modal('সহায়ককে রেটিং দিন', `<div class="chips stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}" class="on">★</button>`).join('')}</div><label class="field" style="margin-top:14px">মন্তব্য (ঐচ্ছিক)<input id="rCm" maxlength="500"></label>`,
          async () => { await post(id, 'review', { rating: rate, comment: $('#rCm').value }); toast('ধন্যবাদ, রেটিং জমা হয়েছে'); await after(); }, 'জমা দিন');
        $$('.stars button').forEach(s => s.onclick = () => { rate = +s.dataset.r; $$('.stars button').forEach(x => x.classList.toggle('on', +x.dataset.r <= rate)); });
        return;
      }
      if (act === 'accept') { await post(id, 'accept'); toast('কাজটি এখন আপনার'); }
      else if (act === 'status') await post(id, 'status', { to: b.dataset.to });
      else if (act === 'receipt') { await post(id, 'receipt', { item_cost: $('#r' + id).value }); toast('খরচ সংরক্ষিত হয়েছে'); }
      else if (act === 'complete') { await post(id, 'complete', { pin: $('#p' + id).value }); toast('কাজ সম্পন্ন হয়েছে'); }
      else if (act === 'cashpaid') { await post(id, 'pay', { method: 'cash' }); toast('নগদ টাকা পাওয়া নিশ্চিত হয়েছে'); }
      else if (act === 'bkash') { await post(id, 'pay', { method: 'bkash' }); toast('বিকাশ পরিশোধ সম্পন্ন (ডেমো)'); }
      await after();
    } catch (err) { toast(err.message, 'err'); }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    if (b.dataset.g === 'remove' && !confirm('আপনি কি নিশ্চিত?')) return;
    try { await gcall({ action: b.dataset.g, id: +b.dataset.id }); toast(b.dataset.g === 'approve' ? 'অনুমোদন দেওয়া হয়েছে' : 'সম্পন্ন হয়েছে'); refresh(true); }
    catch (err) { toast(err.message, 'err'); }
  });
  document.addEventListener('click', e => { const c = e.target.closest('.chips [data-v]'); if (c) $('#tipV').value = c.dataset.v; });

  return { render, adminTasks, openProfile };
})();