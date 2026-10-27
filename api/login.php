<?php
require __DIR__ . '/config.php';
need_post();

$f = $_SESSION['fails'] ?? ['n' => 0, 't' => 0];
if ($f['n'] >= 5 && time() - $f['t'] < 300) fail('অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন', 429);

$in    = json_body();
$phone = norm_phone((string)($in['phone'] ?? ''));
$pass  = (string)($in['password'] ?? '');

$s = db()->prepare('SELECT id, password, role FROM users WHERE phone IN (?, ?) LIMIT 1');
$s->execute([$phone, '+88' . $phone]);
$u = $s->fetch();

if (!$u || $u['role'] === 'admin' || !password_verify($pass, $u['password'])) {   // অ্যাডমিন শুধু admin.html দিয়ে ঢুকবে
    $_SESSION['fails'] = ['n' => $f['n'] + 1, 't' => time()];
    fail('মোবাইল নম্বর বা পাসওয়ার্ড ভুল', 401);
}
unset($_SESSION['fails']);
session_regenerate_id(true);
$_SESSION['uid'] = (int)$u['id'];
out(current_user());
