<?php

declare(strict_types=1);

/**
 * GET /api/get_settings.php — Todas las configuraciones del sistema (admin).
 * Requiere JWT válido en Authorization: Bearer <token>.
 * Devuelve TODAS las claves de system_settings incluyendo metadatos.
 * El valor de paypal_client_secret se enmascara parcialmente.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 6 (FASE 4 - 2026-04-24)
 */

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
    }
    @error_log(
        sprintf("[%s][CRITICAL][get_settings.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']),
        3,
        dirname(__DIR__) . '/logs/error.log'
    );
    echo json_encode(['status' => 'error', 'message' => 'Error interno.']);
});

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/auth_middleware.php';

// Solo super_admin puede ver la configuración completa (con sensibles)
requireRole(['super_admin'], $adminPayload);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $pdo  = Database::getInstance()->getConnection();
    // Columnas reales: setting_key, setting_value, is_secret.
    // Se devuelven con alias key/value/is_sensitive para mantener el contrato JSON con el frontend.
    $stmt = $pdo->query(
        "SELECT setting_key AS `key`, setting_value AS `value`, description,
                is_secret AS is_sensitive, updated_at
         FROM system_settings ORDER BY setting_key"
    );
    $rows = $stmt->fetchAll();

    // Enmascarar valores sensibles (is_secret = 1)
    $settings = array_map(static function (array $row): array {
        if ((int) ($row['is_sensitive'] ?? 0) === 1 && $row['value'] !== '') {
            $visible      = min(4, (int) (strlen($row['value']) / 4));
            $row['value'] = str_repeat('•', 8) . substr($row['value'], -$visible);
        }
        return $row;
    }, $rows);

    echo json_encode([
        'status'  => 'success',
        'message' => 'Configuración obtenida.',
        'data'    => $settings,
    ]);

} catch (\Throwable $e) {
    Database::writeLog('get_settings.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo obtener la configuración.']);
}
