<?php
require __DIR__ . '/config.php';
need_post();

function save_nid(string $key, array &$saved): string {
    $f = $_FILES[$key] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) throw new RuntimeException('NID-এর ছবি আপলোড হয়নি');
    if ($f['size'] > 5 * 1024 * 1024) throw new RuntimeException('ছবি ৫ MB-এর বেশি হতে পারবে না');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if (!$ext || !getimagesize($f['tmp_name'])) throw new RuntimeException('শুধু JPG, PNG বা WEBP ছবি দিন');
    if (!is_dir(NID_DIR)) mkdir(NID_DIR, 0750, true);
    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], NID_DIR . $name)) throw new RuntimeException('ছবি সংরক্ষণ করা যায়নি');
    $saved[] = $name;
    return $name;
}

$role  = $_POST['role'] ?? '';
$name  = trim((string)($_POST['name'] ?? ''));
$phone = norm_phone((string)($_POST['phone'] ?? ''));
$area  = trim((string)($_POST['area'] ?? ''));
$pass  = (string)($_POST['password'] ?? '');

if (!in_array($role, ['elderly', 'helper', 'guardian'], true)) fail('ভূমিকা সঠিক নয়');
if (mb_strlen($name) < 3 || mb_strlen($name) > 100) fail('পুরো নাম লিখুন');
if (!preg_match('/^01\d{9}$/', $phone)) fail('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন');
if (!in_array($area, AREAS, true)) fail('এলাকা সঠিক নয়');
if (strlen($pass) < 6) fail('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');

$nid = '';
if ($role === 'helper') {
    $nid = trim((string)($_POST['nid_number'] ?? ''));
    if (!preg_match('/^(\d{10}|\d{13}|\d{17})$/', $nid)) fail('NID নম্বর ১০, ১৩ বা ১৭ সংখ্যার হতে হবে');
}

$pdo = db();
$chk = $pdo->prepare('SELECT 1 FROM users WHERE phone IN (?, ?)');
$chk->execute([$phone, '+88' . $phone]);
if ($chk->fetch()) fail('এই মোবাইল নম্বরে আগেই একাউন্ট আছে', 409);

$saved = [];
try {
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO users (name, phone, password, role, area, is_phone_verified) VALUES (?, ?, ?, ?, ?, 0)')
        ->execute([$name, $phone, password_hash($pass, PASSWORD_DEFAULT), $role, $area]);
    $uid = (int)$pdo->lastInsertId();

    if ($role === 'helper') {
        $front = save_nid('nid_front', $saved);
        $back  = save_nid('nid_back', $saved);
        $pdo->prepare("INSERT INTO helper_profiles (user_id, nid_number, nid_front_path, nid_back_path, verification_status) VALUES (?, ?, ?, ?, 'pending')")
            ->execute([$uid, $nid, $front, $back]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($saved as $f) @unlink(NID_DIR . $f);
    if ($e instanceof RuntimeException) fail($e->getMessage());
    if ($e instanceof PDOException && $e->getCode() === '23000') fail('এই NID নম্বর আগেই ব্যবহার হয়েছে', 409);
    throw $e;
}

session_regenerate_id(true);
$_SESSION['uid'] = $uid;
out(current_user(), 201);
