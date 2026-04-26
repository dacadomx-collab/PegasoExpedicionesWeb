<?php

declare(strict_types=1);

/**
 * POST /api/crear_orden_paypal.php — Fase 1 del flujo de pago.
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 2 (2026-04-23)
 *
 * ARQUITECTURA DE RESILIENCIA (Pilar 05):
 *   - Cabeceras CORS emitidas en la línea 1 del output, antes de cualquier
 *     require_once o lógica que pueda fallar. El navegador SIEMPRE recibe CORS.
 *   - register_shutdown_function() atrapa Fatal Errors (E_ERROR, E_PARSE, etc.)
 *     que escapan al try/catch normal y garantiza una respuesta JSON.
 *   - Un único try/catch(\Throwable) envuelve TODA la lógica, incluido rollBack().
 *   - Nunca se permite que el script muera sin haber emitido un JSON válido.
 */

// ═══════════════════════════════════════════════════════════════
// BLOQUE 1 — CABECERAS CORS (primer output del script)
// Deben estar ANTES de cualquier require_once para que, si algo
// crashea después, el navegador ya tenga los headers CORS y no
// malinterprete el error 500 de Apache como un problema de CORS.
// ═══════════════════════════════════════════════════════════════

$_corsAllowed = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . (in_array($_origin, $_corsAllowed, true) ? $_origin : $_corsAllowed[0]));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
// Cache-Control: apiFetch usa cache:"no-store" → Chrome lo pone en el preflight.
// Sin este header el preflight falla y el browser reporta CORS aunque el backend esté bien.
header('Access-Control-Allow-Headers: Content-Type, Accept, Cache-Control');
header('Content-Type: application/json; charset=utf-8');
header('Vary: Origin');
unset($_corsAllowed, $_origin);

// OPTIONS preflight — responder 200 inmediatamente, sin DB ni lógica
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ═══════════════════════════════════════════════════════════════
// BLOQUE 2 — SHUTDOWN HANDLER (red de seguridad para Fatal Errors)
// Captura E_ERROR, E_PARSE y similares que no son Throwable y que
// normalmente dejan al script muerto sin emitir nada útil.
// ═══════════════════════════════════════════════════════════════

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null) {
        return;
    }
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) {
        return; // No es fatal — el script terminó normalmente
    }

    // En este punto sabemos que fue un crash fatal.
    // Las cabeceras CORS ya fueron emitidas en el Bloque 1.
    if (!headers_sent()) {
        http_response_code(500);
    }

    $logLine = sprintf(
        "[%s][CRITICAL][crear_orden_paypal.php] [FatalError] %s in %s:%d\n",
        date('Y-m-d H:i:s'),
        $err['message'],
        $err['file'],
        (int) $err['line']
    );
    @error_log($logLine, 3, dirname(__DIR__) . '/logs/error.log');

    echo json_encode([
        'status'  => 'error',
        'message' => 'Ocurrió un error interno. Intenta de nuevo.',
    ]);
});

// ═══════════════════════════════════════════════════════════════
// BLOQUE 3 — DEPENDENCIAS (tras cabeceras y shutdown handler)
// ═══════════════════════════════════════════════════════════════

require_once 'Database.php';

// ═══════════════════════════════════════════════════════════════
// BLOQUE 4 — LÓGICA PRINCIPAL (un único try/catch Throwable)
// Captura PDOException, RuntimeException, TypeError, Error y todo
// lo que PHP pueda lanzar dentro de la ejecución normal.
// ═══════════════════════════════════════════════════════════════

/** @var PDO|null $pdo Referencia accesible en el catch para rollback */
$pdo = null;

try {

    // ── Solo POST ─────────────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['status' => 'error', 'message' => 'Método no permitido.']);
        exit();
    }

    // ── Leer y parsear JSON ───────────────────────────────────
    $raw  = (string) file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'El cuerpo de la petición no es JSON válido.']);
        exit();
    }

    // ── Validación estricta (Mandamiento #2) ──────────────────
    $validationErrors = [];

    $expeditionId = filter_var(
        $body['expedition_id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );
    if ($expeditionId === false || $expeditionId === null) {
        $validationErrors[] = 'expedition_id: Debe ser un entero positivo.';
    }

    $departureDate = trim((string) ($body['departure_date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $departureDate)) {
        $validationErrors[] = 'departure_date: Formato inválido. Use YYYY-MM-DD.';
    } elseif ($departureDate < date('Y-m-d')) {
        $validationErrors[] = 'departure_date: La fecha no puede ser anterior a hoy.';
    }

    $numSpots = filter_var(
        $body['num_spots'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1, 'max_range' => 20]]
    );
    if ($numSpots === false || $numSpots === null) {
        $validationErrors[] = 'num_spots: Debe ser un entero entre 1 y 20.';
    }

    $customerName = trim((string) ($body['customer_name'] ?? ''));
    if (mb_strlen($customerName) < 3) {
        $validationErrors[] = 'customer_name: Mínimo 3 caracteres.';
    }

    $customerEmail = strtolower(trim((string) ($body['customer_email'] ?? '')));
    if (filter_var($customerEmail, FILTER_VALIDATE_EMAIL) === false) {
        $validationErrors[] = 'customer_email: Formato de correo inválido.';
    }

    $customerPhone = trim((string) ($body['customer_phone'] ?? ''));
    if (strlen(preg_replace('/\D/', '', $customerPhone)) < 7) {
        $validationErrors[] = 'customer_phone: Mínimo 7 dígitos numéricos.';
    }

    if ($validationErrors !== []) {
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'El formulario contiene errores.',
            'errors'  => $validationErrors,
        ]);
        exit();
    }

    // A partir de aquí $expeditionId, $numSpots son int validados.
    // @var int $expeditionId
    // @var int $numSpots
    $expeditionId = (int) $expeditionId;
    $numSpots     = (int) $numSpots;

    // ── Conexión a BD ─────────────────────────────────────────
    $pdo = Database::getInstance()->getConnection();

    // ── 1. Verificar expedición activa + daily_capacity ───────
    $stmt = $pdo->prepare(
        "SELECT id, name, price, daily_capacity
         FROM expeditions
         WHERE id = ? AND status = 'active'"
    );
    $stmt->execute([$expeditionId]);
    $expedition = $stmt->fetch();

    if ($expedition === false) {
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'El formulario contiene errores.',
            'errors'  => ['expedition_id: Expedición no encontrada o inactiva.'],
        ]);
        exit();
    }

    $dailyCapacity = (int) $expedition['daily_capacity'];
    $unitPrice     = (string) $expedition['price'];  // DECIMAL: no castear a float

    // ── 2. Verificar que departure_date no está bloqueada ─────
    $stmtBlocked = $pdo->prepare(
        "SELECT id FROM blocked_dates WHERE expedition_id = ? AND blocked_date = ?"
    );
    $stmtBlocked->execute([$expeditionId, $departureDate]);
    if ($stmtBlocked->fetch() !== false) {
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'El formulario contiene errores.',
            'errors'  => ['departure_date: Esta fecha no está disponible para esta expedición.'],
        ]);
        exit();
    }

    // ── Transacción atómica ───────────────────────────────────
    $pdo->beginTransaction();

    // ── 3. Disponibilidad dinámica (FOR UPDATE — anti-race) ───
    $stmtCount = $pdo->prepare(
        "SELECT COALESCE(SUM(num_spots), 0) AS spots_sold
         FROM bookings
         WHERE expedition_id  = ?
           AND departure_date = ?
           AND payment_status NOT IN ('failed', 'refunded')
         FOR UPDATE"
    );
    $stmtCount->execute([$expeditionId, $departureDate]);
    $spotsSold = (int) $stmtCount->fetchColumn();

    if (($spotsSold + $numSpots) > $dailyCapacity) {
        $pdo->rollBack();
        $remaining = max(0, $dailyCapacity - $spotsSold);
        http_response_code(422);
        echo json_encode([
            'status'  => 'error',
            'message' => 'El formulario contiene errores.',
            'errors'  => ["num_spots: Sin cupo suficiente. Solo quedan {$remaining} lugar(es) para esa fecha."],
        ]);
        exit();
    }

    // ── 4. Total en backend (bcmul — precisión decimal exacta) ─
    $totalAmount = bcmul($unitPrice, (string) $numSpots, 2);

    // ── 5. Upsert customer ────────────────────────────────────
    $stmtFind = $pdo->prepare("SELECT id FROM customers WHERE email = ?");
    $stmtFind->execute([$customerEmail]);
    $existing = $stmtFind->fetch();

    if ($existing !== false) {
        $customerId = (int) $existing['id'];
        $pdo->prepare("UPDATE customers SET name = ?, phone = ? WHERE id = ?")
            ->execute([$customerName, $customerPhone, $customerId]);
    } else {
        $pdo->prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)")
            ->execute([$customerName, $customerEmail, $customerPhone]);
        $customerId = (int) $pdo->lastInsertId();
    }

    // ── 6. INSERT booking (payment_status = 'pending') ────────
    // paypal_order_id se deja NULL hasta que PayPal devuelva el ID real.
    // La columna es UNIQUE nullable — MySQL admite múltiples NULLs.
    $pdo->prepare(
        "INSERT INTO bookings
            (expedition_id, customer_id, departure_date, num_spots, total_amount, payment_status, paypal_order_id)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL)"
    )->execute([$expeditionId, $customerId, $departureDate, $numSpots, $totalAmount]);

    $bookingId = (int) $pdo->lastInsertId();

    // ── 7. Crear orden en PayPal (Circuit Breaker incluido) ───
    // $pdo se pasa para que la función lea las credenciales desde system_settings (BD > .env)
    $description   = sprintf('%s ×%d — %s', $expedition['name'], $numSpots, $departureDate);
    $paypalOrderId = callPaypalCreateOrder($totalAmount, $description, $pdo);

    // ── 8. Persistir paypal_order_id en el booking ────────────
    $pdo->prepare("UPDATE bookings SET paypal_order_id = ? WHERE id = ?")
        ->execute([$paypalOrderId, $bookingId]);

    // ── 9. Auditoría en paypal_transactions ───────────────────
    // ⚠️ Arquitecto: verificar nombres de columnas con DESCRIBE paypal_transactions.
    $pdo->prepare(
        "INSERT INTO paypal_transactions (booking_id, paypal_order_id, phase, response_json)
         VALUES (?, ?, 'order_created', ?)"
    )->execute([
        $bookingId,
        $paypalOrderId,
        json_encode(['paypal_order_id' => $paypalOrderId, 'booking_id' => $bookingId]),
    ]);

    $pdo->commit();

    // ── Respuesta exitosa ─────────────────────────────────────
    echo json_encode([
        'status'  => 'success',
        'message' => 'Orden de pago creada. Procede a la aprobación.',
        'data'    => ['paypal_order_id' => $paypalOrderId],
    ]);
    exit();

} catch (\Throwable $e) {

    // ── Rollback seguro (captura excepciones dentro del catch) ─
    if ($pdo instanceof PDO) {
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $rollbackErr) {
            // Loguear el error de rollback pero no dejar que bloquee la respuesta
            Database::writeLog(
                'crear_orden_paypal.php',
                '[RollbackError] ' . $rollbackErr->getMessage()
            );
        }
    }

    // ── Log del error real (nunca al frontend) ────────────────
    Database::writeLog(
        'crear_orden_paypal.php',
        '[' . get_class($e) . '] ' . $e->getMessage()
    );

    // ── Respuesta JSON siempre (las cabeceras CORS ya se enviaron) ─
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'No se pudo crear la orden de pago. Intenta de nuevo.',
    ]);
    exit();
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES — PayPal REST API v2
// ═══════════════════════════════════════════════════════════════

/**
 * Lee un valor de system_settings (BD). Devuelve '' si no existe o hay error.
 * Silencia excepciones para no bloquear el flujo si system_settings no existe aún.
 */
function getPaypalSetting(PDO $pdo, string $key): string
{
    try {
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        return ($row !== false && (string) $row['setting_value'] !== '') ? (string) $row['setting_value'] : '';
    } catch (\Throwable) {
        return '';
    }
}

/**
 * Crea una Orden PayPal con intent CAPTURE y devuelve su ID.
 * Prioridad de credenciales: system_settings (BD) → .env (fallback).
 *
 * @throws \RuntimeException si las credenciales faltan o PayPal devuelve error.
 */
function callPaypalCreateOrder(string $totalAmount, string $description, PDO $pdo): string
{
    // 1ª fuente: BD (admin puede actualizarlas desde el dashboard)
    // Leer el modo activo primero para seleccionar las claves granulares correctas
    $mode = getPaypalSetting($pdo, 'paypal_mode');
    if (!in_array($mode, ['sandbox', 'live'], true)) {
        $env  = parseEnvFile(dirname(__DIR__) . '/.env');
        $mode = $env['PAYPAL_MODE'] ?? 'sandbox';
    }

    // Intentar leer claves granulares (paypal_client_id_sandbox / paypal_client_id_live)
    $clientId     = getPaypalSetting($pdo, "paypal_client_id_{$mode}");
    $clientSecret = getPaypalSetting($pdo, "paypal_secret_{$mode}");

    // Fallback a claves legacy si las granulares están vacías
    if ($clientId === '') {
        $clientId = getPaypalSetting($pdo, 'paypal_client_id');
    }
    if ($clientSecret === '') {
        $clientSecret = getPaypalSetting($pdo, 'paypal_client_secret');
    }

    // Último fallback: .env
    if ($clientId === '' || $clientSecret === '') {
        $env          = parseEnvFile(dirname(__DIR__) . '/.env');
        $clientId     = $clientId     !== '' ? $clientId     : ($env['PAYPAL_CLIENT_ID']     ?? '');
        $clientSecret = $clientSecret !== '' ? $clientSecret : ($env['PAYPAL_CLIENT_SECRET'] ?? '');
    }

    if ($clientId === '' || $clientSecret === '') {
        throw new \RuntimeException(
            'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET ausentes en .env. ' .
            'Configura las credenciales de PayPal sandbox para continuar.'
        );
    }

    $baseUrl = $mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    // Paso A: obtener access token
    $tokenRes = httpPost(
        $baseUrl . '/v1/oauth2/token',
        'grant_type=client_credentials',
        [
            'Authorization: Basic ' . base64_encode("{$clientId}:{$clientSecret}"),
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ]
    );

    $tokenData = json_decode($tokenRes['body'], true);
    if ($tokenRes['code'] !== 200 || empty($tokenData['access_token'])) {
        throw new \RuntimeException(
            "PayPal token HTTP {$tokenRes['code']}: {$tokenRes['body']}"
        );
    }

    // Paso B: crear la Orden
    $orderRes = httpPost(
        $baseUrl . '/v2/checkout/orders',
        (string) json_encode([
            'intent'         => 'CAPTURE',
            'purchase_units' => [[
                'description' => $description,
                'amount'      => ['currency_code' => 'MXN', 'value' => $totalAmount],
            ]],
        ]),
        [
            'Authorization: Bearer ' . $tokenData['access_token'],
            'Content-Type: application/json',
            'Accept: application/json',
        ]
    );

    $orderData = json_decode($orderRes['body'], true);
    if ($orderRes['code'] !== 201 || empty($orderData['id'])) {
        throw new \RuntimeException(
            "PayPal create order HTTP {$orderRes['code']}: {$orderRes['body']}"
        );
    }

    return (string) $orderData['id'];
}

/**
 * Ejecuta un POST HTTP vía cURL.
 * @param string[] $headers
 * @return array{code: int, body: string}
 * @throws \RuntimeException en error de red.
 */
function httpPost(string $url, string $body, array $headers): array
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $responseBody = curl_exec($ch);
    $httpCode     = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError    = curl_error($ch);
    curl_close($ch);

    if ($curlError !== '' || $responseBody === false) {
        throw new \RuntimeException("cURL error [{$url}]: {$curlError}");
    }

    return ['code' => $httpCode, 'body' => (string) $responseBody];
}

/**
 * Parser mínimo de .env (sin Composer).
 * Misma lógica que Database::loadEnv — candidato a refactor en una clase Config.
 * @return array<string, string>
 */
function parseEnvFile(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return [];
    }
    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        $pos = strpos($line, '=');
        if ($pos === false || $pos === 0) {
            continue;
        }
        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));
        $len = strlen($val);
        if ($len >= 2) {
            $f = $val[0];
            $l = $val[$len - 1];
            if (($f === '"' && $l === '"') || ($f === "'" && $l === "'")) {
                $val = substr($val, 1, $len - 2);
            }
        }
        if ($key !== '') {
            $env[$key] = $val;
        }
    }
    return $env;
}
