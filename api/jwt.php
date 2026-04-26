<?php

declare(strict_types=1);

/**
 * jwt.php — Implementación HS256 JWT sin dependencias externas (sin Composer).
 * Mandamiento 14: Token de sesión seguro para endpoints protegidos de administración.
 *
 * Uso:
 *   require_once 'jwt.php';
 *   $token  = jwtEncode(['sub' => 1, 'email' => 'admin@example.com', 'role' => 'admin'], $secret, 3600);
 *   $payload = jwtDecode($token, $secret); // null si inválido o expirado
 */

function jwtEncode(array $payload, string $secret, int $ttlSeconds = 3600): string
{
    $now           = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $ttlSeconds;

    $header    = jwtBase64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']) ?: '');
    $body      = jwtBase64url(json_encode($payload) ?: '');
    $signature = jwtBase64url(hash_hmac('sha256', "{$header}.{$body}", $secret, true));

    return "{$header}.{$body}.{$signature}";
}

/**
 * Decodifica y valida el token.
 * @return array<string,mixed>|null  null si la firma es inválida, el token expiró o el formato es incorrecto.
 */
function jwtDecode(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header, $body, $sig] = $parts;

    // Verificar firma con comparación segura (timing-safe)
    $expected = jwtBase64url(hash_hmac('sha256', "{$header}.{$body}", $secret, true));
    if (!hash_equals($expected, $sig)) {
        return null;
    }

    $payload = json_decode(jwtBase64urlDecode($body), true);
    if (!is_array($payload)) {
        return null;
    }

    // Verificar expiración
    if (isset($payload['exp']) && (int) $payload['exp'] < time()) {
        return null; // Token expirado
    }

    return $payload;
}

function jwtBase64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwtBase64urlDecode(string $data): string
{
    return (string) base64_decode(strtr($data, '-_', '+/'));
}
