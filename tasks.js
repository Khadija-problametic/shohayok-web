/* Shohayok — কাজ পোস্ট, ডায়নামিক ক্যাটাগরি, প্রবীণ মেডিকেল প্রোফাইল, অভিভাবক রিমোট অর্ডার ও নোটিফিকেশন */

/* ---------- নোটিফিকেশন ---------- */
const Notif = (() => {
  let timer = null, last = null, items = [];
  const bell = () => `<button class="icon bell" id="bell" aria-label="নোটিফিকেশন">🔔<i id="bellN" hidden></i></button>`;
  const badge = n => { const b = $('#bellN'); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? '৯৯+' : n.toLocaleString('bn-BD'); };
  const when = iso => new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  async function poll() {
    try {
      const r = await call('notifications.php');
      items = r.items || [];
      if (last !== null) { const fresh = items.find(i => i.id > last && !i.is_read); if (fresh) toast('🔔 ' + fresh.title); }
      last = Math.max(last ?? 0, items.length ? items[0].id : 0);
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

  const head = t => `<div class="th"><b>#${t.id} · ${CAT[t.category] || t.category}${t.has_voice ? ' 🎤' : ''}</b><span class="badge ${t.status}">${ST[t.status] || t.status}</span></div>`;
  const voice = t => t.has_voice ? `<audio controls preload="none" src="api/voice.php?id=${t.id}"></audio>` : '';
  const stepper = s => `<ol class="stp">${STEPS.map((x, i) => `<li class="${i < POS[s] ? 'on' : ''}"><i>${i + 1}</i>${x}</li>`).join('')}</ol>`;
  const bill = t => `<div class="bill2"><div><span>কাজের ফি</span><b>${taka(t.base_fee)}</b></div><div><span>বখশিশ</span><b>${taka(t.tip_amount)}</b></div><div><span>দোকান/টেস্টের খরচ</span><b>${taka(t.item_cost)}</b></div><div class="tot"><span>মোট</span><b>${taka(t.total_amount)}</b></div></div>`;
  const paid = t => t.payment_status === 'paid' ? `<span class="badge approved">পরিশোধিত · ${t.payment_method === 'cash' ? 'নগদ' : 'বিকাশ'}</span>` : '';
  const btn = (act, id, label, cls = 'line', extra = '') => `<button class="btn ${cls} sm" data-act="${act}" data-id="${id}" ${extra}>${label}</button>`;
  
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

  /* ---------- ভয়েস নোট ---------- */
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

  /* ---------- প্রবীণের প্রোফাইল ও মেডিকেল নোট মোডাল ---------- */
  async function openUserProfileModal() {
    try {
      const res = await call('user_profile.php');
      const p = res.profile || {};
      openModal(`
        <h3 style="margin-bottom:8px">স্বাস্থ্য ও জরুরি তথ্য (Medical Profile)</h3>
        <p class="mute small" style="margin-bottom:14px">জরুরি মুহূর্তে সহায়ক বা ডাক্তারের সুবিধার্থে এই তথ্যগুলো পূরণ রাখুন।</p>
        <form id="uProfForm">
          <label class="field">আপনার পুরো নাম<input name="name" value="${esc(p.name || '')}" required></label>
          <div class="two">
            <label class="field">রক্তের গ্রুপ (Blood Group)
              <select name="blood_group">
                <option value="">নির্বাচন করুন</option>
                ${['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => `<option value="${bg}" ${p.blood_group === bg ? 'selected' : ''}>${bg}</option>`).join('')}
              </select>
            </label>
            <label class="field">জরুরি যোগাযোগ নম্বর (Emergency Contact)
              <input name="emergency_contact" type="tel" placeholder="যেমন: ছেলের মোবাইল নম্বর" value="${esc(p.emergency_contact || '')}">
            </label>
          </div>
          <label class="field">বাসার পূর্ণ ঠিকানা (Delivery Address)
            <textarea name="address" placeholder="রোড, বাড়ি নম্বর, ফ্ল্যাট বিস্তারিত লিখুন...">${esc(p.address || '')}</textarea>
          </label>
          <label class="field">মেডিকেল নোট ও শারীরিক অবস্থা (Medical Notes)
            <textarea name="medical_notes" placeholder="যেমন: ডায়াবেটিস আছে, হাই প্রেসার, চোখে কম দেখেন বা বিশেষ সতর্কতা">${esc(p.medical_notes || '')}</textarea>
          </label>
          <button class="btn ok full" type="submit" style="margin-top:10px;">সংরক্ষণ করুন</button>
        </form>
      `);

      $('#uProfForm').onsubmit = async e => {
        e.preventDefault();
        const b = $('button[type=submit]', e.target); b.disabled = true;
        try {
          const fd = new FormData(e.target);
          await call('user_profile.php', { method: 'POST', body: fd });
          closeModal();
          toast('স্বাস্থ্য প্রোফাইল সংরক্ষিত হয়েছে!');
          refresh(true);
        } catch (err) { toast(err.message, 'err'); b.disabled = false; }
      };
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ---------- প্রবীণের ড্যাশবোর্ড ---------- */
  const reqCard = t => `<article class="tcard">${head(t)}<p class="mute">${esc(t.description)}</p>${voice(t)}
    ${t.status === 'cancelled' ? `<p class="mute">বাতিলের কারণ: ${esc(t.cancel_reason || '')}</p>` : stepper(t.status)}
    ${helperLine(t)}
    ${live(t) ? `<div class="pinbox"><small>দরজায় সহায়ককে এই পিন দেখান</small><b>${t.handshake_pin}</b></div>` : ''}
    ${bill(t)}
    <div class="acts2">${paid(t)}
      ${live(t) ? btn('tip', t.id, 'বখশিশ বাড়ান') : ''}
      ${['pending', 'accepted', 'on_the_way'].includes(t.status) && !t.item_cost ? btn('cancel', t.id, 'বাতিল করুন', 'bad') : ''}
      ${live(t) && !t.is_disputed && t.helper_id ? btn('dispute', t.id, '⚠️ অভিযোগ করুন', 'bad') : ''}
      ${t.is_disputed ? '<span class="badge rejected">⚠️ অভিযোগাধীন</span>' : ''}
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
        <button class="btn line sm" id="elderProfBtn" style="font-weight:700;">❤️ স্বাস্থ্য ও মেডিকেল প্রোফাইল</button>
      </div>

      <div id="gReq"></div>
      
      <div class="elder-task-box">
        <h3>কী সাহায্য চান?</h3>
        <form id="taskForm">
          <div class="rolepick four" id="catPick" style="margin-bottom:16px;">
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
            <span id="descLbl">কী কী লাগবে? (ঐচ্ছিক)</span>
            <textarea name="description" id="descInput" placeholder="যেমন: প্রেসারের ওষুধ ২ পাতা, নাপা ১ পাতা..."></textarea>
          </label>

          <div class="two">
            <label class="field">
              <span id="pickupLbl">দোকানের নাম বা সংগ্রহের স্থান</span>
              <input name="pickup" id="pickupInput" placeholder="যেমন: লাজ ফার্মা, মিরপুর" required>
            </label>
            <label class="field">
              <span id="delLbl">আপনার বাসার ঠিকানা</span>
              <input name="delivery" id="delInput" placeholder="যেমন: রোড ২, বাড়ি ১২, ফ্ল্যাট ২বি" required>
            </label>
          </div>

          <div class="two">
            <label class="field">
              <span id="costLbl">দোকানের আনুমানিক খরচ (৳)</span>
              <input name="item_cost" type="number" min="0" placeholder="যেমন: ৫০০">
            </label>
            <label class="field">
              <span>বখশিশ (ঐচ্ছিক ৳)</span>
              <input name="tip" type="number" min="0" max="1000" step="10" value="0" placeholder="০">
            </label>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surf2); padding:14px 18px; border-radius:12px; margin-bottom:16px;">
            <span>কাজের নির্ধারিত ফি: <b id="feeDisplay">৳১০০</b></span>
            <span style="color:var(--teal); font-weight:bold;" id="feeNote">নিরাপদ সেবা</span>
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

    $('#elderProfBtn').onclick = openUserProfileModal;

    // ক্যাটাগরি অনুযায়ী ডায়নামিক ফর্ম ও ফি
    $$('#catPick input[name=category]').forEach(r => {
      r.addEventListener('change', () => {
        const isHosp = r.value === 'hospital';
        $('#descLbl').textContent = isHosp ? 'কোন ডাক্তার বা কী কারণে হাসপাতালে যাবেন?' : 'কী কী লাগবে? (ঐচ্ছিক)';
        $('#descInput').placeholder = isHosp ? 'যেমন: চোখের ডাক্তার দেখানো ও প্রেসার চেক করানোর জন্য ২ ঘণ্টা সঙ্গী দরকার...' : 'যেমন: প্রেসারের ওষুধ ২ পাতা, নাপা ১ পাতা...';
        $('#pickupLbl').textContent = isHosp ? 'কোন হাসপাতালে বা ক্লিনিকে যাবেন?' : 'দোকানের নাম বা সংগ্রহের স্থান';
        $('#pickupInput').placeholder = isHosp ? 'যেমন: ল্যাবএইড হাসপাতাল, ধানমন্ডি' : 'যেমন: লাজ ফার্মা, মিরপুর';
        $('#delLbl').textContent = isHosp ? 'সহায়ক আপনাকে কোন বাসা থেকে নিয়ে যাবে?' : 'আপনার বাসার ঠিকানা';
        $('#delInput').placeholder = isHosp ? 'যেমন: বাড়ি ১২, রোড ৪, ধানমন্ডি' : 'যেমন: রোড ২, বাড়ি ১২, ফ্ল্যাট ২বি';
        $('#costLbl').textContent = isHosp ? 'ডাক্তার বা টেস্টের আনুমানিক খরচ (৳, ঐচ্ছিক)' : 'দোকানের আনুমানিক খরচ (৳)';
        $('#feeDisplay').textContent = isHosp ? '৳২০০' : '৳১০০';
        $('#feeNote').textContent = isHosp ? 'হাসপাতালে সাথে থাকার সেবা' : 'নিরাপদ সেবা';
      });
    });

    // পেমেন্ট সুইচ
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
          b.style.background = '#E2136E';
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
      
      const b = $('#submitTaskBtn'); b.disabled = true;
      try { 
        const res = await call('task_create.php', { method: 'POST', body: fd }); 
        e.target.reset(); Voice.clear(); 
        toast(res.paid ? `বিকাশ পেমেন্ট সফল (${res.trx_id || 'DEMO'})! কাজ পোস্ট হয়েছে` : 'সহায়তার অনুরোধ পাঠানো হয়েছে!'); 
        refresh(true); 
      }
      catch (err) { toast(err.message, 'err'); }
      b.disabled = false;
    });
    Voice.bind();
  }

  /* ---------- অভিভাবক কন্ট্রোল প্যানেল ---------- */
  const gcall = body => call('guardian.php', { method: 'POST', body });

  function renderGuardianShell() {
    $('#dashBox').innerHTML = `
      <div class="dash-head">
        <div>
          <h2>অভিভাবক কন্ট্রোল প্যানেল</h2>
          <p>স্বাগতম, ${esc(user.name)}। দূরে থেকেও আপনার পরিবারের প্রবীণদের সুরক্ষা ও জরুরি সহায়তা নিশ্চিত করুন।</p>
        </div>
        <button class="btn line sm" id="guardianProfBtn" style="font-weight:700;">👤 আমার প্রোফাইল</button>
      </div>

      <!-- অভিভাবকের দূর থেকে জরুরি অর্ডারের প্যানেল -->
      <div id="guardianOrderModal" hidden style="background:var(--surf2); border:2px solid var(--teal); border-radius:18px; padding:24px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 id="emgModalTitle" style="margin:0; color:var(--teal);">🚨 জরুরি সহায়তার অনুরোধ</h3>
          <button type="button" class="btn line sm" id="closeEmgModal">✕ বন্ধ করুন</button>
        </div>
        <form id="emgTaskForm">
          <input type="hidden" name="on_behalf_of" id="emgTargetId">
          <div class="two">
            <label class="field">
              <span>ক্যাটাগরি</span>
              <select name="category" required>
                <option value="pharmacy" selected>জরুরি ওষুধ আনা</option>
                <option value="hospital">হাসপাতালে সঙ্গী হওয়া</option>
                <option value="grocery">নিত্যপ্রয়োজনীয় বাজার</option>
                <option value="other">অন্যান্য সাহায্য</option>
              </select>
            </label>
            <label class="field">
              <span>দোকানের নাম বা হাসপাতাল</span>
              <input name="pickup" placeholder="যেমন: লাজ ফার্মা বা ল্যাবএইড হাসপাতাল" required>
            </label>
          </div>
          <div class="two">
            <label class="field">
              <span>প্রবীণের বাসার ডেলিভারি ঠিকানা</span>
              <input name="delivery" id="emgDeliveryInput" placeholder="যেমন: বাড়ি ১২, রোড ৪, ধানমন্ডি" required>
            </label>
            <label class="field">
              <span>কাজের বিবরণ</span>
              <input name="description" placeholder="যেমন: প্রেসারের ওষুধ ২ পাতা" required>
            </label>
          </div>
          <div class="two">
            <label class="field">
              <span>দোকান বা টেস্টের আনুমানিক খরচ (৳)</span>
              <input name="item_cost" type="number" min="0" placeholder="যেমন: ৫০০">
            </label>
            <label class="field">
              <span>টাকা পরিশোধ</span>
              <select name="payment_method">
                <option value="bkash">বিকাশ (আপনি অগ্রিম পে করবেন)</option>
                <option value="cash">নগদ (দরজায় প্রবীণ দেবেন)</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="payment_timing" value="advance">
          <button type="submit" class="btn ok full" style="margin-top:14px; font-size:18px; min-height:50px;">
            অনুরোধ কনফার্ম করুন ও সহায়ক পাঠান
          </button>
        </form>
      </div>

      <!-- নতুন প্রবীণ লিংক ফর্ম -->
      <form id="gForm" class="card" style="margin-top:0">
        <label class="field">
          প্রবীণের মোবাইল নম্বর দিয়ে যুক্ত করুন
          <input name="phone" inputmode="numeric" placeholder="01XXXXXXXXX" required>
        </label>
        <button class="btn main full" type="submit">অনুরোধ পাঠান</button>
      </form>

      <div id="gList"></div>`;

    // Guardian profile open handler
    $('#guardianProfBtn').onclick = () => {
      openUserProfileModal();
    };

    $('#gForm').addEventListener('submit', async e => {
      e.preventDefault();
      const b = $('button[type=submit]', e.target); b.disabled = true;
      try { 
        await gcall({ action: 'link', phone: new FormData(e.target).get('phone') }); 
        e.target.reset(); 
        toast('অনুরোধ পাঠানো হয়েছে। প্রবীণের অনুমোদনের অপেক্ষা করুন'); 
        refresh(true); 
      }
      catch (err) { toast(err.message, 'err'); }
      b.disabled = false;
    });

    $('#closeEmgModal').addEventListener('click', () => { $('#guardianOrderModal').hidden = true; });

    $('#emgTaskForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await call('task_create.php', { method: 'POST', body: fd });
        toast(res.paid ? `বিকাশ অগ্রিম সফল! সহায়ককে পাঠানো হয়েছে` : 'জরুরি অনুরোধ পোস্ট হয়েছে');
        $('#guardianOrderModal').hidden = true;
        refresh(true);
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function paintGuardian(r) {
    $('#gList').innerHTML = r.links.length ? r.links.map(l => l.status === 'pending'
      ? `<h3 class="sec">${esc(l.name)} · ${esc(l.phone)}</h3>
         <div class="card" style="margin-top:0"><span class="badge pending">অনুমোদনের অপেক্ষায়</span> <p class="mute">${esc(l.name)} অনুমোদন দিলে তার কাজ ও স্বাস্থ্য প্রোফাইল এখানে দেখা যাবে।</p>
          <button class="btn bad sm" data-g="remove" data-id="${l.id}">অনুরোধ বাতিল করুন</button></div>`
      : `<div style="background:var(--surf); border:1.5px solid var(--line); border-radius:18px; padding:22px; margin-bottom:24px;">
           <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
             <div>
               <h3 style="margin:0; font-size:24px;">👴 ${esc(l.name)}</h3>
               <p class="mute small" style="margin-top:4px">📞 ${esc(l.phone)} · 📍 ${esc(l.area || '')}</p>
               ${l.blood_group ? `<span class="badge ok" style="margin-top:6px;">রক্ত: ${esc(l.blood_group)}</span> ` : ''}
               ${l.emergency_contact ? `<span class="badge line" style="margin-top:6px;">জরুরি: ${esc(l.emergency_contact)}</span>` : ''}
               ${l.medical_notes ? `<p class="mute small" style="margin-top:6px; background:var(--surf2); padding:6px 10px; border-radius:8px;">🩺 <b>মেডিকেল নোট:</b> ${esc(l.medical_notes)}</p>` : ''}
             </div>
             <button class="btn main sm emg-order-btn" data-id="${l.elderly_id}" data-name="${esc(l.name)}" data-addr="${esc(l.address || '')}">
               🚨 ${esc(l.name)}-এর জন্য সাহায্য পাঠান
             </button>
           </div>
           <hr style="border:0; border-top:1px dashed var(--line); margin:14px 0;">
           ${l.tasks && l.tasks.length ? l.tasks.map(gCard).join('') : '<div class="empty">এখনো কোনো কাজ পোস্ট করা হয়নি</div>'}
           <button class="btn bad sm" style="margin-top:14px;" data-g="remove" data-id="${l.id}">সংযোগ বিচ্ছিন্ন করুন</button>
         </div>`).join('')
      : '<div class="empty">এখনো কোনো প্রবীণকে যুক্ত করা হয়নি</div>';

    // Emergency Order Button Event
    $$('.emg-order-btn').forEach(b => {
      b.onclick = () => {
        $('#guardianOrderModal').hidden = false;
        $('#emgTargetId').value = b.dataset.id;
        $('#emgModalTitle').textContent = `🚨 ${b.dataset.name}-এর জন্য সাহায্য পাঠাচ্ছেন`;
        if (b.dataset.addr) $('#emgDeliveryInput').value = b.dataset.addr;
        window.scrollTo({ top: $('#guardianOrderModal').offsetTop - 60, behavior: 'smooth' });
      };
    });
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

  /* ---------- বাটনের অ্যাকশন ---------- */
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
    try { await gcall({ action: b.dataset.g, id: +b.dataset.id }); toast(b.dataset.g === 'approve' ? 'অনুমোদন দেওয়া হয়েছে' : 'সম্পন্ন হয়েছে'); refresh(true); }
    catch (err) { toast(err.message, 'err'); }
  });
  document.addEventListener('click', e => { const c = e.target.closest('.chips [data-v]'); if (c) $('#tipV').value = c.dataset.v; });

  return { render, adminTasks, openProfile };
})();