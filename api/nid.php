<?php
define('RAW', true);
require __DIR__ . '/config.php';

$u = current_user();
$id = (int)($_GET['id'] ?? 0);
if (!$u || ($u['role'] !== 'admin' && (int)$u['id'] !== $id)) { http_response_code(403); exit('অনুমতি নেই'); }

$col = ($_GET['side'] ?? '') === 'back' ? 'nid_back_path' : 'nid_front_path';
$s = db()->prepare("SELECT $col AS p FROM helper_profiles WHERE user_id = ?");
$s->execute([$id]);
$row = $s->fetch();

$file = $row ? realpath(NID_DIR . basename($row['p'])) : false;
if (!$file || !str_starts_with($file, realpath(NID_DIR))) { http_response_code(404); exit('ছবি নেই'); }

header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($file));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
readfile($file);
