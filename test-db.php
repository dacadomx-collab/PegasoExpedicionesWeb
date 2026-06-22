<?php
// ============================================================
// PEGASO EXPEDICIONES — Database Connection Tester
// Usage: Local only (XAMPP). Never deploy to production.
// ============================================================

// Output buffer opened at the absolute top so that any stray PHP
// Notice/Warning (e.g. from PDO internals or php.ini deprecations)
// is captured and discarded before JSON is emitted.
ob_start();

// Shutdown safety net: converts fatal errors to JSON instead of HTML.
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        ob_clean();
        if (!headers_sent()) {
            header('Content-Type: application/json');
        }
        echo json_encode([
            'success' => false,
            'message' => '❌ PHP Fatal Error — shutdown intercepted',
            'detail'  => "[{$err['type']}] {$err['message']} in {$err['file']}:{$err['line']}",
        ]);
    }
});

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'test') {

    // Every exit path goes through this closure so ob_clean() is never missed.
    $jsonExit = function (array $payload) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode($payload);
        exit;
    };

    // ── Input ─────────────────────────────────────────────────────────
    $host   = trim($_POST['host']     ?? 'localhost');
    $dbname = trim($_POST['dbname']   ?? 'pegaso_web_services_DB');
    $user   = trim($_POST['username'] ?? 'pegaso_user_db');
    $pass   = $_POST['password'] ?? '';

    if (empty($pass)) {
        $jsonExit(['success' => false, 'message' => 'Password is required.']);
    }

    if (!class_exists('PDO')) {
        $jsonExit(['success' => false, 'message' => 'PDO extension is not enabled in PHP. Check php.ini for extension=pdo_mysql.']);
    }

    // ── Detect local vs remote context ────────────────────────────────
    $isLocalhost = in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true);

    $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT            => 5,
        ]);

        $serverVersion = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
        $driverName    = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        $stmt   = $pdo->query('SHOW TABLES');
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $tableInfo = [];
        foreach ($tables as $table) {
            try {
                $count = $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
                $tableInfo[] = ['name' => $table, 'rows' => (int)$count];
            } catch (PDOException $inner) {
                $tableInfo[] = ['name' => $table, 'rows' => 'ERR: ' . $inner->getMessage()];
            }
        }

        $jsonExit([
            'success'       => true,
            'message'       => '🟢 DATABASE CONNECTION SUCCESSFUL',
            'host'          => $host,
            'dbname'        => $dbname,
            'user'          => $user,
            'driver'        => strtoupper($driverName),
            'serverVersion' => $serverVersion,
            'tableCount'    => count($tables),
            'tables'        => $tableInfo,
        ]);

    } catch (PDOException $e) {
        $code   = (int) $e->getCode();
        $errMsg = $e->getMessage();

        // Code 2002: connection refused — add context-aware XAMPP hint
        $hints = [
            1045 => 'Error 1045 — Access denied. Wrong username or password for this host.',
            1049 => 'Error 1049 — Unknown database. The database name does not exist on this server.',
            1044 => 'Error 1044 — Access denied. The user exists but has no privileges on this database.',
            2002 => $isLocalhost
                ? 'Error 2002 — localhost refused the connection. Your XAMPP MySQL service is NOT running. '
                  . 'Open the XAMPP Control Panel and click "Start" next to MySQL before retrying. '
                  . 'If MySQL is already started, check that it is listening on port 3306 (not 3307).'
                : 'Error 2002 — Remote host refused the connection. Verify the GreenGeeks MySQL hostname '
                  . '(usually "localhost" when PHP runs on the same server, or a specific remote host string). '
                  . 'Remote MySQL access may also be blocked by cPanel firewall rules.',
            2003 => 'Error 2003 — Cannot connect to host. Verify the hostname/IP and that port 3306 is open.',
            2005 => 'Error 2005 — Unknown MySQL server host. The hostname does not resolve to any IP address.',
        ];

        $jsonExit([
            'success'     => false,
            'message'     => "❌ PDO CONNECTION FAILED — Code {$code}",
            'host'        => $host,
            'isLocalhost' => $isLocalhost,
            'dbname'      => $dbname,
            'user'        => $user,
            'code'        => $code,
            'error'       => $errMsg,
            'hint'        => $hints[$code] ?? 'Unclassified error. Check host, credentials, and that the MySQL service is running.',
        ]);

    } catch (Throwable $e) {
        // Catches non-PDO exceptions (e.g. Error from PHP internals)
        $jsonExit([
            'success' => false,
            'message' => '❌ Unexpected PHP exception — not a PDO error.',
            'detail'  => get_class($e) . ': ' . $e->getMessage(),
            'file'    => basename($e->getFile()) . ':' . $e->getLine(),
        ]);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DB Connection Tester — Pegaso Expediciones</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }

        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 2.5rem;
            width: 100%;
            max-width: 620px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }

        .badge {
            display: inline-block;
            background: #8b5cf6;
            color: #fff;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            padding: 3px 10px;
            border-radius: 99px;
            margin-bottom: 1rem;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #f1f5f9;
            margin-bottom: 0.35rem;
        }

        .subtitle {
            font-size: 0.85rem;
            color: #64748b;
            margin-bottom: 2rem;
        }

        .field { margin-bottom: 1.25rem; }

        label {
            display: block;
            font-size: 0.8rem;
            font-weight: 600;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
        }

        input {
            width: 100%;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: #f1f5f9;
            font-size: 0.95rem;
            transition: border-color 0.2s;
        }

        input:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
        }

        input[readonly] {
            color: #475569;
            cursor: not-allowed;
        }

        .field-group {
            display: flex;
            gap: 0.75rem;
        }

        .field-group .field { flex: 1; margin-bottom: 0; }

        button[type="submit"] {
            width: 100%;
            padding: 0.875rem;
            background: #8b5cf6;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            margin-top: 0.5rem;
        }

        button[type="submit"]:hover { background: #7c3aed; }
        button[type="submit"]:active { transform: scale(0.98); }
        button[type="submit"]:disabled { background: #334155; color: #64748b; cursor: not-allowed; }

        #result {
            margin-top: 1.75rem;
            display: none;
        }

        .result-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 10px;
            overflow: hidden;
        }

        .result-header {
            padding: 0.75rem 1.25rem;
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-bottom: 1px solid #1e293b;
        }

        .result-header.success { background: rgba(16,185,129,0.15); color: #10b981; }
        .result-header.error   { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .result-header.loading { background: rgba(139,92,246,0.1);  color: #8b5cf6; }

        .result-body { padding: 1.25rem; }

        .result-row {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            font-size: 0.875rem;
            align-items: flex-start;
        }

        .result-row:last-child { margin-bottom: 0; }

        .result-key {
            color: #64748b;
            font-weight: 600;
            min-width: 110px;
            flex-shrink: 0;
        }

        .result-val { color: #e2e8f0; word-break: break-all; }
        .result-val.ok  { color: #10b981; font-weight: 700; }
        .result-val.err { color: #ef4444; font-weight: 700; }
        .result-val.warn { color: #f59e0b; font-weight: 600; }

        .table-grid {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Cascadia Code', 'Fira Mono', monospace;
            font-size: 0.8rem;
        }

        .table-grid th {
            text-align: left;
            padding: 0.5rem 0.75rem;
            background: #1e293b;
            color: #64748b;
            font-weight: 600;
            border-bottom: 1px solid #334155;
        }

        .table-grid td {
            padding: 0.5rem 0.75rem;
            color: #94a3b8;
            border-bottom: 1px solid #1e293b;
        }

        .table-grid tr:last-child td { border-bottom: none; }
        .table-grid tr:hover td { background: rgba(139,92,246,0.05); }
        .table-grid td:first-child { color: #c4b5fd; }

        .table-wrapper {
            background: #0a0f1e;
            border: 1px solid #334155;
            border-radius: 6px;
            overflow: hidden;
            max-height: 260px;
            overflow-y: auto;
        }

        .hint-box {
            background: rgba(245,158,11,0.1);
            border: 1px solid rgba(245,158,11,0.3);
            border-radius: 6px;
            padding: 0.75rem 1rem;
            font-size: 0.82rem;
            color: #fbbf24;
            margin-top: 0.75rem;
        }

        .spinner {
            display: inline-block;
            width: 14px; height: 14px;
            border: 2px solid #334155;
            border-top-color: #8b5cf6;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            vertical-align: middle;
            margin-right: 0.5rem;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .info-note {
            background: rgba(14,165,233,0.08);
            border: 1px solid rgba(14,165,233,0.2);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.8rem;
            color: #7dd3fc;
            margin-bottom: 1.5rem;
        }
    </style>
</head>
<body>
<div class="card">
    <span class="badge">DevOps Tool</span>
    <h1>Database Connection Tester</h1>
    <p class="subtitle">pegasoexpediciones.com &mdash; MySQL via PDO</p>

    <div class="info-note">
        For <strong>local XAMPP</strong> use <code>localhost</code>. For <strong>GreenGeeks remote</strong>, enter the server IP or MySQL hostname from cPanel.
    </div>

    <form id="dbForm">
        <div class="field-group">
            <div class="field">
                <label>Host</label>
                <input type="text" name="host" id="host" value="localhost" placeholder="localhost or server IP">
            </div>
            <div class="field" style="max-width:130px;">
                <label>Port</label>
                <input type="text" value="3306" readonly>
            </div>
        </div>

        <div class="field" style="margin-top:1.25rem;">
            <label>Database Name</label>
            <input type="text" name="dbname" value="pegaso_web_services_DB" readonly>
        </div>

        <div class="field">
            <label>DB Username</label>
            <input type="text" name="username" value="pegaso_user_db" readonly>
        </div>

        <div class="field">
            <label>DB Password</label>
            <input type="password" name="password" id="password" placeholder="Paste your database password here" autocomplete="off">
        </div>

        <button type="submit" id="submitBtn">Test Database Connection</button>
    </form>

    <div id="result"></div>
</div>

<script>
document.getElementById('dbForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const btn      = document.getElementById('submitBtn');
    const resultEl = document.getElementById('result');
    const pass     = document.getElementById('password').value;
    const host     = document.getElementById('host').value.trim() || 'localhost';

    if (!pass) {
        showError(resultEl, 'Please enter the database password before testing.');
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Connecting…';
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
        <div class="result-box">
            <div class="result-header loading"><span class="spinner"></span>Attempting PDO connection…</div>
            <div class="result-body">
                <div class="result-row">
                    <span class="result-key">Host</span>
                    <span class="result-val">${escHtml(host)}:3306</span>
                </div>
                <div class="result-row">
                    <span class="result-key">Status</span>
                    <span class="result-val">Sending credentials…</span>
                </div>
            </div>
        </div>`;

    const formData = new FormData(this);
    formData.append('action', 'test');

    fetch(window.location.pathname, { method: 'POST', body: new URLSearchParams(formData) })
        .then(r => r.json())
        .then(data => renderResult(resultEl, data))
        .catch(err => showError(resultEl, 'fetch() failed: ' + err.message))
        .finally(() => {
            btn.disabled    = false;
            btn.textContent = 'Test Database Connection';
        });
});

function renderResult(el, d) {
    if (d.success) {
        const tableRows = (d.tables || []).length
            ? d.tables.map(t => `<tr><td>${escHtml(t.name)}</td><td>${escHtml(String(t.rows))}</td></tr>`).join('')
            : '<tr><td colspan="2" style="color:#475569;font-style:italic;">No tables found in this database.</td></tr>';

        el.innerHTML = `
            <div class="result-box">
                <div class="result-header success">${escHtml(d.message)}</div>
                <div class="result-body">
                    <div class="result-row">
                        <span class="result-key">Host</span>
                        <span class="result-val">${escHtml(d.host)}:3306</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">Database</span>
                        <span class="result-val ok">${escHtml(d.dbname)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">User</span>
                        <span class="result-val ok">${escHtml(d.user)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">Driver</span>
                        <span class="result-val">${escHtml(d.driver)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">MySQL Ver.</span>
                        <span class="result-val">${escHtml(d.serverVersion)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">Tables Found</span>
                        <span class="result-val ok">${escHtml(String(d.tableCount))}</span>
                    </div>
                    <div class="result-row" style="flex-direction:column;gap:0.5rem;">
                        <span class="result-key">Table List (SHOW TABLES)</span>
                        <div class="table-wrapper">
                            <table class="table-grid">
                                <thead><tr><th>Table Name</th><th>Row Count</th></tr></thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
    } else {
        el.innerHTML = `
            <div class="result-box">
                <div class="result-header error">${escHtml(d.message)}</div>
                <div class="result-body">
                    ${d.host   ? `<div class="result-row"><span class="result-key">Host</span><span class="result-val">${escHtml(d.host)}:3306</span></div>` : ''}
                    ${d.dbname ? `<div class="result-row"><span class="result-key">Database</span><span class="result-val err">${escHtml(d.dbname)}</span></div>` : ''}
                    ${d.user   ? `<div class="result-row"><span class="result-key">User</span><span class="result-val err">${escHtml(d.user)}</span></div>` : ''}
                    ${d.code   ? `<div class="result-row"><span class="result-key">Error Code</span><span class="result-val err">${escHtml(String(d.code))}</span></div>` : ''}
                    <div class="result-row">
                        <span class="result-key">PDO Error</span>
                        <span class="result-val err">${escHtml(d.error || 'No detail available.')}</span>
                    </div>
                    ${d.hint ? `<div class="hint-box">💡 ${escHtml(d.hint)}</div>` : ''}
                </div>
            </div>`;
    }
}

function showError(el, msg) {
    el.style.display = 'block';
    el.innerHTML = `
        <div class="result-box">
            <div class="result-header error">❌ Client Error</div>
            <div class="result-body">
                <div class="result-row"><span class="result-key">Detail</span><span class="result-val err">${escHtml(msg)}</span></div>
            </div>
        </div>`;
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>
