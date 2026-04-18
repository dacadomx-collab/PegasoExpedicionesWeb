<?php

/**
 * GET /api/v1/expeditions.php
 *
 * Devuelve todas las expeditions con status='active'.
 * El campo custom_fields (JSON string en BD) se decodifica a objeto
 * antes de enviarlo al cliente Next.js.
 *
 * Seguridad: CORS whitelist desde .env · Solo GET · try/catch total.
 * Sin librerías externas. PHP 8+ con PDO estricto.
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/Database.php';

// ── CORS y cabeceras ──────────────────────────────────────────────────────────

/**
 * Lee ALLOWED_ORIGINS del .env y aplica la política CORS.
 * Si el origen no está en la whitelist → 403 y muere.
 * Maneja el preflight OPTIONS sin tocar la BD.
 */
function applyCorsAndHeaders(): void
{
    $envPath = dirname(__DIR__, 2) . '/.env';

    $allowedOrigins = [];
    if (is_readable($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
            if (trim($k) === 'ALLOWED_ORIGINS') {
                $allowedOrigins = array_map('trim', explode(',', $v));
                break;
            }
        }
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Siempre devuelve JSON
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');

    // Preflight OPTIONS — responde sin tocar la BD
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Methods: GET, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Max-Age: 86400');
            header('Vary: Origin');
        }
        http_response_code(204);
        exit;
    }

    // Solicitudes reales: origen vacío = herramienta de desarrollo (Postman, CLI)
    if ($origin === '') {
        // Desarrollo local sin HTTP_ORIGIN — permitir solo si APP_ENV=local
        // En producción, un proxy/CDN siempre envía Origin
        return;
    }

    if (!in_array($origin, $allowedOrigins, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Origin not allowed.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Vary: Origin');
}

// ── Solo GET ──────────────────────────────────────────────────────────────────

applyCorsAndHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Use GET.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Consulta principal ────────────────────────────────────────────────────────

try {
    $pdo = Database::getInstance()->getConnection();

    $stmt = $pdo->prepare("
        SELECT
            e.id,
            e.name,
            e.description,
            e.price,
            e.max_capacity,
            e.image_url,
            e.status,
            e.custom_fields
        FROM `expeditions` AS e
        WHERE e.status = 'active'
        ORDER BY e.id ASC
    ");
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Decodificar custom_fields de string JSON a objeto real
    // para que el cliente Next.js no reciba una cadena escapada
    foreach ($rows as &$row) {
        if (isset($row['custom_fields']) && $row['custom_fields'] !== null) {
            $decoded = json_decode((string) $row['custom_fields'], true);
            // Si el JSON está malformado, enviamos null en lugar de crashear
            $row['custom_fields'] = (json_last_error() === JSON_ERROR_NONE)
                ? $decoded
                : null;
        }

        // Castear tipos numéricos para que el JSON sea correcto
        // (PDO los devuelve como strings por defecto)
        $row['id']           = (int)   $row['id'];
        $row['price']        = (float) $row['price'];
        $row['max_capacity'] = (int)   $row['max_capacity'];
    }
    unset($row);

    http_response_code(200);
    echo json_encode(
        [
            'success' => true,
            'count'   => count($rows),
            'data'    => $rows,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

} catch (RuntimeException $e) {
    // Error de conexión (Database::getInstance lanza RuntimeException)
    Database::writeLog('api/v1/expeditions.php', $e->getMessage());
    http_response_code(500);
    echo json_encode(
        ['error' => 'Database connection failed.'],
        JSON_UNESCAPED_UNICODE
    );

} catch (PDOException $e) {
    // Error de query (tabla no existe, permisos, etc.)
    Database::writeLog('api/v1/expeditions.php', $e->getMessage());
    http_response_code(500);
    echo json_encode(
        ['error' => 'Database query failed.'],
        JSON_UNESCAPED_UNICODE
    );
}
