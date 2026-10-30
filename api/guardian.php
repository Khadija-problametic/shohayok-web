<?php
require __DIR__ . '/lib.php';
$u = need_login();

/* প্রবীণ ও অভিভাবক সংযোগ হ্যান্ডলার */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_post();
    $in = $_POST ?: json_body();
    $action = $in['action'] ?? '';

    // ১. অভিভাবক প্রবীণকে লিংক করার অনুরোধ পাঠাবেন
    if ($action === 'link') {
        if ($u['role'] !== 'guardian') fail('শুধু অভিভাবক অনুরোধ পাঠাতে পারেন', 403);
        $phone = norm_phone((string)($in['phone'] ?? ''));
        if (!preg_match('/^01\d{9}$/', $phone)) fail('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');

        $elder = user_by_phone($phone);
        if (!$elder || $elder['role'] !== 'elderly') fail('এই নম্বরে কোনো প্রবীণ একাউন্ট পাওয়া যায়নি', 404);
        if ((int)$elder['id'] === (int)$u['id']) fail('নিজের একাউন্টে যুক্ত হতে পারবেন না');

        $chk = db()->prepare('SELECT id, status FROM guardian_links WHERE guardian_id = ? AND elderly_id = ?');
        $chk->execute([$u['id'], $elder['id']]);
        $row = $chk->fetch();

        if ($row) {
            if ($row['status'] === 'approved') fail('ইতোমধ্যে এই প্রবীণ আপনার সাথে সংযুক্ত আছেন');
            if ($row['status'] === 'pending') fail('অনুরোধ ইতোমধ্যে পাঠানো হয়েছে, প্রবীণের অনুমোদনের অপেক্ষা করুন');
            db()->prepare("UPDATE guardian_links SET status = 'pending' WHERE id = ?")->execute([$row['id']]);
        } else {
            db()->prepare('INSERT INTO guardian_links (guardian_id, elderly_id, status) VALUES (?, ?, ?)')
                ->execute([$u['id'], $elder['id'], 'pending']);
        }

        notify((int)$elder['id'], 'নতুন অভিভাবক সংযোগ অনুরোধ', $u['name'] . ' আপনার সাথে যুক্ত হতে অনুরোধ পাঠিয়েছেন।', null);
        out(['success' => true, 'message' => 'অনুরোধ পাঠানো হয়েছে']);
    }

    // ২. প্রবীণ সংযোগ অনুমোদন করবেন
    if ($action === 'approve') {
        if ($u['role'] !== 'elderly') fail('শুধু প্রবীণ অনুমোদন দিতে পারেন', 403);
        $lid = (int)($in['id'] ?? 0);
        db()->prepare("UPDATE guardian_links SET status = 'approved' WHERE id = ? AND elderly_id = ?")
            ->execute([$lid, $u['id']]);
        
        $g = db()->prepare('SELECT guardian_id FROM guardian_links WHERE id = ?');
        $g->execute([$lid]);
        $gid = $g->fetchColumn();
        if ($gid) notify((int)$gid, 'সংযোগ অনুমোদিত', $u['name'] . ' আপনার অভিভাবক সংযোগ অনুমোদন করেছেন।', null);

        out(['success' => true]);
    }

    // ৩. সংযোগ বাতিল বা মুছে ফেলা
    if ($action === 'remove') {
        $lid = (int)($in['id'] ?? 0);
        db()->prepare('DELETE FROM guardian_links WHERE id = ? AND (guardian_id = ? OR elderly_id = ?)')
            ->execute([$lid, $u['id'], $u['id']]);
        out(['success' => true]);
    }

    fail('ভুল অনুরোধ');
}

/* GET: অভিভাবকের লিংকড প্রবীণ এবং প্রবীণের লিংকড অভিভাবক তালিকা */
if ($u['role'] === 'guardian') {
    $q = db()->prepare("
        SELECT gl.id, gl.status, u.id AS elderly_id, u.name, u.phone, u.area, 
               u.blood_group, u.emergency_contact, u.medical_notes, u.address
        FROM guardian_links gl
        JOIN users u ON u.id = gl.elderly_id
        WHERE gl.guardian_id = ?
        ORDER BY gl.id DESC
    ");
    $q->execute([$u['id']]);
    $links = $q->fetchAll(PDO::FETCH_ASSOC);

    foreach ($links as &$link) {
        if ($link['status'] === 'approved') {
            $tq = db()->prepare("SELECT t.*, u.name AS helper_name, u.phone AS helper_phone 
                                 FROM tasks t 
                                 LEFT JOIN users u ON u.id = t.helper_id 
                                 WHERE t.requester_id = ? OR t.on_behalf_of = ?
                                 ORDER BY t.id DESC LIMIT 10");
            $tq->execute([$link['elderly_id'], $link['elderly_id']]);
            $tasks = $tq->fetchAll(PDO::FETCH_ASSOC);
            $link['tasks'] = array_map(fn($t) => shape($t, $u), $tasks);
        } else {
            $link['tasks'] = [];
        }
    }
    out(['links' => $links]);
}

if ($u['role'] === 'elderly') {
    $q = db()->prepare("
        SELECT gl.id, gl.status, u.id AS guardian_id, u.name, u.phone, u.area
        FROM guardian_links gl
        JOIN users u ON u.id = gl.guardian_id
        WHERE gl.elderly_id = ?
        ORDER BY gl.id DESC
    ");
    $q->execute([$u['id']]);
    out(['links' => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

out(['links' => []]);