<?php // CLI: C:\xampp\php\php.exe sql\create_admin.php 01700000009 "StrongPass" "Admin Name"
require __DIR__ . '/../api/config.php';
[, $ph, $pw, $nm] = $argv + [null, '', '', 'অ্যাডমিন'];
if (!preg_match('/^01\d{9}$/', $ph) || strlen($pw) < 8) exit("ব্যবহার: php create_admin.php 01XXXXXXXXX পাসওয়ার্ড(৮+) [নাম]\n");
db()->prepare("INSERT INTO users (name,phone,password,role,area,is_phone_verified) VALUES (?,?,?,'admin','ধানমন্ডি',1)")
    ->execute([$nm, $ph, password_hash($pw, PASSWORD_DEFAULT)]);
echo "অ্যাডমিন তৈরি হয়েছে: $ph\n";
