<?php

declare(strict_types=1);

/**
 * POST /api/create_admin_user.php — Crea un nuevo usuario administrador.
 * Requiere JWT + rol super_admin.
 *
 * Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 9 (FASE 5)
 */

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    if (!headers_sent()) http_response_code(500);
    @error_log(sprintf("[%s][CRITICAL][create_admin_user.php] %s in %s:%d\n", date('Y-m-d H:i:s'), $err['message'], $err['file'], (int) $err['line']), 3, dirname(__DIR__) . '/logs/error.log');
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

    // ── Validación ────────────────────────────────────────────
    $name     = trim((string) ($body['name']     ?? ''));
    $email    = strtolower(trim((string) ($body['email']    ?? '')));
    $password = (string) ($body['password'] ?? '');
    $role     = trim((string) ($body['role']     ?? ''));

    $allowedRoles = ['super_admin', 'operaciones', 'ventas'];
    $errors = [];

    if (mb_strlen($name) < 3) {
        $errors[] = 'name: Mínimo 3 caracteres.';
    }
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'email: Formato inválido.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'password: Mínimo 8 caracteres.';
    }
    if (!in_array($role, $allowedRoles, true)) {
        $errors[] = 'role: Debe ser uno de: ' . implode(', ', $allowedRoles) . '.';
    }

    if ($errors !== []) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Datos inválidos.', 'errors' => $errors]);
        exit();
    }

    $pdo = Database::getInstance()->getConnection();

    // Verificar unicidad de email
    $stmtChk = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
    $stmtChk->execute([$email]);
    if ($stmtChk->fetch() !== false) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Datos inválidos.',
            'errors'  => ['email: Ya existe un usuario con ese correo.'],
        ]);
        exit();
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $pdo->prepare(
        "INSERT INTO admin_users (name, email, role, active, password_hash) VALUES (?, ?, ?, 1, ?)"
    )->execute([$name, $email, $role, $hash]);

    $newId = (int) $pdo->lastInsertId();

    echo json_encode([
        'status'  => 'success',
        'message' => "Usuario '{$name}' creado con éxito.",
        'data'    => [
            'id'            => $newId,
            'name'          => $name,
            'email'         => $email,
            'role'          => $role,
            'active'        => 1,
            'last_login_at' => null,
            'created_at'    => date('Y-m-d H:i:s'),
        ],
    ]);

} catch (\Throwable $e) {
    Database::writeLog('create_admin_user.php', '[' . get_class($e) . '] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'No se pudo crear el usuario.']);
}
