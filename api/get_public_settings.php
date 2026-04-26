<?php

declare(strict_types=1);

/**
 * GET /api/get_public_settings.php — Configuración pública del sistema.
 * NO requiere autenticación (es consumida por el booking widget público).
 * Solo devuelve claves seguras: paypal_client_id, paypal_mode, whatsapp_phone, sales_paused.
 * NUNCA devuelve paypal_client_secret ni datos sensibles.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 5 (FASE 4 - 2026-04-24)
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
        sprintf("[%s][CRITICAL][get_public_settings.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']),
        3,
        dirname(__DIR__) . '/logs/error.log'
    );
    echo json_encode(['status' => 'error', 'message' => 'Error interno.']);
});

require_once __DIR__ . '/Database.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // Leer todas las claves necesarias para resolver el entorno activo
    $fetchKeys    = [
        'paypal_mode',
        'paypal_client_id_sandbox', 'paypal_client_id_live',  // nuevas claves granulares
        'paypal_client_id',                                     // clave legacy (fallback)
        'whatsapp_contact', 'whatsapp_phone',                   // nueva y legacy
        'sales_paused',
        'urgent_booking_msg',
    ];
    $placeholders = implode(',', array_fill(0, count($fetchKeys), '?'));
    $stmt = $pdo->prepare(
        "SELECT setting_key AS `key`, setting_value AS `value`
         FROM system_settings WHERE setting_key IN ({$placeholders})"
    );
    $stmt->execute($fetchKeys);

    $raw = [];
    foreach ($stmt->fetchAll() as $row) {
        $raw[$row['key']] = (string) $row['value'];
    }

    // ── Resolver modo PayPal ──────────────────────────────────
    $mode = $raw['paypal_mode'] ?? 'sandbox';
    if (!in_array($mode, ['sandbox', 'live'], true)) {
        $mode = 'sandbox';
    }

    // ── Resolver Client ID público según modo activo ─────────
    // Prioridad: clave granular nueva → clave legacy
    $clientIdKey = "paypal_client_id_{$mode}";
    $clientId    = (isset($raw[$clientIdKey]) && $raw[$clientIdKey] !== '')
        ? $raw[$clientIdKey]
        : ($raw['paypal_client_id'] ?? '');

    // ── Resolver WhatsApp (nueva clave primero, legacy como fallback) ─
    $whatsapp = (isset($raw['whatsapp_contact']) && $raw['whatsapp_contact'] !== '')
        ? $raw['whatsapp_contact']
        : ($raw['whatsapp_phone'] ?? '');

    // ── Respuesta pública (NUNCA exponer secrets) ─────────────
    $settings = [
        'paypal_client_id'  => $clientId,
        'paypal_mode'       => $mode,
        'whatsapp_phone'    => $whatsapp,        // clave que espera el widget
        'sales_paused'      => $raw['sales_paused']     ?? 'false',
        'urgent_booking_msg'=> $raw['urgent_booking_msg'] ?? '',
    ];

    echo json_encode([
        'status'  => 'success',
        'message' => 'Configuración pública obtenida.',
        'data'    => $settings,
    ]);

} catch (\Throwable $e) {
    Database::writeLog('get_public_settings.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo obtener la configuración.']);
}
