<?php
// সংযোগ পরীক্ষা: http://localhost:8080/shohayok/check.php (পোর্ট আপনার Apache অনুযায়ী)
require __DIR__ . '/api/config.php';
header('Content-Type: text/html; charset=utf-8');
$ok = fn($b) => $b ? '<b style="color:#0a8">✔ ঠিক আছে</b>' : '<b style="color:#d33">✘ সমস্যা</b>';
echo '<meta charset="utf-8"><body style="font:17px/1.7 sans-serif;max-width:760px;margin:30px auto;padding:0 16px"><h2>Shohayok সংযোগ পরীক্ষা</h2>';
echo '<h3>১. PHP</h3><p>সংস্করণ ' . PHP_VERSION . ' ' . $ok(version_compare(PHP_VERSION, '8.0', '>=')) . '</p>';
echo '<h3>২. দরকারি এক্সটেনশন</h3><ul>';
foreach (['pdo_mysql', 'mbstring', 'fileinfo'] as $e) echo "<li>$e " . $ok(extension_loaded($e)) . '</li>';
echo '</ul>';
echo '<h3>৩. MySQL সংযোগ</h3><ul>';
$found = null;
foreach (DB_PORTS as $port) {
    try { new PDO("mysql:host=" . DB_HOST . ";port=$port", DB_USER, DB_PASS); echo "<li>পোর্ট $port: " . $ok(true) . ' (MySQL চালু আছে)</li>'; $found ??= $port; }
    catch (PDOException $e) { echo "<li>পোর্ট $port: " . $ok(false) . ' <small>' . htmlspecialchars($e->getMessage()) . '</small></li>'; }
}
echo '</ul>';
echo '<h3>৪. ডাটাবেস ও ডেটা</h3>';
try {
    $pdo = db();
    echo '<p>ডাটাবেস <code>' . DB_NAME . '</code> ' . $ok(true) . '</p><ul>';
    foreach (['users', 'helper_profiles', 'tasks', 'reviews'] as $t) echo "<li>$t: " . $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn() . ' সারি</li>';
    echo '</ul>';
} catch (Throwable $e) {
    echo '<p>' . $ok(false) . ' ' . htmlspecialchars($e->getMessage()) . '</p><p>সমাধান: phpMyAdmin-এ <code>sql/database_v2.sql</code> Import করুন।</p>';
}
echo '<h3>৫. NID ছবির ফোল্ডার</h3><p>' . $ok(is_dir(NID_DIR) && is_writable(NID_DIR)) . ' ' . htmlspecialchars(realpath(NID_DIR) ?: NID_DIR) . '</p>';
echo '<p><a href="index.html">→ সাইটে যান</a></p>';
