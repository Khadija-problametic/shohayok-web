<?php
require __DIR__ . '/lib.php';
$u = need_login();
$map = fn(array $rows) => array_map(fn($t) => shape($t, $u), $rows);

if ($u['role'] === 'admin') {
    out(['tasks' => $map(db()->query(TASK_SQL . ' ORDER BY t.id DESC LIMIT 100')->fetchAll())]);
}
if ($u['role'] === 'helper') {
    if ($u['status'] !== 'approved') fail('আপনার একাউন্ট এখনো অনুমোদিত হয়নি', 403);
    $a = db()->prepare(TASK_SQL . " WHERE t.status = 'pending' AND t.helper_id IS NULL AND t.area = ? ORDER BY t.id DESC LIMIT 30");
    $a->execute([$u['area']]);
    $m = db()->prepare(TASK_SQL . ' WHERE t.helper_id = ? ORDER BY t.id DESC LIMIT 100');
    $m->execute([$u['id']]);
    out(['available' => $map($a->fetchAll()), 'mine' => $map($m->fetchAll())]);
}
$s = db()->prepare(TASK_SQL . ' WHERE t.requester_id = ? ORDER BY t.id DESC LIMIT 50');
$s->execute([$u['id']]);
out(['tasks' => $map($s->fetchAll())]);
