<?php
require __DIR__ . '/lib.php';
need_post();
$u = need_login();

if ($u['role'] !== 'elderly' && $u['role'] !== 'guardian') {
    fail('শুধু প্রবীণ বা অভিভাবক কাজ পোস্ট করতে পারবেন', 403);
}

$in   = $_POST ?: json_body();
$cat  = $in['category'] ?? '';
$desc = trim((string)($in['description'] ?? ''));
$pick = trim((string)($in['pickup'] ?? ''));
$del  = trim((string)($in['delivery'] ?? ''));
$tip  = round((float)($in['tip'] ?? 0), 2);
$item_cost = round((float)($in['item_cost'] ?? 0), 2);
$pay  = $in['payment_method'] ?? 'cash';
$payTiming = $in['payment_timing'] ?? 'on_delivery';

// অভিভাবক যদি বাবা-মায়ের পক্ষ থেকে দূর থেকে অর্ডার করেন
$onBehalf = !empty($in['on_behalf_of']) ? (int)$in['on_behalf_of'] : null;
$targetArea = $u['area'];
$targetRequesterId = $u['id'];

if ($u['role'] === 'guardian' && $onBehalf) {
    // যাচাই: অভিভাবকের সাথে প্রবীণ আসলেই অনুমোদিত কিনা
    $chk = db()->prepare("SELECT u.area, u.name, u.phone, u.address FROM guardian_links gl 
                          JOIN users u ON u.id = gl.elderly_id 
                          WHERE gl.guardian_id = ? AND gl.elderly_id = ? AND gl.status = 'approved'");
    $chk->execute([$u['id'], $onBehalf]);
    $elder = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$elder) fail('এই প্রবীণের জন্য অর্ডার করার অনুমতি নেই', 403);
    
    $targetArea = $elder['area']; // প্রবীণের এলাকার সহায়ক কাজ পাবেন
    if (empty($del) && !empty($elder['address'])) {
        $del = $elder['address'];
    }
}

/* ভয়েস নোট সংরক্ষণ */
$voice = null;
$f = $_FILES['voice_note'] ?? null;
if ($f && $f['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('ভয়েস নোট আপলোড হয়নি');
    if ($f['size'] > 2 * 1024 * 1024) fail('ভয়েস নোট ২ MB-এর বেশি হতে পারবে না');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['audio/webm' => 'webm', 'video/webm' => 'webm', 'audio/ogg' => 'ogg', 'application/ogg' => 'ogg',
            'audio/mp4' => 'm4a', 'video/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'][$mime] ?? null;
    if (!$ext) fail('ভয়েস ফাইলের ধরন সঠিক নয়');
    if (!is_dir(VOICE_DIR)) mkdir(VOICE_DIR, 0750, true);
    $voice = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], VOICE_DIR . $voice)) fail('ভয়েস সংরক্ষণ করা যায়নি');
}

if (!in_array($cat, ['pharmacy', 'grocery', 'hospital', 'other'], true)) fail('কাজের ধরন বেছে নিন');
if ($voice === null && mb_strlen($desc) < 3) fail('কাজের বিবরণ অন্তত ৩ অক্ষরের হতে হবে');
if (mb_strlen($desc) > 1000) fail('লেখা ১০০০ অক্ষরের বেশি হতে পারবে না');
if ($desc === '') $desc = ($cat === 'hospital') ? '(হাসপাতালে জরুরি সঙ্গী হওয়ার অনুরোধ)' : '(ভয়েস নোটে বলা হয়েছে)';
if (mb_strlen($pick) < 3 || mb_strlen($pick) > 300) fail('দোকান, হাসপাতাল বা সংগ্রহের স্থান লিখুন');
if (mb_strlen($del) < 3 || mb_strlen($del) > 300) fail('ডেলিভারি বা প্রবীণের সঠিক ঠিকানা দিন');
if ($tip < 0 || $tip > 1000) fail('বখশিশ ০ থেকে ১০০০ টাকার মধ্যে হতে হবে');
if ($item_cost < 0 || $item_cost > 50000) fail('খরচের পরিমাণ সঠিক নয়');
if (!in_array($pay, ['bkash', 'cash'], true)) fail('পেমেন্টের ধরন সঠিক নয়');

// চলমান কাজের লিমিট চেক
$c = db()->prepare("SELECT COUNT(*) FROM tasks WHERE requester_id = ? AND status IN ('pending','accepted','on_the_way','arrived')");
$c->execute([$u['id']]);
if ($c->fetchColumn() >= 6) fail('একসঙ্গে ৬টির বেশি চলমান কাজ রাখা যাবে না', 429);

$pin = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);

// হাসপাতালের জন্য বেস ফি ২০০ টাকা, অন্য কাজের জন্য ১০০ টাকা
$baseFee = ($cat === 'hospital') ? 200.00 : 100.00;
$commRate = defined('PLATFORM_COMMISSION_RATE') ? PLATFORM_COMMISSION_RATE : 0.10;
$adminFee = round($baseFee * $commRate, 2);
$helperFee = round($baseFee - $adminFee, 2);

$payStatus = ($pay === 'bkash' && $payTiming === 'advance') ? 'paid' : 'unpaid';
$trxId = ($payStatus === 'paid') ? 'EMRG' . strtoupper(bin2hex(random_bytes(4))) : null;

$stmt = db()->prepare('
    INSERT INTO tasks (requester_id, on_behalf_of, category, description, voice_note, pickup_address, delivery_address, area, base_fee, admin_fee, helper_fee, tip_amount, item_cost, handshake_pin, payment_method, payment_status, payment_timing, bkash_trx_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
');
$stmt->execute([
    $targetRequesterId, $onBehalf, $cat, $desc, $voice, $pick, $del, $targetArea,
    $baseFee, $adminFee, $helperFee, $tip, $item_cost, $pin, $pay, $payStatus, $payTiming, $trxId
]);

$tid = (int)db()->lastInsertId();

// প্রবীণের এলাকার অনুমোদিত সহায়কদের নোটিফিকেশন প্রদান
$hs = db()->prepare("SELECT u.id FROM users u JOIN helper_profiles h ON h.user_id = u.id
                     WHERE u.role = 'helper' AND h.verification_status = 'approved' AND u.area = ? AND u.id <> ?");
$hs->execute([$targetArea, $u['id']]);
foreach ($hs->fetchAll(PDO::FETCH_COLUMN) as $hid) {
    notify((int)$hid, '🚨 নতুন জরুরি কাজ', 'আপনার এলাকায় একজন প্রবীণের জন্য নতুন সহায়তা চাওয়া হয়েছে।', $tid);
}

// প্রবীণকে নোটিফিকেশন পাঠানো
if ($onBehalf) {
    notify((int)$onBehalf, 'আপনার জন্য সাহায্য পাঠানো হয়েছে', $u['name'] . ' দূর থেকে আপনার জন্য একটি সহায়তার অনুরোধ জানিয়েছেন।', $tid);
}

out(['success' => true, 'task_id' => $tid, 'paid' => ($payStatus === 'paid'), 'trx_id' => $trxId], 201);