<?php

declare(strict_types=1);

/**
 * POST /api/set_welcome_seen.php — Registra la fecha de fundación histórica.
 *
 * Solo actúa si fecha_fundacion es NULL; no sobreescribe si ya existe.
 * Esto garantiza que el timestamp corresponde al PRIMER acceso real.
 *
 * Contrato de respuesta:
 * {
 *   "status": "success",
 *   "data": {
 *     "fecha_fundacion": "YYYY-MM-DD HH:MM:SS",
 *     "already_set": bool
 *   }
 * }
 */

ob_start();

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    ob_clean();
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error interno del servidor.']);
});

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/auth_middleware.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $userId = (int) ($adminPayload['sub'] ?? 0);
    if ($userId === 0) {
        http_response_code(401);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Token inválido.']);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // Leer estado actual
    $select = $pdo->prepare('SELECT fecha_fundacion FROM admin_users WHERE id = :id AND active = 1 LIMIT 1');
    $select->execute([':id' => $userId]);
    $current = $select->fetchColumn();

    if ($current !== false && !is_null($current)) {
        // Ya fue registrado — idempotente, devolver el valor existente
        ob_clean();
        echo json_encode([
            'status'  => 'success',
            'message' => 'Fecha de fundación ya registrada.',
            'data'    => [
                'fecha_fundacion' => $current,
                'already_set'     => true,
            ],
        ]);
        exit();
    }

    // Registrar el timestamp actual como fecha de fundación histórica
    $now = date('Y-m-d H:i:s');
    $update = $pdo->prepare(
        'UPDATE admin_users
         SET fecha_fundacion = :ts
         WHERE id = :id AND fecha_fundacion IS NULL'
    );
    $update->execute([':ts' => $now, ':id' => $userId]);

    ob_clean();
    echo json_encode([
        'status'  => 'success',
        'message' => 'Fecha de fundación registrada.',
        'data'    => [
            'fecha_fundacion' => $now,
            'already_set'     => false,
        ],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('set_welcome_seen.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    ob_clean();
    echo json_encode(['status' => 'error', 'message' => 'No se pudo registrar la fecha de fundación.']);
}
