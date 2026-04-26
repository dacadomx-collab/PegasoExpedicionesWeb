<?php

declare(strict_types=1);

/**
 * GET /api/list_admin_users.php — Lista todos los admins del sistema.
 * Requiere JWT + rol super_admin.
 * NUNCA devuelve password_hash.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 8 (FASE 5)
 */

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    if (!headers_sent()) http_response_code(500);
    @error_log(sprintf("[%s][CRITICAL][list_admin_users.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']), 3, dirname(__DIR__) . '/logs/error.log');
    echo json_encode(['status' => 'error', 'message' => 'Error interno.']);
});

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/auth_middleware.php';

// Solo super_admin puede gestionar usuarios
requireRole(['super_admin'], $adminPayload);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $pdo  = Database::getInstance()->getConnection();
    $stmt = $pdo->query(
        "SELECT id, name, email, role, active, last_login_at, created_at
         FROM admin_users
         ORDER BY created_at ASC"
    );
    $users = $stmt->fetchAll();

    echo json_encode([
        'status'  => 'success',
        'message' => 'Usuarios obtenidos.',
        'data'    => $users,
    ]);

} catch (\Throwable $e) {
    Database::writeLog('list_admin_users.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo obtener la lista de usuarios.']);
}
