<?php

declare(strict_types=1);

/**
 * test_crud.php — Validación de estructura de BD: Pegaso Expediciones
 *
 * Prueba la secuencia completa Create → Read → Update → Delete
 * usando SOLO Prepared Statements y el schema canónico del Codex.
 *
 * ⚠️  EJECUTAR ÚNICAMENTE EN ENTORNO LOCAL (APP_ENV=local).
 *     Este script BORRA sus propios registros al finalizar.
 */

require_once __DIR__ . '/api/Database.php';

// ── Helpers de salida ────────────────────────────────────────────────────────

function ok(string $step): void
{
    echo "[ÉXITO] {$step}\n";
}

function fail(string $step, string $reason): void
{
    echo "[FALLO] {$step} — {$reason}\n";
}

function section(string $title): void
{
    echo "\n── {$title} " . str_repeat('─', max(0, 55 - strlen($title))) . "\n";
}

// ── Guardia de entorno ───────────────────────────────────────────────────────

$envFile = __DIR__ . '/.env';
$envVars = [];
if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        $envVars[trim($k)] = trim($v, " \t\"'");
    }
}

if (($envVars['APP_ENV'] ?? '') !== 'local') {
    die("[ABORTADO] Solo se ejecuta con APP_ENV=local. Entorno actual: " . ($envVars['APP_ENV'] ?? 'desconocido') . "\n");
}

// ── Conexión ─────────────────────────────────────────────────────────────────

section('CONEXIÓN');
try {
    $db  = Database::getInstance();
    $pdo = $db->getConnection();
    ok('Singleton Database instanciado');
    ok('Conexión PDO establecida (utf8mb4, ERRMODE_EXCEPTION)');
} catch (RuntimeException $e) {
    fail('Conexión', $e->getMessage());
    exit(1);
}

// ── IDs de registros de prueba (para limpiar al final) ───────────────────────

$testIds = ['expedicion' => null, 'fecha' => null, 'reserva' => null, 'txn' => null];

// ════════════════════════════════════════════════════════════════════════════
// FASE CREATE
// ════════════════════════════════════════════════════════════════════════════

section('CREATE');

// 1. INSERT expedicion
try {
    $stmt = $pdo->prepare("
        INSERT INTO `expediciones`
            (`nombre`, `descripcion`, `precio`, `cupo_maximo`, `imagen_url`, `activo`)
        VALUES
            (:nombre, :descripcion, :precio, :cupo_maximo, :imagen_url, :activo)
    ");
    $stmt->execute([
        ':nombre'      => '[TEST] Tiburón Ballena Test',
        ':descripcion' => 'Registro de prueba — borrar automáticamente.',
        ':precio'      => '1500.00',
        ':cupo_maximo' => 10,
        ':imagen_url'  => null,
        ':activo'      => 0,   // inactivo para no aparecer en producción
    ]);
    $testIds['expedicion'] = (int) $pdo->lastInsertId();
    ok("INSERT expediciones → id={$testIds['expedicion']}");
} catch (PDOException $e) {
    fail('INSERT expediciones', $e->getMessage());
    exit(1);
}

// 2. INSERT fecha_expedicion
try {
    $stmt = $pdo->prepare("
        INSERT INTO `fechas_expedicion`
            (`expedicion_id`, `fecha_salida`, `cupo_disponible`, `activo`)
        VALUES
            (:expedicion_id, :fecha_salida, :cupo_disponible, :activo)
    ");
    $stmt->execute([
        ':expedicion_id'   => $testIds['expedicion'],
        ':fecha_salida'    => date('Y-m-d', strtotime('+30 days')),
        ':cupo_disponible' => 10,
        ':activo'          => 0,
    ]);
    $testIds['fecha'] = (int) $pdo->lastInsertId();
    ok("INSERT fechas_expedicion → id={$testIds['fecha']}");
} catch (PDOException $e) {
    fail('INSERT fechas_expedicion', $e->getMessage());
    exit(1);
}

// 3. INSERT reserva (cliente de prueba + JSON test vía transaccion_paypal)
try {
    $stmt = $pdo->prepare("
        INSERT INTO `reservas`
            (`expedicion_id`, `fecha_expedicion_id`,
             `cliente_nombre`, `cliente_email`, `cliente_telefono`,
             `num_lugares`, `total_pagado`, `estatus_pago`,
             `orden_paypal`, `ip_cliente`)
        VALUES
            (:expedicion_id, :fecha_expedicion_id,
             :cliente_nombre, :cliente_email, :cliente_telefono,
             :num_lugares, :total_pagado, :estatus_pago,
             :orden_paypal, :ip_cliente)
    ");
    $stmt->execute([
        ':expedicion_id'       => $testIds['expedicion'],
        ':fecha_expedicion_id' => $testIds['fecha'],
        ':cliente_nombre'      => 'Cliente Test Pegaso',
        ':cliente_email'       => 'test@pegasoexpediciones.com',
        ':cliente_telefono'    => '6121234567',
        ':num_lugares'         => 2,
        ':total_pagado'        => '3000.00',
        ':estatus_pago'        => 'pendiente',
        ':orden_paypal'        => 'TEST-ORDER-' . time(),
        ':ip_cliente'          => '127.0.0.1',
    ]);
    $testIds['reserva'] = (int) $pdo->lastInsertId();
    ok("INSERT reservas (cliente) → id={$testIds['reserva']}");
} catch (PDOException $e) {
    fail('INSERT reservas', $e->getMessage());
    exit(1);
}

// 4. INSERT transacciones_paypal con JSON (test de columna tipo JSON)
try {
    $payloadJson = json_encode([
        'event'    => 'TEST_ORDER_CREATED',
        'order_id' => 'TEST-ORDER-' . time(),
        'amount'   => ['value' => '3000.00', 'currency_code' => 'MXN'],
        'status'   => 'CREATED',
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare("
        INSERT INTO `transacciones_paypal`
            (`reserva_id`, `orden_paypal`, `capture_id`, `fase`, `respuesta_json`)
        VALUES
            (:reserva_id, :orden_paypal, :capture_id, :fase, :respuesta_json)
    ");
    $stmt->execute([
        ':reserva_id'     => $testIds['reserva'],
        ':orden_paypal'   => 'TEST-ORDER-' . time(),
        ':capture_id'     => null,
        ':fase'           => 'orden_creada',
        ':respuesta_json' => $payloadJson,
    ]);
    $testIds['txn'] = (int) $pdo->lastInsertId();
    ok("INSERT transacciones_paypal (JSON) → id={$testIds['txn']}");
} catch (PDOException $e) {
    fail('INSERT transacciones_paypal', $e->getMessage());
    exit(1);
}

// ════════════════════════════════════════════════════════════════════════════
// FASE READ
// ════════════════════════════════════════════════════════════════════════════

section('READ');

// 5. SELECT expedicion con JOIN a fechas
try {
    $stmt = $pdo->prepare("
        SELECT e.id, e.nombre, e.precio, e.cupo_maximo,
               f.id AS fecha_id, f.fecha_salida, f.cupo_disponible
        FROM   `expediciones`      AS e
        JOIN   `fechas_expedicion` AS f ON f.expedicion_id = e.id
        WHERE  e.id = :id
        LIMIT  1
    ");
    $stmt->execute([':id' => $testIds['expedicion']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || (int) $row['id'] !== $testIds['expedicion']) {
        throw new RuntimeException('Registro no encontrado o id no coincide.');
    }
    ok("SELECT expedicion+fecha → nombre: \"{$row['nombre']}\", precio: {$row['precio']}");
} catch (Throwable $e) {
    fail('SELECT expedicion', $e->getMessage());
}

// 6. SELECT transaccion + decode JSON
try {
    $stmt = $pdo->prepare("
        SELECT `respuesta_json`
        FROM   `transacciones_paypal`
        WHERE  `id` = :id
    ");
    $stmt->execute([':id' => $testIds['txn']]);
    $txn = $stmt->fetch(PDO::FETCH_ASSOC);

    $decoded = json_decode((string) $txn['respuesta_json'], true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('json_decode falló: ' . json_last_error_msg());
    }
    if (($decoded['event'] ?? '') !== 'TEST_ORDER_CREATED') {
        throw new RuntimeException('Campo "event" del JSON no coincide.');
    }
    ok("SELECT+json_decode transacciones_paypal → event: \"{$decoded['event']}\", amount: {$decoded['amount']['value']} {$decoded['amount']['currency_code']}");
} catch (Throwable $e) {
    fail('SELECT+json_decode transacciones_paypal', $e->getMessage());
}

// ════════════════════════════════════════════════════════════════════════════
// FASE UPDATE
// ════════════════════════════════════════════════════════════════════════════

section('UPDATE');

// 7. Decrementar cupo_disponible (simula reserva confirmada)
try {
    $stmt = $pdo->prepare("
        UPDATE `fechas_expedicion`
        SET    `cupo_disponible` = `cupo_disponible` - :lugares
        WHERE  `id`              = :id
          AND  `cupo_disponible` >= :lugares
    ");
    $stmt->execute([':lugares' => 2, ':id' => $testIds['fecha']]);

    if ($stmt->rowCount() === 0) {
        throw new RuntimeException('0 filas afectadas. ¿Cupo insuficiente?');
    }

    $check = $pdo->prepare("SELECT cupo_disponible FROM fechas_expedicion WHERE id = :id");
    $check->execute([':id' => $testIds['fecha']]);
    $nuevo = (int) $check->fetchColumn();

    ok("UPDATE cupo_disponible → valor actual: {$nuevo} (era 10, restamos 2)");
} catch (Throwable $e) {
    fail('UPDATE fechas_expedicion.cupo_disponible', $e->getMessage());
}

// 8. Actualizar estatus_pago de reserva
try {
    $stmt = $pdo->prepare("
        UPDATE `reservas`
        SET    `estatus_pago` = :nuevo_estatus
        WHERE  `id`           = :id
          AND  `estatus_pago` = 'pendiente'
    ");
    $stmt->execute([':nuevo_estatus' => 'completado', ':id' => $testIds['reserva']]);

    if ($stmt->rowCount() === 0) {
        throw new RuntimeException('0 filas afectadas. Estado no era "pendiente".');
    }
    ok('UPDATE reservas.estatus_pago → pendiente → completado');
} catch (Throwable $e) {
    fail('UPDATE reservas.estatus_pago', $e->getMessage());
}

// ════════════════════════════════════════════════════════════════════════════
// FASE DELETE (limpieza en orden inverso a las FK)
// ════════════════════════════════════════════════════════════════════════════

section('DELETE + LIMPIEZA');

$deleteOk = true;

foreach ([
    ['transacciones_paypal', 'txn'],
    ['reservas',             'reserva'],
    ['fechas_expedicion',    'fecha'],
    ['expediciones',         'expedicion'],
] as [$tabla, $key]) {
    if ($testIds[$key] === null) continue;
    try {
        $stmt = $pdo->prepare("DELETE FROM `{$tabla}` WHERE `id` = :id");
        $stmt->execute([':id' => $testIds[$key]]);
        ok("DELETE {$tabla} id={$testIds[$key]}");
    } catch (PDOException $e) {
        fail("DELETE {$tabla}", $e->getMessage());
        $deleteOk = false;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// RESUMEN FINAL
// ════════════════════════════════════════════════════════════════════════════

section('RESUMEN');
if ($deleteOk) {
    echo "\n✅  BD limpia — todos los registros de prueba eliminados.\n";
    echo "✅  Schema validado. La BD está lista para registro en el Codex.\n\n";
} else {
    echo "\n⚠️  Algunos registros de prueba pueden haber quedado en la BD.\n";
    echo "    Verifica las tablas manualmente antes de registrar en el Codex.\n\n";
}
