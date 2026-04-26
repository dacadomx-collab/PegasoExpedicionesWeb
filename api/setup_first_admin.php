<?php

declare(strict_types=1);

/**
 * setup_first_admin.php — Script de uso ÚNICO para crear el primer administrador.
 *
 * SEGURIDAD:
 *   - Solo funciona si la tabla admin_users está vacía (cero registros).
 *   - Bloquea su propio acceso una vez que existe al menos un admin.
 *   - ELIMINAR o restringir este archivo con .htaccess después de usarlo.
 *
 * USO: Acceder a http://localhost/PegasoExpedicionesDev/api/setup_first_admin.php
 */

require_once __DIR__ . '/Database.php';

// ── Determinar si es una petición POST o GET ──────────────────
$isPost  = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$message = '';
$success = false;

if ($isPost) {
    $name     = trim($_POST['name']     ?? '');
    $email    = strtolower(trim($_POST['email']    ?? ''));
    $password = $_POST['password'] ?? '';
    $confirm  = $_POST['confirm']  ?? '';

    $errors = [];

    if (mb_strlen($name) < 3) {
        $errors[] = 'El nombre debe tener al menos 3 caracteres.';
    }
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'Correo electrónico inválido.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if ($password !== $confirm) {
        $errors[] = 'Las contraseñas no coinciden.';
    }

    if ($errors === []) {
        try {
            $pdo = Database::getInstance()->getConnection();

            // Verificar que no existan admins
            $count = (int) $pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
            if ($count > 0) {
                $message = '⛔ Ya existe un administrador. Este script está bloqueado.';
            } else {
                $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                // role = 'super_admin' es el DEFAULT real definido en el ALTER TABLE (2026-04-24).
                $pdo->prepare(
                    "INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, 'super_admin')"
                )->execute([$name, $email, $hash]);

                $success = true;
                $message = "✅ Administrador '{$name}' creado con éxito. Ahora puedes eliminar este archivo.";
            }
        } catch (\Throwable $e) {
            Database::writeLog('setup_first_admin.php', $e->getMessage());
            $message = '❌ Error al crear el administrador. Revisa logs/error.log.';
        }
    }
}

// ── Verificar estado actual (bloqueo si ya hay admin) ─────────
$alreadyHasAdmin = false;
try {
    $pdo = Database::getInstance()->getConnection();
    $alreadyHasAdmin = (int) $pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn() > 0;
} catch (\Throwable $e) {
    // Si la BD falla, mostrar el formulario de todos modos (el POST capturará el error)
}

?><!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pegaso — Setup Primer Administrador</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    h1 { font-size: 1.4rem; font-weight: 700; color: #0f0200; margin-bottom: .25rem; }
    p.sub { color: #4c4c4c; font-size: .875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: .8rem; font-weight: 600; color: #0f0200; margin-bottom: .3rem; }
    input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: .6rem .8rem; font-size: .9rem; outline: none; transition: border-color .2s; }
    input:focus { border-color: #f26d52; }
    .field { margin-bottom: 1rem; }
    button { width: 100%; background: #f26d52; color: white; border: none; border-radius: 8px; padding: .75rem; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: .5rem; }
    button:hover { background: #e05a40; }
    .msg { padding: .75rem 1rem; border-radius: 8px; font-size: .875rem; margin-bottom: 1rem; }
    .msg.ok  { background: #dcfce7; color: #14532d; }
    .msg.err { background: #fee2e2; color: #7f1d1d; }
    .blocked { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; padding: 1rem; color: #7f1d1d; font-size: .9rem; }
    ul { list-style: disc inside; margin-top: .5rem; }
    li { margin-top: .25rem; font-size: .85rem; }
    .warning { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: .75rem 1rem; font-size: .8rem; color: #78350f; margin-top: 1.5rem; }
  </style>
</head>
<body>
<div class="card">
  <h1>🚀 Pegaso — Primer Admin</h1>
  <p class="sub">Script de configuración de único uso</p>

  <?php if ($alreadyHasAdmin && !$success): ?>
    <div class="blocked">
      <strong>⛔ Acceso bloqueado.</strong><br>
      Ya existe al menos un administrador en el sistema.<br>
      Elimina este archivo del servidor por seguridad.
    </div>
  <?php else: ?>

    <?php if ($message !== ''): ?>
      <div class="msg <?= $success ? 'ok' : 'err' ?>"><?= htmlspecialchars($message) ?></div>
    <?php endif; ?>

    <?php if (!empty($errors)): ?>
      <div class="msg err">
        <ul><?php foreach ($errors as $e): ?><li><?= htmlspecialchars($e) ?></li><?php endforeach; ?></ul>
      </div>
    <?php endif; ?>

    <?php if (!$success): ?>
    <form method="POST">
      <div class="field">
        <label for="name">Nombre completo</label>
        <input id="name" name="name" type="text" placeholder="Daniel García" required
               value="<?= htmlspecialchars($_POST['name'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="email">Correo electrónico</label>
        <input id="email" name="email" type="email" placeholder="admin@pegasoexpediciones.com" required
               value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="password">Contraseña (mín. 8 caracteres)</label>
        <input id="password" name="password" type="password" required>
      </div>
      <div class="field">
        <label for="confirm">Confirmar contraseña</label>
        <input id="confirm" name="confirm" type="password" required>
      </div>
      <button type="submit">Crear Administrador</button>
    </form>
    <?php endif; ?>

    <div class="warning">
      ⚠️ <strong>Importante:</strong> Una vez creado el administrador, elimina o deniega
      el acceso a este archivo con tu panel de hosting o con una regla en <code>.htaccess</code>.
    </div>

  <?php endif; ?>
</div>
</body>
</html>
