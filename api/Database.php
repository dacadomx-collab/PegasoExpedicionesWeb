<?php

declare(strict_types=1);

/**
 * Database — Singleton PDO.
 * Carga credenciales EXCLUSIVAMENTE desde ../.env (nunca hardcoded).
 * Cualquier fallo escribe en ../logs/error.log y lanza excepción genérica.
 * Sin dependencias de Composer.
 */
final class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        $envPath = dirname(__DIR__) . '/.env';
        $env     = $this->loadEnv($envPath);

        $this->validateEnv($env);

        $host    = $env['DB_HOST'];
        $port    = $env['DB_PORT']    ?? '3306';
        $name    = $env['DB_NAME'];
        $user    = $env['DB_USER'];
        $pass    = $env['DB_PASS'];
        $charset = $env['DB_CHARSET'] ?? 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        try {
            $this->pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset} COLLATE utf8mb4_unicode_ci",
            ]);
        } catch (PDOException $e) {
            // Registrar el error real (nunca exponerlo al navegador).
            self::writeLog(
                'Database::__construct',
                sprintf(
                    "PDOException [%s] | host=%s port=%s dbname=%s user=%s | %s",
                    $e->getCode(),
                    $host,
                    $port,
                    $name,
                    $user,
                    $e->getMessage()
                )
            );
            throw new RuntimeException('No se pudo conectar a la base de datos. Revisa logs/error.log.');
        }
    }

    /** Devuelve la instancia única. */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** Devuelve el objeto PDO para ejecutar queries. */
    public function getConnection(): PDO
    {
        return $this->pdo;
    }

    // ─────────────────────────────────────────────────────────────
    // Parser de .env nativo (sin dependencias externas)
    // Soporta: KEY=VALUE  KEY="VALUE"  KEY='VALUE'  # comentarios
    // Regla de comillas: solo se eliminan si el valor está COMPLETAMENTE
    // envuelto en el mismo tipo de comilla (doble o simple).
    // ─────────────────────────────────────────────────────────────

    /** @return array<string, string> */
    private function loadEnv(string $path): array
    {
        if (!is_readable($path)) {
            self::writeLog('Database::loadEnv', "Archivo .env no encontrado o sin permisos: {$path}");
            throw new RuntimeException('Archivo de configuración no disponible.');
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        if ($lines === false) {
            self::writeLog('Database::loadEnv', "file() no pudo leer: {$path}");
            throw new RuntimeException('Archivo de configuración no disponible.');
        }

        $env = [];

        foreach ($lines as $line) {
            $line = trim($line);

            // Ignorar comentarios y líneas vacías
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            // Buscar el primer '=' — lo que está a su derecha es el valor completo
            $pos = strpos($line, '=');
            if ($pos === false || $pos === 0) {
                continue; // línea malformada o sin clave
            }

            $key = trim(substr($line, 0, $pos));
            $raw = trim(substr($line, $pos + 1));

            // Strip de comillas: solo si el valor está COMPLETAMENTE
            // envuelto en el mismo tipo de comilla (evita mutilar passwords).
            $len = strlen($raw);
            if ($len >= 2) {
                $first = $raw[0];
                $last  = $raw[$len - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $raw = substr($raw, 1, $len - 2);
                }
            }

            if ($key !== '') {
                $env[$key] = $raw;
            }
        }

        return $env;
    }

    // ─────────────────────────────────────────────────────────────
    // Validación de variables requeridas
    // ─────────────────────────────────────────────────────────────

    /** @param array<string, string> $env */
    private function validateEnv(array $env): void
    {
        $required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];
        $missing  = [];

        foreach ($required as $key) {
            if (!isset($env[$key]) || $env[$key] === '') {
                $missing[] = $key;
            }
        }

        if ($missing !== []) {
            self::writeLog(
                'Database::validateEnv',
                'Variables requeridas ausentes o vacías en .env: ' . implode(', ', $missing)
            );
            throw new RuntimeException('Configuración de base de datos incompleta. Revisa logs/error.log.');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Logger centralizado (Pilar 05)
    // NUNCA expone datos al navegador — solo escribe en archivo.
    // ─────────────────────────────────────────────────────────────

    public static function writeLog(string $endpoint, string $message): void
    {
        $logDir  = dirname(__DIR__) . '/logs';
        $logPath = $logDir . '/error.log';

        // Crear el directorio si no existe (primera ejecución)
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        $line = sprintf(
            "[%s][CRITICAL][%s] %s\n",
            date('Y-m-d H:i:s'),
            $endpoint,
            $message
        );

        error_log($line, 3, $logPath);
    }

    /** Bloquea clonación y deserialización del Singleton. */
    private function __clone() {}

    /** @throws RuntimeException */
    public function __wakeup(): void
    {
        throw new RuntimeException('No se puede deserializar el Singleton Database.');
    }
}
