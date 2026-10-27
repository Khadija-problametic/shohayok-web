<?php
require __DIR__ . '/config.php';
need_admin();

$rows = db()->query("SELECT u.id, u.name, u.phone, u.area, u.created_at, h.nid_number,
        h.verification_status AS status, h.rejection_reason AS reason
        FROM helper_profiles h JOIN users u ON u.id = h.user_id
        ORDER BY u.created_at DESC")->fetchAll();

foreach ($rows as &$r) {
    $r['role']      = 'helper';
    $r['created']   = date('c', strtotime($r['created_at']));
    $r['nid_front'] = 'api/nid.php?id=' . $r['id'] . '&side=front';
    $r['nid_back']  = 'api/nid.php?id=' . $r['id'] . '&side=back';
    unset($r['created_at']);
}
out($rows);
