<?php
// অভিভাবক ↔ প্রবীণ সংযোগ: অভিভাবক নম্বর দিয়ে অনুরোধ পাঠান, প্রবীণ অনুমোদন দিলে অভিভাবক কাজগুলো শুধু দেখতে পারেন।
require __DIR__ . '/lib.php';
$u = need_login();
$me = (int)$u['id'];
if (!in_array($u['role'], ['guardian', 'elderly'], true)) fail('এই সুবিধা শুধু অভিভাবক ও প্রবীণের জন্য', 403);
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_post();
    $in  = json_body();
    $act = $in['action'] ?? '';
    $id  = (int)($in['id'] ?? 0);

    if ($act === 'link') {
        if ($u['role'] !== 'guardian') fail('শুধু অভিভাবক অনুরোধ পাঠাতে পারবেন', 403);
        $phone = norm_phone((string)($in['phone'] ?? ''));
        if (!preg_match('/^01\d{9}$/', $phone)) fail('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন');
        $s = $pdo->prepare("SELECT id FROM users WHERE phone IN (?, ?) AND role = 'elderly' LIMIT 1");
        $s->execute([$phone, '+88' . $phone]);
        $eid = (int)$s->fetchColumn();
        if (!$eid) fail('এই নম্বরে কোনো প্রবীণের একাউন্ট পাওয়া যায়নি');
        $c = $pdo->prepare('SELECT 1 FROM guardian_links WHERE guardian_id = ? AND elderly_id = ?');
        $c->execute([$me, $eid]);
        if ($c->fetchColumn()) fail('এই প্রবীণকে আগেই অনুরোধ পাঠানো হয়েছে');
        $pdo->prepare("INSERT INTO guardian_links (guardian_id, elderly_id, status) VALUES (?, ?, 'pending')")->execute([$me, $eid]);
        notify($eid, 'অভিভাবকের অনুরোধ', $u['name'] . ' আপনার কাজগুলো দেখতে চান। অনুমোদন দিন বা প্রত্যাখ্যান করুন।');
        out(['ok' => true]);
    }
    if ($act === 'approve') {
        if ($u['role'] !== 'elderly') fail('শুধু প্রবীণ অনুমোদন দিতে পারবেন', 403);
        $pdo->prepare("UPDATE guardian_links SET status = 'approved' WHERE id = ? AND elderly_id = ?")->execute([$id, $me]);
        $g = $pdo->prepare('SELECT guardian_id FROM guardian_links WHERE id = ? AND elderly_id = ?');
        $g->execute([$id, $me]);
        if ($gid = $g->fetchColumn()) notify((int)$gid, 'অনুরোধ অনুমোদিত', $u['name'] . ' আপনাকে তার কাজ দেখার অনুমতি দিয়েছেন।');
        out(['ok' => true]);
    }
    if ($act === 'remove') {   // অভিভাবক (অনুরোধ বাতিল/সংযোগ ছাড়া) বা প্রবীণ (প্রত্যাখ্যান/সরানো) — দুজনেই পারেন
        $pdo->prepare('DELETE FROM guardian_links WHERE id = ? AND (guardian_id = ? OR elderly_id = ?)')->execute([$id, $me, $me]);
        out(['ok' => true]);
    }
    fail('অজানা অনুরোধ');
}

if ($u['role'] === 'elderly') {
    $s = $pdo->prepare('SELECT l.id, l.status, g.name, g.phone FROM guardian_links l JOIN users g ON g.id = l.guardian_id WHERE l.elderly_id = ? ORDER BY l.id DESC');
    $s->execute([$me]);
    out(['links' => $s->fetchAll()]);
}

// অভিভাবক: সংযুক্ত প্রবীণ ও (অনুমোদিত হলে) তাদের কাজ — শুধু দেখার জন্য। পিন, ঠিকানা, ভয়েস দেখানো হয় না।
$s = $pdo->prepare('SELECT l.id, l.status, e.id AS eid, e.name, e.phone, e.area FROM guardian_links l JOIN users e ON e.id = l.elderly_id WHERE l.guardian_id = ? ORDER BY l.id DESC');
$s->execute([$me]);
$links = $s->fetchAll();
foreach ($links as &$l) {
    $l['tasks'] = [];
    if ($l['status'] !== 'approved') { unset($l['eid']); continue; }
    $t = $pdo->prepare(TASK_SQL . ' WHERE t.requester_id = ? ORDER BY t.id DESC LIMIT 20');
    $t->execute([$l['eid']]);
    foreach ($t->fetchAll() as $r) {
        $l['tasks'][] = [
            'id' => (int)$r['id'], 'category' => $r['category'], 'description' => $r['description'], 'area' => $r['area'],
            'has_voice' => false, 'status' => $r['status'],
            'base_fee' => (float)$r['base_fee'], 'tip_amount' => (float)$r['tip_amount'],
            'item_cost' => (float)$r['item_cost'], 'total_amount' => (float)$r['total_amount'],
            'payment_method' => $r['payment_method'], 'payment_status' => $r['payment_status'],
            'helper_id' => $r['helper_id'] !== null ? (int)$r['helper_id'] : null,
            'helper_name' => $r['helper_name'],
            'helper_rating' => $r['helper_rating'] !== null ? (float)$r['helper_rating'] : null,
            'is_disputed' => (int)($r['is_disputed'] ?? 0),
            'created_at' => date('c', strtotime($r['created_at'])),
        ];
    }
    unset($l['eid']);
}
unset($l);
out(['links' => $links]);
