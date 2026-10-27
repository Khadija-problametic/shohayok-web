<?php
// সহায়কের প্রোফাইল: যেকোনো লগইন করা ব্যবহারকারী অনুমোদিত সহায়কের প্রোফাইল দেখতে পারেন।
// সম্পাদনা শুধু সহায়ক নিজে। ফোন নম্বর দেখতে পান শুধু সহায়ক নিজে ও অ্যাডমিন।
if (isset($_GET['photo'])) define('RAW', true);
require __DIR__ . '/lib.php';
const PHOTO_DIR = __DIR__ . '/../storage/photo/';

$u   = need_login();
$pdo = db();

/* ---------- ছবি দেখানো ---------- */
if (isset($_GET['photo'])) {
    $s = $pdo->prepare('SELECT photo_path FROM helper_profiles WHERE user_id = ?');
    $s->execute([(int)($_GET['id'] ?? 0)]);
    $p = $s->fetchColumn();
    $file = $p ? realpath(PHOTO_DIR . basename($p)) : false;
    if (!$file || !str_starts_with($file, realpath(PHOTO_DIR))) { http_response_code(404); exit; }
    header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($file));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=3600');
    readfile($file);
    exit;
}

/* কলাম আছে কিনা চেক করে নেওয়া (যাতে কোনো এরর না আসে) */
$hasFbCol = false;
$hasEmailCol = false;
try {
    $cols = $pdo->query("SHOW COLUMNS FROM helper_profiles")->fetchAll(PDO::FETCH_COLUMN);
    $hasFbCol = in_array('fb_url', $cols, true);
    $hasEmailCol = in_array('contact_email', $cols, true);
} catch (Throwable $e) {}

/* ---------- সম্পাদনা ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_post();
    if ($u['role'] !== 'helper') fail('শুধু সহায়ক নিজের প্রোফাইল বদলাতে পারবেন', 403);
    $bio   = mb_substr(trim((string)($_POST['bio'] ?? '')), 0, 500);
    $skill = mb_substr(trim((string)($_POST['skills'] ?? '')), 0, 200);
    $exp   = mb_substr(trim((string)($_POST['experience'] ?? '')), 0, 60);
    $fb    = mb_substr(trim((string)($_POST['fb_url'] ?? '')), 0, 255);
    $email = mb_substr(trim((string)($_POST['contact_email'] ?? '')), 0, 150);

    if ($fb !== '' && !filter_var($fb, FILTER_VALIDATE_URL)) fail('সঠিক ফেসবুক প্রোফাইল লিংক দিন');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('সঠিক ইমেইল ঠিকানা দিন');

    $photo = null;
    $f = $_FILES['photo'] ?? null;
    if ($f && $f['error'] !== UPLOAD_ERR_NO_FILE) {
        if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('ছবি আপলোড হয়নি');
        if ($f['size'] > 2 * 1024 * 1024) fail('ছবি ২ MB-এর বেশি হতে পারবে না');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if (!$ext || !getimagesize($f['tmp_name'])) fail('শুধু JPG, PNG বা WEBP ছবি দিন');
        if (!is_dir(PHOTO_DIR)) mkdir(PHOTO_DIR, 0750, true);
        $photo = bin2hex(random_bytes(12)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], PHOTO_DIR . $photo)) fail('ছবি সংরক্ষণ করা যায়নি');
    }
    $old = $pdo->prepare('SELECT photo_path FROM helper_profiles WHERE user_id = ?');
    $old->execute([$u['id']]);
    $oldPhoto = $old->fetchColumn();

    $setParts = ['bio = ?', 'skills = ?', 'experience = ?', 'photo_path = COALESCE(?, photo_path)'];
    $params = [$bio ?: null, $skill ?: null, $exp ?: null, $photo];

    if ($hasFbCol) {
        $setParts[] = 'fb_url = ?';
        $params[] = $fb ?: null;
    }
    if ($hasEmailCol) {
        $setParts[] = 'contact_email = ?';
        $params[] = $email ?: null;
    }
    $params[] = $u['id'];

    $pdo->prepare('UPDATE helper_profiles SET ' . implode(', ', $setParts) . ' WHERE user_id = ?')->execute($params);
    if ($photo && $oldPhoto) @unlink(PHOTO_DIR . basename($oldPhoto));
    out(['ok' => true]);
}

/* ---------- প্রোফাইল দেখা ---------- */
$id = (int)($_GET['id'] ?? ($u['role'] === 'helper' ? $u['id'] : 0));

$extraSelect = '';
if ($hasFbCol) $extraSelect .= ', h.fb_url';
if ($hasEmailCol) $extraSelect .= ', h.contact_email';

$s = $pdo->prepare("SELECT u.id, u.name, u.phone, u.area, u.created_at, h.verification_status, h.bio, h.skills, h.experience,
        h.photo_path, h.total_tasks_completed, h.updated_at {$extraSelect}
    FROM users u JOIN helper_profiles h ON h.user_id = u.id WHERE u.id = ?");
$s->execute([$id]);
$p = $s->fetch();
$self = $id === (int)$u['id'];
$admin = $u['role'] === 'admin';
if (!$p || ($p['verification_status'] !== 'approved' && !$self && !$admin)) fail('সহায়কের প্রোফাইল পাওয়া যায়নি', 404);

$d = $pdo->prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE reviewee_id = ? GROUP BY rating');
$d->execute([$id]);
$dist = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
foreach ($d->fetchAll() as $r) $dist[(int)$r['rating']] = (int)$r['n'];
$count = array_sum($dist);
$avg = $count ? round(array_sum(array_map(fn($k, $v) => $k * $v, array_keys($dist), $dist)) / $count, 1) : null;

$rv = $pdo->prepare('SELECT v.rating, v.comment, v.created_at, u.name FROM reviews v JOIN users u ON u.id = v.reviewer_id
    WHERE v.reviewee_id = ? ORDER BY v.id DESC LIMIT 10');
$rv->execute([$id]);
$reviews = array_map(fn($r) => [
    'rating' => (int)$r['rating'], 'comment' => $r['comment'],
    'name' => explode(' ', trim($r['name']))[0],
    'date' => date('c', strtotime($r['created_at'])),
], $rv->fetchAll());

out([
    'profile' => [
        'id' => (int)$p['id'], 'name' => $p['name'], 'area' => $p['area'],
        'phone' => ($self || $admin) ? $p['phone'] : null,
        'joined' => date('c', strtotime($p['created_at'])),
        'bio' => $p['bio'], 'skills' => $p['skills'], 'experience' => $p['experience'],
        'fb_url' => $p['fb_url'] ?? null,
        'contact_email' => $p['contact_email'] ?? null,
        'has_photo' => !empty($p['photo_path']), 'photo_v' => strtotime($p['updated_at']),
        'completed' => (int)$p['total_tasks_completed'], 'rating' => $avg, 'review_count' => $count,
        'verified' => $p['verification_status'] === 'approved', 'is_self' => $self,
    ],
    'dist' => $dist, 'reviews' => $reviews,
]);