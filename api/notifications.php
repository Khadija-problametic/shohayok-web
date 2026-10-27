<?php
require __DIR__ . '/lib.php';
$u   = need_login();
$me  = (int)$u['id'];
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_post();
    $in = json_body();
    if (($in['action'] ?? '') === 'read_all') {
        $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')->execute([$me]);
        out(['ok' => true]);
    }
    fail('অজানা অনুরোধ');
}

$s = $pdo->prepare('SELECT id, title, body, task_id, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30');
$s->execute([$me]);
$items = array_map(fn($r) => [
    'id' => (int)$r['id'], 'title' => $r['title'], 'body' => $r['body'],
    'task_id' => $r['task_id'] !== null ? (int)$r['task_id'] : null,
    'is_read' => (int)$r['is_read'], 'created_at' => date('c', strtotime($r['created_at'])),
], $s->fetchAll());

$c = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
$c->execute([$me]);
out(['items' => $items, 'unread' => (int)$c->fetchColumn()]);
