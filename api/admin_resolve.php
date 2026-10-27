<?php
// অ্যাডমিনের অভিযোগ নিষ্পত্তি: কাজ সম্পন্ন বা বাতিল ঘোষণা
require __DIR__ . '/lib.php';
need_post();
need_admin();

$in     = json_body();
$id     = (int)($in['id'] ?? 0);
$action = (string)($in['action'] ?? '');
$note   = mb_substr(trim((string)($in['note'] ?? '')), 0, 500);

if (!$id || !in_array($action, ['completed', 'cancelled'], true)) fail('সঠিক তথ্য দিন');
if ($note === '') fail('সিদ্ধান্তের নোট লিখুন');

$pdo = db();
$pdo->beginTransaction();
$s = $pdo->prepare('SELECT * FROM tasks WHERE id = ? AND is_disputed = 1 FOR UPDATE');
$s->execute([$id]);
$t = $s->fetch();
if (!$t) fail('এই কাজে কোনো খোলা অভিযোগ নেই', 404);

if ($action === 'completed') {
    $pdo->prepare("UPDATE tasks SET status = 'completed', completed_at = NOW(), is_disputed = 0, admin_note = ? WHERE id = ?")->execute([$note, $id]);
    if ($t['helper_id']) $pdo->prepare('UPDATE helper_profiles SET total_tasks_completed = total_tasks_completed + 1 WHERE user_id = ?')->execute([$t['helper_id']]);
} else {
    $pdo->prepare("UPDATE tasks SET status = 'cancelled', cancel_reason = ?, is_disputed = 0, admin_note = ? WHERE id = ?")->execute(['অ্যাডমিনের সিদ্ধান্তে বাতিল', $note, $id]);
}
$pdo->commit();

$msg = ($action === 'completed' ? 'কাজটি সম্পন্ন ঘোষণা করা হয়েছে।' : 'কাজটি বাতিল ঘোষণা করা হয়েছে।') . " অ্যাডমিনের নোট: $note";
notify_requester_side($t, "অভিযোগের নিষ্পত্তি (কাজ #$id)", $msg);
if ($t['helper_id']) notify((int)$t['helper_id'], "অভিযোগের নিষ্পত্তি (কাজ #$id)", $msg, $id);
out(['ok' => true]);
