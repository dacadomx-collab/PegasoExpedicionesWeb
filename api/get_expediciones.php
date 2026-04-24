<?php

declare(strict_types=1);

/**
 * GET /api/get_expediciones.php
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 1 (actualizado 2026-04-23)
 *
 * Devuelve expediciones activas con daily_capacity y blocked_dates[].
 * Ya NO consulta expedition_dates (tabla deprecada — Disponibilidad Dinámica).
 */

require_once 'cors.php';      // CORS + OPTIONS preflight
require_once 'Database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $db = Database::getInstance()->getConnection();

    // 1. Expediciones activas con daily_capacity
    $stmt = $db->prepare("
        SELECT id, name, description, price, daily_capacity, image_url, status, custom_fields
        FROM expeditions
        WHERE status = 'active'
        ORDER BY name ASC
    ");
    $stmt->execute();
    $expeditions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Para cada expedición, adjuntar sus blocked_dates
    $stmtBlocked = $db->prepare("
        SELECT blocked_date AS `date`, reason
        FROM blocked_dates
        WHERE expedition_id = ?
        ORDER BY blocked_date ASC
    ");

    foreach ($expeditions as &$exp) {
        // Castear tipos para que el JSON sea correcto
        $exp['id']             = (int) $exp['id'];
        $exp['daily_capacity'] = (int) $exp['daily_capacity'];

        // custom_fields: decodificar JSON o dejar null
        $exp['custom_fields'] = isset($exp['custom_fields'])
            ? json_decode($exp['custom_fields'], true)
            : null;

        // blocked_dates: array de { date, reason }
        $stmtBlocked->execute([$exp['id']]);
        $exp['blocked_dates'] = $stmtBlocked->fetchAll(PDO::FETCH_ASSOC);
    }
    unset($exp); // romper referencia del foreach

    echo json_encode([
        'status'  => 'success',
        'message' => 'Expediciones obtenidas correctamente.',
        'data'    => $expeditions,
    ]);

} catch (Throwable $e) {
    Database::writeLog('get_expediciones.php', $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'No se pudo obtener el catálogo. Intenta de nuevo.',
    ]);
}
