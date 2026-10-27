<?php
// শুধু অ্যাডমিনের লগইন। সাধারণ লগইন (login.php) অ্যাডমিনকে ঢুকতে দেয় না।
require __DIR__ . '/config.php';
need_post();

$f = $_SESSION['afails'] ?? ['n' => 0, 't' => 0];
if ($f['n'] >= 5 && time() - $f['t'] < 900) fail('অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে চেষ্টা করুন', 429);

$in    = json_body();
$phone = norm_phone((string)($in['phone'] ?? ''));
$pass  = (string)($in['password'] ?? '');

$s = db()->prepare("SELECT id, password FROM users WHERE phone IN (?, ?) AND role = 'admin' LIMIT 1");
$s->execute([$phone, '+88' . $phone]);
$u = $s->fetch();

if (!$u || !password_verify($pass, $u['password'])) {
    $_SESSION['afails'] = ['n' => $f['n'] + 1, 't' => time()];
    fail('অ্যাডমিনের তথ্য ঠিক নয়', 401);
}
unset($_SESSION['afails']);
session_regenerate_id(true);
$_SESSION['uid'] = (int)$u['id'];
out(current_user());
