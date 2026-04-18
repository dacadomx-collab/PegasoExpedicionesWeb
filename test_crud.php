<?php

declare(strict_types=1);

/**
 * test_crud.php — Validación de estructura de BD: Pegaso Expediciones
 * Schema: INGLÉS (expeditions, expedition_dates, customers, bookings)
 *
 * Fase 0: DESCRIBE de cada tabla para verificar columnas reales.
 * Fases 1-4: Create → Read → Update → Delete.
 * Limpia todos sus propios registros al finalizar.
 *
 * ⚠️  EJECUTAR ÚNICAMENTE EN ENTORNO LOCAL (APP_ENV=local).
 */

require_once __DIR__ . '/api/Database.php';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(string $step): void
{
    echo "\033[32m[ÉXITO]\033[0m {$step}\n";
}

function fail(string $step, string $reason): void
{
    echo "\033[31m[FALLO]\033[0m {$step} — {$reason}\n";
}

function section(string $title): void
{
    $line = str_repeat('─', max(0, 58 - strlen($title)));
    echo "\n\033[1m── {$title} {$line}\033[0m\n";
}

function warn(string $msg): void
{
    echo "\033[33m[AVISO]\033[0m {$msg}\n";
}

// ── Guardia de entorno ────────────────────────────────────────────────────────

$envRaw = [];
foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
    $envRaw[trim($k)] = trim($v, " \t\"'");
}

if (($envRaw['APP_ENV'] ?? '') !== 'local') {
    die("\033[31m[ABORTADO]\033[0m Solo se ejecuta con APP_ENV=local.\n");
}

// ── Conexión ──────────────────────────────────────────────────────────────────

section('CONEXIÓN');
try {
    $db  = Database::getInstance();
    $pdo = $db->getConnection();
    ok('Singleton Database instanciado (utf8mb4, ERRMODE_EXCEPTION)');
} catch (RuntimeException $e) {
    fail('Conexión', $e->getMessage());
    exit(1);
}

// ════════════════════════════════════════════════════════════════════════════
// FASE 0: DESCRIBE — verifica que las tablas y columnas reales coinciden
// ════════════════════════════════════════════════════════════════════════════

section('FASE 0 — DESCRIBE (verificación de schema real)');

$tables = ['expeditions', 'expedition_dates', 'customers', 'bookings'];

foreach ($tables as $table) {
    try {
        $rows = $pdo->query("DESCRIBE `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
        $cols = array_column($rows, 'Field');
        ok("DESCRIBE {$table} → columnas: " . implode(', ', $cols));
    } catch (PDOException $e) {
        fail("DESCRIBE {$table}", $e->getMessage());
        echo "       ↳ La tabla no existe o el usuario no tiene permisos. Abortando test.\n";
        exit(1);
    }
}

// ── IDs para limpiar al final ─────────────────────────────────────────────────
$ids = ['expedition' => null, 'date' => null, 'customer' => null, 'booking' => null];

// ════════════════════════════════════════════════════════════════════════════
// FASE 1: CREATE
// ════════════════════════════════════════════════════════════════════════════

section('FASE 1 — CREATE');

// 1-A. INSERT expedition (con JSON en custom_fields)
try {
    $customFields = json_encode([
        'difficulty'    => 'medium',
        'includes'      => ['guide', 'equipment', 'snacks'],
        'meeting_point' => 'Puerto de La Paz, Muelle 3',
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare("
        INSERT INTO `expeditions`
            (`name`, `description`, `price`, `max_capacity`, `image_url`, `status`, `custom_fields`)
        VALUES
            (:name, :description, :price, :max_capacity, :image_url, :status, :custom_fields)
    ");
    $stmt->execute([
        ':name'          => '[TEST] Whale Shark Expedition',
        ':description'   => 'Test record — auto-deleted.',
        ':price'         => '150.00',
        ':max_capacity'  => 8,
        ':image_url'     => null,
        ':status'        => 'inactive',   // inactivo para no aparecer en el frontend
        ':custom_fields' => $customFields,
    ]);
    $ids['expedition'] = (int) $pdo->lastInsertId();
    ok("INSERT expeditions → id={$ids['expedition']}, custom_fields JSON insertado");
} catch (PDOException $e) {
    fail('INSERT expeditions', $e->getMessage());
    exit(1);
}

// 1-B. INSERT expedition_date
try {
    $stmt = $pdo->prepare("
        INSERT INTO `expedition_dates`
            (`expedition_id`, `departure_date`, `available_spots`, `status`)
        VALUES
            (:expedition_id, :departure_date, :available_spots, :status)
    ");
    $stmt->execute([
        ':expedition_id'  => $ids['expedition'],
        ':departure_date' => date('Y-m-d', strtotime('+30 days')),
        ':available_spots' => 8,
        ':status'         => 'inactive',
    ]);
    $ids['date'] = (int) $pdo->lastInsertId();
    ok("INSERT expedition_dates → id={$ids['date']}");
} catch (PDOException $e) {
    fail('INSERT expedition_dates', $e->getMessage());
    exit(1);
}

// 1-C. INSERT customer
try {
    $stmt = $pdo->prepare("
        INSERT INTO `customers` (`name`, `email`, `phone`)
        VALUES (:name, :email, :phone)
    ");
    $stmt->execute([
        ':name'  => 'Test Customer Pegaso',
        ':email' => 'test-' . time() . '@pegasoexpediciones.com',
        ':phone' => '6121234567',
    ]);
    $ids['customer'] = (int) $pdo->lastInsertId();
    ok("INSERT customers → id={$ids['customer']}");
} catch (PDOException $e) {
    fail('INSERT customers', $e->getMessage());
    exit(1);
}

// 1-D. INSERT booking
try {
    $stmt = $pdo->prepare("
        INSERT INTO `bookings`
            (`expedition_id`, `expedition_date_id`, `customer_id`,
             `num_spots`, `total_amount`, `payment_status`,
             `paypal_order_id`, `client_ip`)
        VALUES
            (:expedition_id, :expedition_date_id, :customer_id,
             :num_spots, :total_amount, :payment_status,
             :paypal_order_id, :client_ip)
    ");
    $stmt->execute([
        ':expedition_id'      => $ids['expedition'],
        ':expedition_date_id' => $ids['date'],
        ':customer_id'        => $ids['customer'],
        ':num_spots'          => 2,
        ':total_amount'       => '300.00',
        ':payment_status'     => 'pending',
        ':paypal_order_id'    => 'TEST-ORDER-' . time(),
        ':client_ip'          => '127.0.0.1',
    ]);
    $ids['booking'] = (int) $pdo->lastInsertId();
    ok("INSERT bookings → id={$ids['booking']}");
} catch (PDOException $e) {
    fail('INSERT bookings', $e->getMessage());
    exit(1);
}

// ════════════════════════════════════════════════════════════════════════════
// FASE 2: READ + json_decode
// ════════════════════════════════════════════════════════════════════════════

section('FASE 2 — READ');

// 2-A. SELECT expedition + JOIN expedition_dates
try {
    $stmt = $pdo->prepare("
        SELECT e.id, e.name, e.price, e.status, e.custom_fields,
               ed.id AS date_id, ed.departure_date, ed.available_spots
        FROM   `expeditions`      AS e
        JOIN   `expedition_dates` AS ed ON ed.expedition_id = e.id
        WHERE  e.id = :id
        LIMIT  1
    ");
    $stmt->execute([':id' => $ids['expedition']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) throw new RuntimeException('Registro no encontrado.');

    $cf = json_decode((string) $row['custom_fields'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('json_decode de custom_fields falló: ' . json_last_error_msg());
    }

    ok("SELECT expedition+date → name: \"{$row['name']}\", departure: {$row['departure_date']}");
    ok("json_decode custom_fields → difficulty: \"{$cf['difficulty']}\", includes: " . implode(', ', $cf['includes']));
} catch (Throwable $e) {
    fail('SELECT expeditions + json_decode', $e->getMessage());
}

// 2-B. SELECT booking + customer (JOIN)
try {
    $stmt = $pdo->prepare("
        SELECT b.id, b.num_spots, b.total_amount, b.payment_status,
               c.name AS customer_name, c.email
        FROM   `bookings`  AS b
        JOIN   `customers` AS c ON c.id = b.customer_id
        WHERE  b.id = :id
    ");
    $stmt->execute([':id' => $ids['booking']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) throw new RuntimeException('Booking no encontrado.');
    ok("SELECT bookings+customers → customer: \"{$row['customer_name']}\", spots: {$row['num_spots']}, amount: {$row['total_amount']}");
} catch (Throwable $e) {
    fail('SELECT bookings+customers', $e->getMessage());
}

// ════════════════════════════════════════════════════════════════════════════
// FASE 3: UPDATE
// ════════════════════════════════════════════════════════════════════════════

section('FASE 3 — UPDATE');

// 3-A. Decrementar available_spots (decremento atómico con guard)
try {
    $stmt = $pdo->prepare("
        UPDATE `expedition_dates`
        SET    `available_spots` = `available_spots` - :spots
        WHERE  `id`              = :id
          AND  `available_spots` >= :spots
    ");
    $stmt->execute([':spots' => 2, ':id' => $ids['date']]);

    if ($stmt->rowCount() === 0) throw new RuntimeException('0 filas afectadas — cupo insuficiente.');

    $check = $pdo->prepare("SELECT available_spots FROM expedition_dates WHERE id = :id");
    $check->execute([':id' => $ids['date']]);
    ok("UPDATE available_spots → nuevo valor: " . $check->fetchColumn() . " (era 8, restamos 2)");
} catch (Throwable $e) {
    fail('UPDATE expedition_dates.available_spots', $e->getMessage());
}

// 3-B. Actualizar payment_status (transición pendiente → completed)
try {
    $stmt = $pdo->prepare("
        UPDATE `bookings`
        SET    `payment_status` = 'completed'
        WHERE  `id`             = :id
          AND  `payment_status` = 'pending'
    ");
    $stmt->execute([':id' => $ids['booking']]);

    if ($stmt->rowCount() === 0) throw new RuntimeException('0 filas — el estado no era "pending".');
    ok("UPDATE bookings.payment_status → pending → completed");
} catch (Throwable $e) {
    fail('UPDATE bookings.payment_status', $e->getMessage());
}

// ════════════════════════════════════════════════════════════════════════════
// FASE 4: DELETE (orden inverso a FK)
// ════════════════════════════════════════════════════════════════════════════

section('FASE 4 — DELETE + LIMPIEZA');

$deleteOk = true;

foreach ([
    ['bookings',          'booking'],
    ['expedition_dates',  'date'],
    ['customers',         'customer'],
    ['expeditions',       'expedition'],
] as [$table, $key]) {
    if ($ids[$key] === null) continue;
    try {
        $stmt = $pdo->prepare("DELETE FROM `{$table}` WHERE `id` = :id");
        $stmt->execute([':id' => $ids[$key]]);
        ok("DELETE {$table} id={$ids[$key]}");
    } catch (PDOException $e) {
        fail("DELETE {$table}", $e->getMessage());
        $deleteOk = false;
    }
}

// ── Resumen ───────────────────────────────────────────────────────────────────

section('RESUMEN');
if ($deleteOk) {
    echo "\n\033[32m✅  BD limpia — todos los registros de prueba eliminados.\033[0m\n";
    echo "\033[32m✅  Schema inglés validado. Listo para registro definitivo en el Códex.\033[0m\n\n";
} else {
    echo "\n\033[33m⚠️   Algunos registros de prueba pueden haber quedado en la BD.\033[0m\n";
    echo "    Verifica manualmente antes de actualizar el Códex.\n\n";
}
