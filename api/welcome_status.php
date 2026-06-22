<?php

declare(strict_types=1);

/**
 * GET /api/welcome_status.php — Estado de bienvenida del partner.
 *
 * Devuelve si el usuario autenticado ya vio la tarjeta de bienvenida
 * histórica (fecha_fundacion != NULL) o si debe mostrarla (NULL).
 *
 * Contrato de respuesta:
 * {
 *   "status": "success",
 *   "data": {
 *     "has_seen_welcome": bool,
 *     "fecha_fundacion": "YYYY-MM-DD HH:MM:SS" | null,
 *     "partner_name": string,
 *     "role": string
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

// Cualquier usuario autenticado puede consultar su propio estado
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $userId = (int) ($adminPayload['sub'] ?? 0);
    if ($userId === 0) {
        http_response_code(401);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Token inválido: sub ausente.']);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    $stmt = $pdo->prepare(
        'SELECT id, name, email, role, fecha_fundacion
         FROM admin_users
         WHERE id = :id AND active = 1
         LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Usuario no encontrado o inactivo.']);
        exit();
    }

    ob_clean();
    echo json_encode([
        'status'  => 'success',
        'message' => 'Estado de bienvenida obtenido.',
        'data'    => [
            'has_seen_welcome' => !is_null($user['fecha_fundacion']),
            'fecha_fundacion'  => $user['fecha_fundacion'],
            'partner_name'     => $user['name'],
            'role'             => $user['role'],
        ],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('welcome_status.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    ob_clean();
    echo json_encode(['status' => 'error', 'message' => 'No se pudo obtener el estado de bienvenida.']);
}
