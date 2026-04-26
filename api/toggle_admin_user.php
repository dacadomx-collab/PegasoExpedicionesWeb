<?php

declare(strict_types=1);

/**
 * POST /api/toggle_admin_user.php — Activa o desactiva un usuario admin.
 * Requiere JWT + rol super_admin.
 * Seguridad: no permite que un super_admin se desactive a sí mismo.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 10 (FASE 5)
 */

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    if (!headers_sent()) http_response_code(500);
    @error_log(sprintf("[%s][CRITICAL][toggle_admin_user.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']), 3, dirname(__DIR__) . '/logs/error.log');
    echo json_encode(['status' => 'error', 'message' => 'Error interno.']);
});

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/auth_middleware.php';

requireRole(['super_admin'], $adminPayload);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $body = json_decode((string) file_get_contents('php://input'), true);

    $targetId = filter_var($body['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($targetId === false || $targetId === null) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'user_id inválido.']);
        exit();
    }
    $targetId = (int) $targetId;

    // Prevenir auto-desactivación
    if ($targetId === (int) ($adminPayload['sub'] ?? 0)) {
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'No puedes desactivar tu propia cuenta.',
        ]);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    $stmtUser = $pdo->prepare("SELECT id, name, active FROM admin_users WHERE id = ?");
    $stmtUser->execute([$targetId]);
    $user = $stmtUser->fetch();

    if ($user === false) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Usuario no encontrado.']);
        exit();
    }

    $newActive = (int) $user['active'] === 1 ? 0 : 1;

    $pdo->prepare("UPDATE admin_users SET active = ? WHERE id = ?")
        ->execute([$newActive, $targetId]);

    $action = $newActive === 1 ? 'activado' : 'desactivado';

    echo json_encode([
        'status'  => 'success',
        'message' => "Usuario '{$user['name']}' {$action} correctamente.",
        'data'    => ['id' => $targetId, 'active' => $newActive],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('toggle_admin_user.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo actualizar el usuario.']);
}
