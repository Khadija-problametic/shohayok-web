<?php
require __DIR__ . '/lib.php';
need_post();
$u = need_login();
if ($u['role'] !== 'elderly' && $u['role'] !== 'guardian') fail('শুধু প্রবীণ বা অভিভাবক কাজ পোস্ট করতে পারবেন', 403);

$in   = $_POST ?: json_body();          // ফর্ম-ডেটা (ভয়েস সহ) বা JSON দুটোই চলে
$cat  = $in['category'] ?? '';
$desc = trim((string)($in['description'] ?? ''));
$pick = trim((string)($in['pickup'] ?? ''));
$del  = trim((string)($in['delivery'] ?? ''));
$tip  = round((float)($in['tip'] ?? 0), 2);
$item_cost = round((float)($in['item_cost'] ?? 0), 2);   // আনুমানিক দোকানের খরচ
$pay  = $in['payment_method'] ?? 'cash';
$payTiming = $in['payment_timing'] ?? 'on_delivery';

/* ভয়েস নোট (ঐচ্ছিক) */
$voice = null;
$f = $_FILES['voice_note'] ?? null;
if ($f && $f['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('ভয়েস নোট আপলোড হয়নি');
    if ($f['size'] > 2 * 1024 * 1024) fail('ভয়েস নোট ২ MB-এর বেশি হতে পারবে না (সর্বোচ্চ ২ মিনিট)');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['audio/webm' => 'webm', 'video/webm' => 'webm', 'audio/ogg' => 'ogg', 'application/ogg' => 'ogg',
            'audio/mp4' => 'm4a', 'video/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'][$mime] ?? null;
    if (!$ext) fail('ভয়েস ফাইলের ধরন সঠিক নয়');
    if (!is_dir(VOICE_DIR)) mkdir(VOICE_DIR, 0750, true);
    $voice = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], VOICE_DIR . $voice)) fail('ভয়েস সংরক্ষণ করা যায়নি');
}

if (!in_array($cat, ['pharmacy', 'grocery', 'hospital', 'other'], true)) fail('কাজের ধরন বেছে নিন');
if ($voice === null && mb_strlen($desc) < 5) fail('লিখুন অথবা ভয়েসে বলুন (অন্তত ৫ অক্ষর)');
if (mb_strlen($desc) > 1000) fail('লেখা ১০০০ অক্ষরের বেশি হতে পারবে না');
if ($desc === '') $desc = '(ভয়েস নোটে বলা হয়েছে)';
if (mb_strlen($pick) < 3 || mb_strlen($pick) > 300) fail('দোকান বা সংগ্রহের স্থান লিখুন');
if (mb_strlen($del) < 3 || mb_strlen($del) > 300) fail('আপনার বাসার ঠিকানা লিখুন');
if ($tip < 0 || $tip > 1000) fail('বখশিশ ০ থেকে ১০০০ টাকার মধ্যে হতে হবে');
if ($item_cost < 0 || $item_cost > 50000) fail('দোকানের খরচ ০ থেকে ৫০,০০০ টাকার মধ্যে হতে হবে');
if (!in_array($pay, ['bkash', 'cash'], true)) fail('পেমেন্টের ধরন সঠিক নয়');

$c = db()->prepare("SELECT COUNT(*) FROM tasks WHERE requester_id = ? AND status IN ('pending','accepted','on_the_way','arrived')");
$c->execute([$u['id']]);
if ($c->fetchColumn() >= 5) fail('একসঙ্গে ৫টির বেশি চলমান কাজ রাখা যাবে না', 429);

$pin = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
$baseFee = 100.00;
$adminFee = round($baseFee * (defined('PLATFORM_COMMISSION_RATE') ? PLATFORM_COMMISSION_RATE : 0.10), 2);
$helperFee = round($baseFee - $adminFee, 2);

// বিকাশে অগ্রিম পরিশোধ করলে সরাসরি paid চিহ্নিত হবে
$payStatus = ($pay === 'bkash' && $payTiming === 'advance') ? 'paid' : 'unpaid';
$trxId = ($payStatus === 'paid') ? 'DEMO' . strtoupper(bin2hex(random_bytes(4))) : null;

db()->prepare('INSERT INTO tasks (requester_id, category, description, voice_note, pickup_address, delivery_address, area, base_fee, admin_fee, helper_fee, tip_amount, item_cost, handshake_pin, payment_method, payment_status, payment_timing, bkash_trx_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$u['id'], $cat, $desc, $voice, $pick, $del, $u['area'], $baseFee, $adminFee, $helperFee, $tip, $item_cost, $pin, $pay, $payStatus, $payTiming, $trxId]);

$tid = (int)db()->lastInsertId();

// এলাকার অনুমোদিত সহায়কদের ও অভিভাবকদের জানানো
$hs = db()->prepare("SELECT u.id FROM users u JOIN helper_profiles h ON h.user_id = u.id
                     WHERE u.role = 'helper' AND h.verification_status = 'approved' AND u.area = ? AND u.id <> ?");
$hs->execute([$u['area'], $u['id']]);
foreach ($hs->fetchAll(PDO::FETCH_COLUMN) as $hid) notify((int)$hid, 'নতুন কাজ', 'আপনার এলাকায় নতুন একটি কাজ এসেছে।', $tid);
notify_guardians((int)$u['id'], 'নতুন কাজ পোস্ট হয়েছে', $u['name'] . ' একটি নতুন কাজ পোস্ট করেছেন।', $tid);

out(shape(task_by_id($tid), $u), 201);