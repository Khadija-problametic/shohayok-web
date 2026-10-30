<?php
require __DIR__ . '/lib.php';
need_post();
$u   = need_login();
$in  = json_body();
$id  = (int)($in['id'] ?? 0);
$act = (string)($in['action'] ?? '');

$pdo = db();
$pdo->beginTransaction();                                   // একই কাজ দুজন একসঙ্গে নিতে পারবেন না (সারি লক)
$s = $pdo->prepare('SELECT * FROM tasks WHERE id = ? FOR UPDATE');
$s->execute([$id]);
$t = $s->fetch();
if (!$t) fail('কাজটি পাওয়া যায়নি', 404);

$uid      = (int)$u['id'];
$isReq    = $uid === (int)$t['requester_id'];
$isHelper = $t['helper_id'] !== null && $uid === (int)$t['helper_id'];
$isAdmin  = $u['role'] === 'admin';
$isGuardian = false;                                         // অনুমোদিত অভিভাবক প্রবীণের হয়ে বিকাশে বিল দিতে পারবেন
// অভিভাবক প্রবীণের হয়ে অথবা সরাসরি অন-বিহাফ অর্ডারে বিল দিতে পারবেন
if ($u['role'] === 'guardian') {
    $g = $pdo->prepare("SELECT 1 FROM guardian_links WHERE guardian_id = ? AND elderly_id IN (?, ?) AND status = 'approved'");
    $g->execute([$uid, $t['requester_id'], (int)($t['on_behalf_of'] ?? 0)]);
    $isGuardian = (bool)$g->fetchColumn();
}
$st  = $t['status'];
$upd = fn(string $sql, array $p) => $pdo->prepare($sql)->execute($p);
$me  = $u['name'];
$tk  = 'কাজ #' . $id;

// অভিযোগ চলাকালীন কাজ স্থগিত: শুধু অ্যাডমিন এগোতে পারবেন
if (!empty($t['is_disputed']) && !$isAdmin && in_array($act, ['accept', 'status', 'receipt', 'complete', 'cancel', 'tip'], true))
    fail('কাজটি এখন অভিযোগাধীন। অ্যাডমিনের সিদ্ধান্তের জন্য অপেক্ষা করুন', 423);

switch ($act) {
    case 'accept':
        if ($u['role'] !== 'helper' || $u['status'] !== 'approved') fail('শুধু অনুমোদিত সহায়ক কাজ নিতে পারবেন', 403);
        if ($st !== 'pending' || $t['helper_id'] !== null) fail('কাজটি আর খালি নেই, অন্য সহায়ক নিয়ে নিয়েছেন', 409);
        if ($t['area'] !== $u['area']) fail('এটি আপনার এলাকার কাজ নয়', 403);
        $a = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE helper_id = ? AND status IN ('accepted','on_the_way','arrived')");
        $a->execute([$uid]);
        if ($a->fetchColumn() > 0) fail('আগে চলমান কাজটি শেষ করুন', 409);
        $upd("UPDATE tasks SET helper_id = ?, status = 'accepted', accepted_at = NOW() WHERE id = ?", [$uid, $id]);
        notify_requester_side($t, 'সহায়ক পাওয়া গেছে', "$me আপনার $tk নিয়েছেন। তার প্রোফাইল দেখে নিতে পারেন।");
        break;

    case 'status':
        if (!$isHelper) fail('অনুমতি নেই', 403);
        $next = ['accepted' => 'on_the_way', 'on_the_way' => 'arrived'][$st] ?? null;
        if (!$next || ($in['to'] ?? '') !== $next) fail('এই ধাপে অবস্থা বদলানো যাবে না');
        $upd('UPDATE tasks SET status = ? WHERE id = ?', [$next, $id]);
        $next === 'on_the_way'
            ? notify_requester_side($t, 'সহায়ক রওনা দিয়েছেন', "$me $tk-এর জন্য রওনা দিয়েছেন।")
            : notify_requester_side($t, 'সহায়ক দরজায় পৌঁছেছেন', "$me পৌঁছে গেছেন। পিনটি তাকে দেখান।");
        break;

    case 'receipt':
        if (!$isHelper || !in_array($st, ['accepted', 'on_the_way', 'arrived'], true)) fail('এখন খরচ লেখা যাবে না', 403);
        $c = round((float)($in['item_cost'] ?? -1), 2);
        if ($c < 0 || $c > 50000) fail('খরচের পরিমাণ সঠিক নয়');
        $upd('UPDATE tasks SET item_cost = ? WHERE id = ?', [$c, $id]);
        notify_requester_side($t, 'দোকানের খরচ হালনাগাদ', "$tk: দোকানের খরচ ৳" . $c);
        break;

    case 'complete':
        if (!$isHelper || $st !== 'arrived') fail('দরজায় পৌঁছানোর পরই পিন দিয়ে কাজ শেষ করা যায়', 403);
        if ((int)$t['pin_attempts'] >= 5) fail('অনেকবার ভুল পিন দেওয়া হয়েছে। অ্যাডমিনের সঙ্গে যোগাযোগ করুন', 423);
        if (!hash_equals((string)$t['handshake_pin'], trim((string)($in['pin'] ?? '')))) {
            $upd('UPDATE tasks SET pin_attempts = pin_attempts + 1 WHERE id = ?', [$id]);
            $pdo->commit();                                  // ভুল চেষ্টার হিসাব যেন হারিয়ে না যায়
            fail('পিন মেলেনি। বাকি চেষ্টা: ' . (4 - (int)$t['pin_attempts']), 422);
        }
        $upd("UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = ?", [$id]);
        $upd('UPDATE helper_profiles SET total_tasks_completed = total_tasks_completed + 1 WHERE user_id = ?', [$uid]);
        notify_requester_side($t, 'কাজ সম্পন্ন', "$tk শেষ হয়েছে। এখন টাকা পরিশোধ করুন ও সহায়ককে রেটিং দিন।");
        break;

    case 'tip':
        if (!$isReq || in_array($st, ['completed', 'cancelled'], true)) fail('এখন বখশিশ দেওয়া যাবে না', 403);
        $a = round((float)($in['amount'] ?? 0), 2);
        if ($a < 10 || $a > 1000) fail('বখশিশ ১০ থেকে ১০০০ টাকার মধ্যে হতে হবে');
        if ((float)$t['tip_amount'] + $a > 2000) fail('মোট বখশিশ ২০০০ টাকার বেশি হতে পারবে না');
        $upd('UPDATE tasks SET tip_amount = tip_amount + ? WHERE id = ?', [$a, $id]);
        if ($t['helper_id']) notify((int)$t['helper_id'], 'বখশিশ যোগ হয়েছে', "$tk-এ ৳$a বখশিশ যোগ হয়েছে।", $id);
        break;

    case 'cancel':
        if (!$isReq && !$isAdmin) fail('অনুমতি নেই', 403);
        if (!in_array($st, ['pending', 'accepted', 'on_the_way'], true)) fail('এই অবস্থায় কাজ বাতিল করা যায় না');
        if ((float)$t['item_cost'] > 0 && !$isAdmin) fail('সহায়ক ইতিমধ্যে জিনিস কিনেছেন। অ্যাডমিনের সঙ্গে যোগাযোগ করুন');
        $r = mb_substr(trim((string)($in['reason'] ?? '')), 0, 255);
        if ($r === '') fail('বাতিলের কারণ লিখুন');
        $upd("UPDATE tasks SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [$r, $id]);
        if ($t['helper_id']) notify((int)$t['helper_id'], 'কাজ বাতিল হয়েছে', "$tk বাতিল হয়েছে। কারণ: $r", $id);
        if ($isAdmin) notify_requester_side($t, 'কাজ বাতিল হয়েছে', "অ্যাডমিন $tk বাতিল করেছেন। কারণ: $r");
        break;

    case 'dispute':
        if (!$isReq && !$isHelper) fail('অনুমতি নেই', 403);
        if (in_array($st, ['completed', 'cancelled'], true)) fail('শেষ হয়ে যাওয়া কাজে অভিযোগ করা যায় না');
        if (!empty($t['is_disputed'])) fail('এই কাজে আগেই অভিযোগ করা হয়েছে', 409);
        $r = mb_substr(trim((string)($in['reason'] ?? '')), 0, 500);
        if ($r === '') fail('অভিযোগের কারণ লিখুন');
        $upd('UPDATE tasks SET is_disputed = 1, dispute_reason = ?, dispute_by = ? WHERE id = ?', [$r, $isReq ? 'প্রবীণ' : 'সহায়ক', $id]);
        notify_admins('নতুন অভিযোগ', "$tk: $r", $id);
        $isReq ? ($t['helper_id'] && notify((int)$t['helper_id'], 'অভিযোগ করা হয়েছে', "$tk নিয়ে অভিযোগ জমা পড়েছে। অ্যাডমিন দেখছেন।", $id))
               : notify_requester_side($t, 'অভিযোগ করা হয়েছে', "$tk নিয়ে অভিযোগ জমা পড়েছে। অ্যাডমিন দেখছেন।");
        break;

    case 'pay':
        if ($st !== 'completed' || $t['payment_status'] === 'paid') fail('এখন পরিশোধ করা যাবে না');
        $m = $in['method'] ?? '';
        if ($m === 'cash') {
            if (!$isHelper) fail('নগদ টাকা পাওয়ার কথা সহায়ক নিশ্চিত করবেন', 403);
            $upd("UPDATE tasks SET payment_method = 'cash', payment_status = 'paid', bkash_trx_id = NULL WHERE id = ?", [$id]);
            notify_requester_side($t, 'পরিশোধ নিশ্চিত', "$tk: সহায়ক নগদ টাকা পাওয়া নিশ্চিত করেছেন।");
        } elseif ($m === 'bkash') {
            if (!$isReq && !$isGuardian) fail('অনুমতি নেই', 403);
            if (!DEMO_PAYMENTS) fail('অনলাইন পেমেন্ট এখনো চালু হয়নি');
            $upd("UPDATE tasks SET payment_method = 'bkash', payment_status = 'paid', bkash_trx_id = ? WHERE id = ?", ['DEMO' . strtoupper(bin2hex(random_bytes(4))), $id]);
            if ($t['helper_id']) notify((int)$t['helper_id'], 'বিকাশে টাকা পাঠানো হয়েছে', "$tk-এর টাকা বিকাশে পরিশোধ হয়েছে।", $id);
            if ($isGuardian) notify((int)$t['requester_id'], 'অভিভাবক বিল দিয়েছেন', "$me আপনার $tk-এর বিল পরিশোধ করেছেন।", $id);
        } else fail('পেমেন্টের ধরন সঠিক নয়');
        break;

    case 'review':
        if (!$isReq || $st !== 'completed' || $t['helper_id'] === null) fail('এখন রেটিং দেওয়া যাবে না', 403);
        $r = (int)($in['rating'] ?? 0);
        if ($r < 1 || $r > 5) fail('১ থেকে ৫ রেটিং দিন');
        try {
            $upd('INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
                [$id, $uid, $t['helper_id'], $r, mb_substr(trim((string)($in['comment'] ?? '')), 0, 500) ?: null]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') fail('আপনি আগেই রেটিং দিয়েছেন', 409);
            throw $e;
        }
        $upd('UPDATE helper_profiles SET total_rating = (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE reviewee_id = ?) WHERE user_id = ?', [$t['helper_id'], $t['helper_id']]);
        notify((int)$t['helper_id'], 'নতুন রেটিং পেয়েছেন', "$tk-এ আপনি $r রেটিং পেয়েছেন।", $id);
        break;

    default: fail('অজানা অনুরোধ');
}
$pdo->commit();
out(shape(task_by_id($id), $u));