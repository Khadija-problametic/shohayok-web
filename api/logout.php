<?php
require __DIR__ . '/config.php';
need_post();
$_SESSION = [];
session_destroy();
out(['ok' => true]);
