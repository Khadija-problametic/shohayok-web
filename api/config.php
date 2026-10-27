<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1', DB_NAME = 'shohayok_v2', DB_USER = 'root', DB_PASS = '';
const DB_PORTS = [3306, 3307];
const DEBUG = false; // Production security: Database trace browser-e leak bondho kora holo[cite: 12]
const PLATFORM_COMMISSION_RATE = 0.10; // 10% platform commission
const NID_DIR   = __DIR__ . '/../storage/nid/';
const VOICE_DIR = __DIR__ . '/../storage/voice/';
const DEMO_PAYMENTS = true;
const AREAS = ['ধানমন্ডি', 'মিরপুর', 'উত্তরা', 'গুলশান', 'বনানী', 'মোহাম্মদপুর'];

if (PHP_SAPI !== 'cli') {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'path' => '/']);
    session_start();
    if (!defined('RAW')) header('Content-Type: application/json; charset=utf-8');
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $last = null;
    foreach (DB_PORTS as $port) {
        try {
            return $pdo = new PDO('mysql:host=' . DB_HOST . ';port=' . $port . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
        } catch (PDOException $e) { $last = $e; }
    }
    throw $last;
}

function out($data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }

set_exception_handler(function (Throwable $e) {
    error_log((string)$e);
    fail(DEBUG ? 'সার্ভারে সমস্যা হয়েছে। চেক করতে check.php খুলুন। [' . $e->getMessage() . ']' : 'সার্ভারে সাময়িক সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।', 500); //[cite: 12]
});

function need_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST অনুরোধ দরকার', 405);
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') fail('অনুমোদিত অনুরোধ নয়', 403);
}

function json_body(): array { return json_decode(file_get_contents('php://input') ?: '[]', true) ?: []; }

function norm_phone(string $p): string {
    $d = preg_replace('/\D/', '', $p);
    if (str_starts_with($d, '880')) $d = substr($d, 2);
    return str_starts_with($d, '0') ? $d : '0' . $d;
}

function current_user(): ?array {
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return null;
    $s = db()->prepare("SELECT u.id, u.name, u.phone, u.role, u.area,
        IF(u.role='helper', COALESCE(h.verification_status,'pending'), 'approved') AS status,
        h.rejection_reason AS reason
        FROM users u LEFT JOIN helper_profiles h ON h.user_id = u.id WHERE u.id = ?");
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

function need_admin(): array {
    $u = current_user();
    if (!$u) fail('সেশন শেষ। আবার লগইন করুন', 401);
    if ($u['role'] !== 'admin') fail('শুধু অ্যাডমিন এটি করতে পারবেন', 403);
    return $u;
}