<?php

declare(strict_types=1);

/**
 * POST /api/login.php — Autenticación de administradores. Mandamiento 14.
 * Valida email + password contra admin_users (bcrypt), devuelve JWT HS256.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 4 (FASE 4 - 2026-04-24)
 */

// ═══════════════════════════════════════════════════════════════
// BLOQUE 1 — CABECERAS CORS (antes de cualquier require_once)
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
header('Access-Control-Allow-Headers: Content-Type, Accept, Cache-Control, Authorization');
header('Content-Type: application/json; charset=utf-8');
header('Vary: Origin');
unset($_corsAllowed, $_origin);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ═══════════════════════════════════════════════════════════════
// BLOQUE 2 — SHUTDOWN HANDLER (red de seguridad)
// ═══════════════════════════════════════════════════════════════

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null) {
        return;
    }
    if (!in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
    }
    @error_log(
        sprintf("[%s][CRITICAL][login.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']),
        3,
        dirname(__DIR__) . '/logs/error.log'
    );
    echo json_encode(['status' => 'error', 'message' => 'Ocurrió un error interno. Intenta de nuevo.']);
});

// ═══════════════════════════════════════════════════════════════
// BLOQUE 3 — DEPENDENCIAS
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/jwt.php';

// ═══════════════════════════════════════════════════════════════
// BLOQUE 4 — LÓGICA
// ═══════════════════════════════════════════════════════════════

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

    // ── Validación de entrada ─────────────────────────────────
    $email    = strtolower(trim((string) ($body['email']    ?? '')));
    $password = (string) ($body['password'] ?? '');

    $errors = [];
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'email: Formato inválido.';
    }
    if ($password === '') {
        $errors[] = 'password: Requerido.';
    }

    if ($errors !== []) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Datos inválidos.', 'errors' => $errors]);
        exit();
    }

    // ── Buscar admin en BD ────────────────────────────────────
    $pdo  = Database::getInstance()->getConnection();
    $stmt = $pdo->prepare("SELECT id, name, email, password_hash, role FROM admin_users WHERE email = ? AND active = 1");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    // Verificación de contraseña en tiempo constante (evita timing attacks)
    $dummyHash = '$2y$12$invalidhashforprotectiononly...............................';
    $hash      = ($admin !== false) ? (string) $admin['password_hash'] : $dummyHash;

    if ($admin === false || !password_verify($password, $hash)) {
        // Respuesta genérica para no revelar si el email existe
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Credenciales incorrectas.']);
        exit();
    }

    // ── Leer JWT_SECRET desde .env ────────────────────────────
    $envPath = dirname(__DIR__) . '/.env';
    $secret  = '';
    if (is_readable($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $key = trim(substr($line, 0, $pos));
            $val = trim(substr($line, $pos + 1));
            $len = strlen($val);
            if ($len >= 2 && (($val[0] === '"' && $val[$len - 1] === '"') || ($val[0] === "'" && $val[$len - 1] === "'"))) {
                $val = substr($val, 1, $len - 2);
            }
            if ($key === 'JWT_SECRET') {
                $secret = $val;
                break;
            }
        }
    }

    if ($secret === '') {
        Database::writeLog('login.php', 'JWT_SECRET no configurado en .env');
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Configuración de seguridad incompleta.']);
        exit();
    }

    // ── Generar JWT (TTL 8 horas) ─────────────────────────────
    $token = jwtEncode([
        'sub'   => (int) $admin['id'],
        'email' => $admin['email'],
        'name'  => $admin['name'],
        'role'  => $admin['role'],
    ], $secret, 8 * 3600);

    // ── Registrar último login (no crítico — fallo aislado) ──────
    // Si este UPDATE falla (p.ej. durante migraciones) NO debe impedir el login.
    // La excepción se loguea pero el flujo continúa y se entrega el token.
    try {
        $pdo->prepare("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?")
            ->execute([(int) $admin['id']]);
    } catch (\Throwable $e) {
        Database::writeLog('login.php', '[last_login_at] UPDATE no crítico: ' . $e->getMessage());
    }

    echo json_encode([
        'status'  => 'success',
        'message' => '¡Bienvenido, ' . $admin['name'] . '!',
        'data'    => [
            'token'      => $token,
            'admin_name' => $admin['name'],
            'admin_email'=> $admin['email'],
            'role'       => $admin['role'],
            'expires_in' => 8 * 3600,
        ],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('login.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error interno. Intenta de nuevo.']);
}
