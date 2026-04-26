<?php

declare(strict_types=1);

/**
 * GET /api/get_reservas.php
 * Devuelve todas las reservas con JOIN de customers y expeditions.
 * Alimenta el admin-dashboard.tsx.
 *
 * ⚠️ TODO Codex: registrar este endpoint en 03_CONTRATOS_API_Y_LOGICA.md.
 */

require_once 'cors.php';
require_once 'Database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = Database::getInstance()->getConnection();

    $stmt = $pdo->query(
        "SELECT
            b.id,
            b.num_spots,
            b.total_amount,
            b.payment_status,
            b.paypal_order_id,
            b.paypal_transaction_id,
            b.created_at,
            b.departure_date,
            b.departure_time,
            e.name  AS expedition_name,
            c.name  AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone
         FROM bookings b
         INNER JOIN expeditions e ON e.id = b.expedition_id
         INNER JOIN customers   c ON c.id = b.customer_id
         ORDER BY b.created_at DESC"
    );

    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Castear tipos numéricos
    foreach ($bookings as &$row) {
        $row['id']        = (int) $row['id'];
        $row['num_spots'] = (int) $row['num_spots'];
    }
    unset($row);

    echo json_encode([
        'status'  => 'success',
        'message' => 'Reservas obtenidas correctamente.',
        'data'    => $bookings,
    ]);

} catch (\Throwable $e) {
    Database::writeLog('get_reservas.php', $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudieron obtener las reservas.']);
}
