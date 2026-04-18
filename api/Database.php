<?php

declare(strict_types=1);

/**
 * Database — Singleton PDO.
 * Carga credenciales EXCLUSIVAMENTE desde .env (nunca hardcoded).
 * Cualquier fallo escribe en logs/error.log y lanza excepción limpia.
 */
final class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        $env = $this->loadEnv(dirname(__DIR__) . '/.env');

        $host    = $env['DB_HOST']    ?? '127.0.0.1';
        $port    = $env['DB_PORT']    ?? '3306';
        $name    = $env['DB_NAME']    ?? '';
        $user    = $env['DB_USER']    ?? '';
        $pass    = $env['DB_PASS']    ?? '';
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
            $this->writeLog('Database::__construct', $e->getMessage());
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

    /**
     * Parser de .env minimalista (sin dependencias externas).
     * Soporta: KEY=VALUE, KEY="VALUE", # comentarios, líneas vacías.
     *
     * @return array<string, string>
     */
    private function loadEnv(string $path): array
    {
        if (!is_readable($path)) {
            $this->writeLog('Database::loadEnv', "Archivo .env no encontrado en: {$path}");
            throw new RuntimeException('Archivo de configuración no disponible.');
        }

        $env   = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }
            $key   = trim($parts[0]);
            $value = trim($parts[1], " \t\"'");
            $env[$key] = $value;
        }

        return $env;
    }

    /**
     * Escribe una línea en logs/error.log (nunca expone nada al navegador).
     * Formato: [YYYY-MM-DD HH:MM:SS][CRITICAL][endpoint] mensaje
     */
    public static function writeLog(string $endpoint, string $message): void
    {
        $logPath = dirname(__DIR__) . '/logs/error.log';
        $line    = sprintf(
            "[%s][CRITICAL][%s] %s\n",
            date('Y-m-d H:i:s'),
            $endpoint,
            $message
        );
        error_log($line, 3, $logPath);
    }

    /** Bloquea clonación y deserialización del Singleton. */
    private function __clone() {}
    public function __wakeup(): void
    {
        throw new RuntimeException('No se puede deserializar el Singleton Database.');
    }
}
