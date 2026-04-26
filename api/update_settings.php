<?php

declare(strict_types=1);

/**
 * POST /api/update_settings.php — Actualiza una variable de system_settings.
 * Requiere JWT válido. Escribe log en system_settings_audit.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 7 (FASE 4 - 2026-04-24)
 *
 * Payload: { "key": "whatsapp_phone", "value": "521XXXXXXXXXX" }
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
        sprintf("[%s][CRITICAL][update_settings.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']),
        3,
        dirname(__DIR__) . '/logs/error.log'
    );
    echo json_encode(['status' => 'error', 'message' => 'Error interno.']);
});

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/auth_middleware.php';

// Solo super_admin puede modificar la configuración del sistema
requireRole(['super_admin'], $adminPayload);

/** @var PDO|null $pdo */
$pdo = null;

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $raw  = (string) file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Cuerpo de la petición inválido.']);
        exit();
    }

    $key   = trim((string) ($body['key']   ?? ''));
    $value = trim((string) ($body['value'] ?? ''));

    $errors = [];
    if ($key === '') {
        $errors[] = 'key: Requerido.';
    }
    // 'value' puede ser string vacío en algunos casos (desactivar un ajuste)

    if ($errors !== []) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Datos inválidos.', 'errors' => $errors]);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // Verificar que la clave existe (no crear claves arbitrarias)
    $stmtFind = $pdo->prepare(
        "SELECT setting_key AS `key`, setting_value AS `value`
         FROM system_settings WHERE setting_key = ?"
    );
    $stmtFind->execute([$key]);
    $current = $stmtFind->fetch();

    if ($current === false) {
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Clave de configuración no reconocida.',
            'errors'  => ["key: '{$key}' no existe en system_settings."],
        ]);
        exit();
    }

    $oldValue = (string) $current['value'];
    $adminId  = (int) ($adminPayload['sub'] ?? 0);

    $pdo->beginTransaction();

    // Actualizar valor
    $pdo->prepare(
        "UPDATE system_settings SET setting_value = ?, updated_at = NOW(), updated_by = ?
         WHERE setting_key = ?"
    )->execute([$value, $adminId, $key]);

    // Insertar en auditoría (columna setting_key en la tabla audit)
    $pdo->prepare(
        "INSERT INTO system_settings_audit (setting_key, old_value, new_value, changed_by, changed_at)
         VALUES (?, ?, ?, ?, NOW())"
    )->execute([$key, $oldValue, $value, $adminId]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => "Configuración '{$key}' actualizada correctamente.",
        'data'    => ['key' => $key],
    ]);

} catch (\Throwable $e) {
    if ($pdo instanceof PDO) {
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $rb) {
            Database::writeLog('update_settings.php', '[RollbackError] ' . $rb->getMessage());
        }
    }
    Database::writeLog('update_settings.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo actualizar la configuración.']);
}
