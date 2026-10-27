<?php
require __DIR__ . '/config.php';

const TASK_SQL = "SELECT t.*, r.name AS requester_name, r.phone AS requester_phone,
    h.name AS helper_name, h.phone AS helper_phone, hp.total_rating AS helper_rating,
    (SELECT ROUND(AVG(v2.rating), 1) FROM reviews v2 WHERE v2.reviewee_id = t.requester_id) AS requester_rating,
    EXISTS(SELECT 1 FROM reviews v WHERE v.task_id = t.id AND v.reviewer_id = t.requester_id) AS reviewed
    FROM tasks t JOIN users r ON r.id = t.requester_id
    LEFT JOIN users h ON h.id = t.helper_id
    LEFT JOIN helper_profiles hp ON hp.user_id = t.helper_id";

function need_login(): array {
    $u = current_user();
    if (!$u) fail('আগে লগইন করুন', 401);
    return $u;
}

function task_by_id(int $id): ?array {
    $s = db()->prepare(TASK_SQL . ' WHERE t.id = ?');
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

/* ---------- নোটিফিকেশন ---------- */
function notify(int $uid, string $title, string $body = '', ?int $task = null): void {
    try {
        db()->prepare('INSERT INTO notifications (user_id, title, body, task_id) VALUES (?, ?, ?, ?)')
            ->execute([$uid, mb_substr($title, 0, 150), mb_substr($body, 0, 300) ?: null, $task]);
    } catch (Throwable $e) { error_log((string)$e); }
}

function notify_guardians(int $elderlyId, string $title, string $body = '', ?int $task = null): void {
    $s = db()->prepare("SELECT guardian_id FROM guardian_links WHERE elderly_id = ? AND status = 'approved'");
    $s->execute([$elderlyId]);
    foreach ($s->fetchAll(PDO::FETCH_COLUMN) as $g) notify((int)$g, $title, $body, $task);
}

function notify_requester_side(array $t, string $title, string $body = ''): void {
    notify((int)$t['requester_id'], $title, $body, (int)$t['id']);
    notify_guardians((int)$t['requester_id'], $title, $body, (int)$t['id']);
}

function notify_admins(string $title, string $body = '', ?int $task = null): void {
    foreach (db()->query("SELECT id FROM users WHERE role = 'admin'")->fetchAll(PDO::FETCH_COLUMN) as $a) notify((int)$a, $title, $body, $task);
}

/* ---------- কাজের তথ্য (ভূমিকা অনুযায়ী ও সার্ভার সাইড লেজার হিসাব) ---------- */
function shape(array $t, array $u): array {
    $adminFee = (float)($t['admin_fee'] ?? round(((float)$t['base_fee'] * PLATFORM_COMMISSION_RATE), 2));
    $helperFee = (float)($t['helper_fee'] ?? round(((float)$t['base_fee'] * (1 - PLATFORM_COMMISSION_RATE)), 2));
    $tip = (float)$t['tip_amount'];

    $o = [
        'id' => (int)$t['id'], 'category' => $t['category'], 'description' => $t['description'], 'area' => $t['area'],
        'has_voice' => !empty($t['voice_note']),
        'base_fee' => (float)$t['base_fee'],
        'admin_fee' => $adminFee,
        'helper_fee' => $helperFee,
        'tip_amount' => $tip,
        'item_cost' => (float)$t['item_cost'],
        'total_amount' => (float)$t['total_amount'],
        'helper_total_payout' => $helperFee + $tip,
        'status' => $t['status'], 'payment_method' => $t['payment_method'], 'payment_status' => $t['payment_status'],
        'is_disputed' => (int)($t['is_disputed'] ?? 0),
        'requester_rating' => (float)($t['requester_rating'] ?? 5),
        'created_at' => date('c', strtotime($t['created_at'])),
    ];
    $uid = (int)$u['id'];
    $isReq = $uid === (int)$t['requester_id'];
    $isHelper = $t['helper_id'] !== null && $uid === (int)$t['helper_id'];
    $isAdmin = $u['role'] === 'admin';
    $helperInfo = ['helper_id' => $t['helper_id'] !== null ? (int)$t['helper_id'] : null, 'helper_name' => $t['helper_name'],
                   'helper_phone' => $t['helper_phone'], 'helper_rating' => $t['helper_rating'] !== null ? (float)$t['helper_rating'] : null];

    if ($isReq) {
        $o += ['pickup' => $t['pickup_address'], 'delivery' => $t['delivery_address'], 'handshake_pin' => $t['handshake_pin'],
               'cancel_reason' => $t['cancel_reason'], 'dispute_reason' => $t['dispute_reason'] ?? null,
               'can_review' => $t['status'] === 'completed' && !(int)$t['reviewed']] + $helperInfo;
    }
    if ($isHelper || $isAdmin) {
        $o += ['pickup' => $t['pickup_address'], 'delivery' => $t['delivery_address'],
               'requester_name' => $t['requester_name'], 'requester_phone' => $t['requester_phone'],
               'cancel_reason' => $t['cancel_reason'], 'dispute_reason' => $t['dispute_reason'] ?? null];
    }
    if ($isAdmin) $o += $helperInfo + ['dispute_by' => $t['dispute_by'] ?? null, 'admin_note' => $t['admin_note'] ?? null];
    return $o;
}