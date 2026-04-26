<?php

declare(strict_types=1);

/**
 * auth_middleware.php — Validación de Bearer JWT para endpoints protegidos.
 *
 * Incluir DESPUÉS de las cabeceras CORS y ANTES de la lógica de negocio.
 * Si el token es inválido o ausente, emite HTTP 401 y termina el script.
 *
 * Expone: $adminPayload (array con sub, email, role, iat, exp)
 *
 * Uso:
 *   require_once 'jwt.php';
 *   require_once 'auth_middleware.php';
 *   // A partir de aquí $adminPayload está disponible.
 */

require_once __DIR__ . '/jwt.php';

/**
 * Verifica que el rol del admin autenticado esté en $allowedRoles.
 * Si no tiene permiso, emite HTTP 403 y termina el script.
 *
 * Llamar DESPUÉS de require_once 'auth_middleware.php' (que expone $adminPayload).
 *
 * Jerarquía de roles: super_admin > operaciones > ventas
 *
 * @param string[] $allowedRoles  Roles que pueden acceder al endpoint.
 * @param array<string,mixed> $payload  El $adminPayload expuesto por auth_middleware.
 */
function requireRole(array $allowedRoles, array $payload): void
{
    $role = (string) ($payload['role'] ?? '');
    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Acceso denegado. No tienes permisos para esta operación.',
            'errors'  => ['role: Se requiere uno de: ' . implode(', ', $allowedRoles) . '.'],
        ]);
        exit();
    }
}

/** @var array<string,mixed> $adminPayload */
$adminPayload = (static function (): array {
    // Leer JWT_SECRET desde .env
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
            // Strip quotes
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
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Configuración de seguridad incompleta.']);
        exit();
    }

    // Extraer token del header Authorization: Bearer <token>
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($authHeader === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Autenticación requerida.']);
        exit();
    }

    $token   = substr($authHeader, 7);
    $payload = jwtDecode($token, $secret);

    if ($payload === null) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Token inválido o expirado. Inicia sesión nuevamente.']);
        exit();
    }

    return $payload;
})();
