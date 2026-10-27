<?php
require __DIR__ . '/lib.php';
need_post();
$admin = need_admin();

$in     = json_body();
$id     = (int)($in['id'] ?? 0);
$status = $in['status'] ?? '';
$reason = mb_substr(trim((string)($in['reason'] ?? '')), 0, 255);

if (!in_array($status, ['approved', 'rejected'], true)) fail('অবস্থা সঠিক নয়');
$chk = db()->prepare('SELECT 1 FROM helper_profiles WHERE user_id = ?');
$chk->execute([$id]);
if (!$chk->fetch()) fail('সহায়ক খুঁজে পাওয়া যায়নি', 404);

db()->prepare('UPDATE helper_profiles SET verification_status = ?, rejection_reason = ?, reviewed_at = NOW(), reviewed_by = ? WHERE user_id = ?')
    ->execute([$status, $status === 'rejected' ? $reason : null, $admin['id'], $id]);

$status === 'approved'
    ? notify($id, 'একাউন্ট অনুমোদিত', 'অভিনন্দন! আপনার NID যাচাই সম্পন্ন হয়েছে। এখন কাজ নিতে পারবেন।')
    : notify($id, 'আবেদন বাতিল', 'কারণ: ' . ($reason ?: 'উল্লেখ করা হয়নি'));

out(['ok' => true]);
