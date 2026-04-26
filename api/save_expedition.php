<?php

declare(strict_types=1);

/**
 * POST /api/save_expedition.php — Crea o actualiza una expedición.
 * Requiere JWT + rol super_admin.
 *
 * Body: { id?, name, description, price, daily_capacity, image_url, status, custom_fields: [{key,value}] }
 * Si `id` está presente → UPDATE. Si no → INSERT.
 */

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    if (!headers_sent()) http_response_code(500);
    @error_log(sprintf("[%s][CRITICAL][save_expedition.php] %s in %s:%d\n",
        date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']),
        3, dirname(__DIR__) . '/logs/error.log');
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
    if (!is_array($body)) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Cuerpo JSON inválido.']);
        exit();
    }

    // ── Extraer campos ────────────────────────────────────────
    $id            = isset($body['id']) && $body['id'] !== null && $body['id'] !== '' ? (int) $body['id'] : null;
    $name          = trim((string) ($body['name']          ?? ''));
    $description   = trim((string) ($body['description']   ?? ''));
    $price         = trim((string) ($body['price']         ?? ''));
    $dailyCapacity = (int) ($body['daily_capacity']        ?? 0);
    $imageUrl      = trim((string) ($body['image_url']     ?? ''));
    $status        = trim((string) ($body['status']        ?? 'active'));
    $rawFields     = is_array($body['custom_fields'] ?? null) ? $body['custom_fields'] : [];

    // ── Validación ────────────────────────────────────────────
    $errors = [];

    if (mb_strlen($name) < 2) {
        $errors[] = 'name: Mínimo 2 caracteres.';
    }
    if (!is_numeric($price) || (float) $price <= 0.0) {
        $errors[] = 'price: Debe ser un número positivo (ej. 950.00).';
    }
    if ($dailyCapacity < 1) {
        $errors[] = 'daily_capacity: Mínimo 1 lugar por día.';
    }
    if (!in_array($status, ['active', 'inactive'], true)) {
        $errors[] = 'status: Debe ser "active" o "inactive".';
    }
    if ($imageUrl !== '' && filter_var($imageUrl, FILTER_VALIDATE_URL) === false) {
        $errors[] = 'image_url: URL no válida. Deja vacío si no tienes una.';
    }
    if ($id !== null && $id <= 0) {
        $errors[] = 'id: Debe ser un entero positivo.';
    }

    if ($errors !== []) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Datos inválidos.', 'errors' => $errors]);
        exit();
    }

    // ── Construir JSON de custom_fields ───────────────────────
    // El frontend envía [{key, value}]. Convertimos a {key: value} para BD.
    $customMap = [];
    foreach ($rawFields as $entry) {
        if (!is_array($entry)) continue;
        $k = trim((string) ($entry['key']   ?? ''));
        $v = trim((string) ($entry['value'] ?? ''));
        if ($k === '') continue;
        $customMap[$k] = $v;
    }
    $customFieldsJson = $customMap !== []
        ? json_encode($customMap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        : null;

    $pdo = Database::getInstance()->getConnection();

    if ($id !== null) {
        // ── UPDATE ────────────────────────────────────────────
        $check = $pdo->prepare("SELECT id FROM expeditions WHERE id = ?");
        $check->execute([$id]);
        if ($check->fetch() === false) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => "Expedición #{$id} no encontrada."]);
            exit();
        }

        $pdo->prepare(
            "UPDATE expeditions
             SET name=?, description=?, price=?, daily_capacity=?, image_url=?, status=?, custom_fields=?
             WHERE id=?"
        )->execute([
            $name,
            $description !== '' ? $description : null,
            $price,
            $dailyCapacity,
            $imageUrl !== '' ? $imageUrl : null,
            $status,
            $customFieldsJson,
            $id,
        ]);

    } else {
        // ── INSERT ────────────────────────────────────────────
        $pdo->prepare(
            "INSERT INTO expeditions (name, description, price, daily_capacity, image_url, status, custom_fields)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $name,
            $description !== '' ? $description : null,
            $price,
            $dailyCapacity,
            $imageUrl !== '' ? $imageUrl : null,
            $status,
            $customFieldsJson,
        ]);
        $id = (int) $pdo->lastInsertId();
    }

    // ── Devolver la expedición guardada completa ──────────────
    $stmt = $pdo->prepare(
        "SELECT id, name, description, price, daily_capacity, image_url, status, custom_fields
         FROM expeditions WHERE id = ?"
    );
    $stmt->execute([$id]);
    $saved = $stmt->fetch(\PDO::FETCH_ASSOC);

    if ($saved !== false) {
        if ($saved['custom_fields'] !== null) {
            $saved['custom_fields'] = json_decode((string) $saved['custom_fields'], true) ?? null;
        }
        // Campo virtual — recargado desde get_expediciones.php post-save via retry()
        $saved['blocked_dates'] = [];
    }

    echo json_encode([
        'status'  => 'success',
        'message' => 'Expedición guardada correctamente.',
        'data'    => $saved !== false ? $saved : null,
    ]);

} catch (\Throwable $e) {
    Database::writeLog('save_expedition.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo guardar la expedición.']);
}
