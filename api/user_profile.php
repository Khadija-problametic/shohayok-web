<?php
require __DIR__ . '/lib.php';
$u = need_login();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare('SELECT id, name, phone, role, area, blood_group, emergency_contact, medical_notes, address FROM users WHERE id = ?');
    $stmt->execute([$u['id']]);
    $prof = $stmt->fetch(PDO::FETCH_ASSOC);
    out(['profile' => $prof]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = $_POST ?: json_body();
    $name   = trim((string)($in['name'] ?? $u['name']));
    $area   = trim((string)($in['area'] ?? $u['area']));
    $bg     = trim((string)($in['blood_group'] ?? ''));
    $emg    = trim((string)($in['emergency_contact'] ?? ''));
    $notes  = trim((string)($in['medical_notes'] ?? ''));
    $addr   = trim((string)($in['address'] ?? ''));

    if (mb_strlen($name) < 3) fail('নাম কমপক্ষে ৩ অক্ষরের হতে হবে');

    $stmt = db()->prepare('UPDATE users SET name = ?, area = ?, blood_group = ?, emergency_contact = ?, medical_notes = ?, address = ? WHERE id = ?');
    $stmt->execute([$name, $area, $bg, $emg, $notes, $addr, $u['id']]);

    out(['success' => true, 'message' => 'প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে']);
}