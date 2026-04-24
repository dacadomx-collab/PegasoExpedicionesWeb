<?php

declare(strict_types=1);

/**
 * cors.php — Gestor centralizado de CORS.
 *
 * INCLUIR al inicio de CADA endpoint PHP antes de cualquier output.
 * Mandamiento #14: CORS ≠ Autenticación. Este archivo solo gestiona las
 * cabeceras de acceso cross-origin; la autenticación va en cada endpoint.
 *
 * Para producción: añadir el dominio real a $allowedOrigins y eliminar localhost.
 */

$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Whitelist estricta: solo permite orígenes conocidos.
// Devuelve el origin solicitado (para cookies+credentials futuros) o el primero de la lista.
$allowOrigin = in_array($origin, $allowedOrigins, true)
    ? $origin
    : $allowedOrigins[0];

header("Access-Control-Allow-Origin: {$allowOrigin}");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
// Cache-Control debe estar aquí: fetch({ cache:"no-store" }) lo añade al request
// y Chrome lo incluye en Access-Control-Request-Headers del preflight.
// Sin él, el preflight falla aunque el backend funcione perfectamente.
header('Access-Control-Allow-Headers: Content-Type, Accept, Cache-Control');
header('Access-Control-Max-Age: 86400');   // Cache el preflight 24 h
header('Vary: Origin');                    // CDN / proxies: variar cache por Origin

// ── Preflight OPTIONS ─────────────────────────────────────────
// El navegador envía OPTIONS antes de cualquier POST cross-origin.
// Respondemos 200 inmediatamente, sin tocar la DB ni ejecutar lógica.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
