<?php

declare(strict_types=1);

/**
 * POST /api/confirmar_reserva.php — Fase 2 del flujo de pago.
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 3
 *
 * Recibe { paypal_order_id } aprobado por el usuario en PayPal UI,
 * ejecuta la Captura, actualiza bookings y registra en paypal_transactions.
 * Idempotente: un order_id ya 'completed' devuelve 422.
 */

// ── CORS inline primero (ver crear_orden_paypal.php para justificación) ───
$_corsAllowed = [
    'http://localhost:3000', 'http://localhost:3001',
    'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . (in_array($_origin, $_corsAllowed, true) ? $_origin : $_corsAllowed[0]));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Cache-Control');
header('Content-Type: application/json; charset=utf-8');
header('Vary: Origin');
unset($_corsAllowed, $_origin);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── Shutdown handler para Fatal Errors ────────────────────────
register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (!headers_sent()) { http_response_code(500); }
    @error_log(sprintf("[%s][CRITICAL][confirmar_reserva.php] [FatalError] %s in %s:%d\n",
        date('Y-m-d H:i:s'), $err['message'], $err['file'], $err['line']), 3,
        dirname(__DIR__) . '/logs/error.log');
    echo json_encode(['status' => 'error', 'message' => 'Ocurrió un error interno. Intenta de nuevo.']);
});

require_once 'Database.php';
require_once __DIR__ . '/services/EmailService.php';

/** @var \PDO|null */
$pdo = null;

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

    $paypalOrderId = trim((string) ($body['paypal_order_id'] ?? ''));
    if ($paypalOrderId === '') {
        http_response_code(422);
        echo json_encode([
            'status' => 'error', 'message' => 'El formulario contiene errores.',
            'errors' => ['paypal_order_id: Requerido.'],
        ]);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // ── Buscar booking pendiente ──────────────────────────────
    $stmt = $pdo->prepare(
        "SELECT b.id, b.num_spots, b.total_amount, b.payment_status,
                b.departure_date, b.departure_time,
                e.name  AS expedition_name,
                c.name  AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                b.created_at
         FROM bookings b
         JOIN expeditions e ON e.id = b.expedition_id
         JOIN customers   c ON c.id = b.customer_id
         WHERE b.paypal_order_id = ?"
    );
    $stmt->execute([$paypalOrderId]);
    $booking = $stmt->fetch();

    if ($booking === false) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error', 'message' => 'Esta orden de pago no es válida o ya fue procesada.',
            'errors' => ['paypal_order_id: No encontrada.'],
        ]);
        exit();
    }

    // Idempotencia: no capturar dos veces
    if ($booking['payment_status'] === 'completed') {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Esta orden de pago ya fue procesada anteriormente.',
        ]);
        exit();
    }

    if ($booking['payment_status'] !== 'pending') {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Esta orden de pago no está en estado válido para captura.',
        ]);
        exit();
    }

    // ── Capturar pago en PayPal ───────────────────────────────
    $captureResult = capturePaypalOrder($paypalOrderId);
    $captureId     = $captureResult['capture_id'];

    // ── Actualizar DB atómicamente ────────────────────────────
    $pdo->beginTransaction();

    $pdo->prepare(
        "UPDATE bookings
         SET payment_status = 'completed', paypal_transaction_id = ?
         WHERE id = ?"
    )->execute([$captureId, (int) $booking['id']]);

    $pdo->prepare(
        "INSERT INTO paypal_transactions (booking_id, paypal_order_id, phase, response_json)
         VALUES (?, ?, 'capture_success', ?)"
    )->execute([
        (int) $booking['id'],
        $paypalOrderId,
        json_encode($captureResult['raw']),
    ]);

    $pdo->commit();

    // ── Notificaciones (no crítico — fallo NO rompe el pago ya confirmado) ──
    try {
        $emailService = new EmailService($pdo);
        $emailData = [
            'customer_name'         => $booking['customer_name'],
            'customer_email'        => $booking['customer_email'],
            'customer_phone'        => $booking['customer_phone'] ?? '',
            'expedition_name'       => $booking['expedition_name'],
            'departure_date'        => $booking['departure_date'],
            'departure_time'        => $booking['departure_time'] ?? '',
            'num_spots'             => (int) $booking['num_spots'],
            'total_amount'          => $booking['total_amount'],
            'paypal_transaction_id' => $captureId,
            'created_at'            => $booking['created_at'],
        ];
        $emailService->sendBookingConfirmation($emailData);
        $emailService->sendAdminAlert($emailData);
    } catch (\Throwable $emailErr) {
        Database::writeLog('confirmar_reserva.php', '[EmailService] ' . $emailErr->getMessage());
    }

    echo json_encode([
        'status'  => 'success',
        'message' => '¡Reserva confirmada! Revisa tu correo.',
        'data'    => [
            'paypal_transaction_id' => $captureId,
            'created_at'            => $booking['created_at'],
            'customer_name'         => $booking['customer_name'],
            'expedition_name'       => $booking['expedition_name'],
            'departure_date'        => $booking['departure_date'],
            'num_spots'             => (int) $booking['num_spots'],
            'total_amount'          => $booking['total_amount'],
        ],
    ]);
    exit();

} catch (\Throwable $e) {
    if ($pdo instanceof \PDO) {
        try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable) {}
    }
    Database::writeLog('confirmar_reserva.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo completar el pago. Intenta de nuevo.']);
    exit();
}

// ── PayPal Capture API ────────────────────────────────────────

/**
 * @return array{ capture_id: string, raw: mixed }
 * @throws \RuntimeException
 */
function capturePaypalOrder(string $orderId): array
{
    $env          = parseEnvFileConf(dirname(__DIR__) . '/.env');
    $clientId     = $env['PAYPAL_CLIENT_ID']     ?? '';
    $clientSecret = $env['PAYPAL_CLIENT_SECRET'] ?? '';
    $mode         = $env['PAYPAL_MODE']          ?? 'sandbox';

    if ($clientId === '' || $clientSecret === '') {
        throw new \RuntimeException('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET ausentes en .env.');
    }

    $base = $mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Token
    $tokenRes = httpPostConf($base . '/v1/oauth2/token', 'grant_type=client_credentials', [
        'Authorization: Basic ' . base64_encode("{$clientId}:{$clientSecret}"),
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ]);
    $tokenData = json_decode($tokenRes['body'], true);
    if ($tokenRes['code'] !== 200 || empty($tokenData['access_token'])) {
        throw new \RuntimeException("PayPal token HTTP {$tokenRes['code']}: {$tokenRes['body']}");
    }

    // Capture
    $captureRes = httpPostConf(
        $base . '/v2/checkout/orders/' . $orderId . '/capture',
        '',
        [
            'Authorization: Bearer ' . $tokenData['access_token'],
            'Content-Type: application/json',
            'Accept: application/json',
        ]
    );
    $captureData = json_decode($captureRes['body'], true);

    if ($captureRes['code'] !== 201) {
        throw new \RuntimeException("PayPal capture HTTP {$captureRes['code']}: {$captureRes['body']}");
    }

    // Extraer capture_id de la respuesta
    $captureId = $captureData['purchase_units'][0]['payments']['captures'][0]['id'] ?? '';
    if ($captureId === '') {
        throw new \RuntimeException('PayPal no devolvió capture_id: ' . $captureRes['body']);
    }

    return ['capture_id' => $captureId, 'raw' => $captureData];
}

/** @return array{code:int,body:string} */
function httpPostConf(string $url, string $body, array $headers): array
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $resp  = curl_exec($ch);
    $code  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err   = curl_error($ch);
    curl_close($ch);
    if ($err !== '' || $resp === false) {
        throw new \RuntimeException("cURL [{$url}]: {$err}");
    }
    return ['code' => $code, 'body' => (string) $resp];
}

/** @return array<string,string> */
function parseEnvFileConf(string $path): array
{
    if (!is_readable($path)) return [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) return [];
    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $pos = strpos($line, '=');
        if ($pos === false || $pos === 0) continue;
        $k = trim(substr($line, 0, $pos));
        $v = trim(substr($line, $pos + 1));
        $len = strlen($v);
        if ($len >= 2 && (($v[0]==='"'&&$v[$len-1]==='"')||($v[0]==="'"&&$v[$len-1]==="'"))) {
            $v = substr($v, 1, $len - 2);
        }
        if ($k !== '') $env[$k] = $v;
    }
    return $env;
}
