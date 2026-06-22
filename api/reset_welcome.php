<?php

declare(strict_types=1);

/**
 * POST /api/reset_welcome.php — Resetea fecha_fundacion a NULL.
 *
 * Solo accesible por super_admin. Permite que el partner vea la
 * tarjeta de bienvenida de nuevo (útil para demos y pruebas).
 *
 * Body JSON: { "user_id": number }
 *
 * Contrato de respuesta:
 * {
 *   "status": "success",
 *   "data": { "user_id": number, "partner_name": string }
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

// Solo super_admin puede resetear la bienvenida de cualquier usuario
requireRole(['super_admin'], $adminPayload);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $body   = (string) file_get_contents('php://input');
    $data   = json_decode($body, true);
    $userId = isset($data['user_id']) ? (int) $data['user_id'] : 0;

    if ($userId <= 0) {
        http_response_code(422);
        ob_clean();
        echo json_encode([
            'status'  => 'error',
            'message' => 'Parámetro inválido.',
            'errors'  => ['user_id: Debe ser un entero positivo.'],
        ]);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // Verificar que el usuario existe y es partner
    $check = $pdo->prepare(
        'SELECT id, name, role FROM admin_users WHERE id = :id AND active = 1 LIMIT 1'
    );
    $check->execute([':id' => $userId]);
    $user = $check->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Usuario no encontrado o inactivo.']);
        exit();
    }

    // Resetear fecha_fundacion
    $update = $pdo->prepare(
        'UPDATE admin_users SET fecha_fundacion = NULL WHERE id = :id'
    );
    $update->execute([':id' => $userId]);

    Database::writeLog(
        'reset_welcome.php',
        "super_admin id={$adminPayload['sub']} reseteó fecha_fundacion de user_id={$userId} ({$user['name']})"
    );

    ob_clean();
    echo json_encode([
        'status'  => 'success',
        'message' => "Bienvenida reseteada para {$user['name']}. El próximo acceso mostrará la tarjeta inicial.",
        'data'    => [
            'user_id'      => $userId,
            'partner_name' => $user['name'],
            'partner_role' => $user['role'],
        ],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('reset_welcome.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    ob_clean();
    echo json_encode(['status' => 'error', 'message' => 'No se pudo resetear la bienvenida.']);
}
