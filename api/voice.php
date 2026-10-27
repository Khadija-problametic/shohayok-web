<?php
define('RAW', true);
require __DIR__ . '/lib.php';
$u = current_user();
if (!$u) { http_response_code(401); exit; }
$s = db()->prepare('SELECT requester_id, helper_id, area, status, voice_note FROM tasks WHERE id = ?');
$s->execute([(int)($_GET['id'] ?? 0)]);
$t = $s->fetch();
$uid = (int)$u['id'];
// শুনতে পারবেন: অ্যাডমিন, কাজের মালিক, নির্ধারিত সহায়ক, অথবা নিজ এলাকার খালি কাজে অনুমোদিত সহায়ক
$ok = $t && $t['voice_note'] && (
    $u['role'] === 'admin' || $uid === (int)$t['requester_id'] || $uid === (int)$t['helper_id'] ||
    ($u['role'] === 'helper' && $u['status'] === 'approved' && $t['status'] === 'pending' && $t['area'] === $u['area']));
$file = $ok ? realpath(VOICE_DIR . basename($t['voice_note'])) : false;
if (!$file || !str_starts_with($file, realpath(VOICE_DIR))) { http_response_code(404); exit; }
header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($file));
header('Content-Length: ' . filesize($file));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
readfile($file);
