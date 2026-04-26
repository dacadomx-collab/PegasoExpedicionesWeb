<?php

declare(strict_types=1);

/**
 * cors.php — Gestor centralizado de CORS.
 *
 * INCLUIR como PRIMERA instrucción de cada endpoint PHP, antes de cualquier
 * require_once o lógica que pueda fallar — garantiza que el navegador siempre
 * reciba los headers CORS aunque un require posterior crashee.
 *
 * Orígenes permitidos:
 *   - Localhost (desarrollo local)
 *   - FRONTEND_URL del .env del servidor (producción)
 *
 * En producción: añadir FRONTEND_URL=https://pegasoexpediciones.com al .env
 */

// ── Leer FRONTEND_URL del .env (parser inline sin dependencias) ──
// No usamos Database::loadEnv() para evitar require_once aquí.
$_corsEnvPath    = dirname(__DIR__) . '/.env';
$_corsFrontendUrl = '';

if (is_readable($_corsEnvPath)) {
    foreach (file($_corsEnvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $_corsLine) {
        $_corsLine = trim($_corsLine);
        if ($_corsLine === '' || $_corsLine[0] === '#') {
            continue;
        }
        $_corsPos = strpos($_corsLine, '=');
        if ($_corsPos === false) {
            continue;
        }
        if (trim(substr($_corsLine, 0, $_corsPos)) !== 'FRONTEND_URL') {
            continue;
        }
        $_corsVal = trim(substr($_corsLine, $_corsPos + 1));
        $_corsLen = strlen($_corsVal);
        if ($_corsLen >= 2) {
            $_corsFirst = $_corsVal[0];
            $_corsLast  = $_corsVal[$_corsLen - 1];
            if (($_corsFirst === '"' && $_corsLast === '"') || ($_corsFirst === "'" && $_corsLast === "'")) {
                $_corsVal = substr($_corsVal, 1, $_corsLen - 2);
            }
        }
        $_corsFrontendUrl = $_corsVal;
        break;
    }
}

unset($_corsEnvPath, $_corsLine, $_corsPos, $_corsVal, $_corsLen, $_corsFirst, $_corsLast);

// ── Whitelist de orígenes permitidos ─────────────────────────────
$_corsAllowed = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

// Añadir la URL de producción si está configurada en .env
if ($_corsFrontendUrl !== '') {
    $_corsAllowed[] = $_corsFrontendUrl;
}

unset($_corsFrontendUrl);

// ── Emitir headers CORS ───────────────────────────────────────────
$_corsOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Solo enviar Allow-Origin si el origen está en la whitelist.
// Para orígenes desconocidos NO emitimos el header → el navegador bloquea solo.
if (in_array($_corsOrigin, $_corsAllowed, true)) {
    header("Access-Control-Allow-Origin: {$_corsOrigin}");
}

// Authorization: requerido para endpoints con JWT (Bearer token)
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Cache-Control, Authorization');
header('Access-Control-Max-Age: 86400');  // Cache preflight 24 h
header('Vary: Origin');

unset($_corsAllowed, $_corsOrigin);

// ── Preflight OPTIONS ─────────────────────────────────────────────
// El navegador envía OPTIONS antes de cualquier POST/GET cross-origin.
// Respondemos 204 (No Content) sin tocar la DB ni lógica de negocio.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}
