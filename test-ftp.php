<?php
// ============================================================
// PEGASO EXPEDICIONES — FTP Connection Tester
// Usage: Local only (XAMPP). Never deploy to production.
// ============================================================

// Output buffer MUST be opened before any code runs so that PHP
// Notices / Warnings emitted by the FTP extension are trapped and
// never reach the response body, which would corrupt JSON parsing.
ob_start();

// Global safety net: if anything fatal/unexpected leaks past our
// try/catch, this shutdown hook converts it to valid JSON instead
// of dumping an HTML error page.
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

    // Guarantee: every exit path calls ob_clean() before echoing JSON
    // so that stray PHP warnings captured in the buffer are discarded.
    $jsonExit = function (array $payload) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode($payload);
        exit;
    };

    // ── Input validation ──────────────────────────────────────────────
    $host = 'ftp.pegasoexpediciones.com';
    $port = 21;
    $user = trim($_POST['username'] ?? '');
    $pass = $_POST['password'] ?? '';

    if (empty($user) || empty($pass)) {
        $jsonExit(['success' => false, 'message' => 'Username and password are required.']);
    }

    if (!function_exists('ftp_connect')) {
        $jsonExit(['success' => false, 'message' => 'PHP FTP extension is not enabled. Add extension=ftp to php.ini and restart XAMPP.']);
    }

    // ── Single interceptor for ALL ftp_* warnings ─────────────────────
    // Installed once; covers connect, starttls, login, pasv, pwd, nlist.
    $warnings = [];
    set_error_handler(function ($errno, $errstr) use (&$warnings) {
        $warnings[] = "[E{$errno}] " . preg_replace('/\s+/', ' ', $errstr);
        return true; // suppress default PHP output
    });

    $conn    = null;
    $tlsNote = 'TLS not attempted.';

    try {
        // ftp_connect() uses a 10-second wall-clock timeout.
        // If port 21 is firewalled the call blocks for exactly that long,
        // then returns false — never throws, never dumps HTML.
        $conn = ftp_connect($host, $port, 10);

        if (!$conn) {
            restore_error_handler();
            $jsonExit([
                'success'  => false,
                'message'  => "❌ ftp_connect() failed — could not reach {$host}:{$port}",
                'detail'   => !empty($warnings) ? implode(' | ', $warnings) : 'Connection timed out or port 21 is blocked by a firewall.',
                'warnings' => $warnings,
                'host'     => $host,
                'port'     => $port,
                'user'     => $user,
            ]);
        }

        // FTPS Explicit (AUTH TLS) — GreenGeeks requires it.
        // ftp_starttls() may emit a warning if OpenSSL is not available;
        // that warning is now safely captured in $warnings[], not in output.
        $tls     = ftp_starttls($conn);
        $tlsNote = $tls
            ? 'AUTH TLS successful (FTPS Explicit).'
            : 'AUTH TLS failed — falling back to plain FTP. ' .
              'GreenGeeks may reject unencrypted connections. ' .
              (!empty($warnings) ? implode(' | ', $warnings) : '');

        // Clear warnings between stages so we can isolate login errors
        $loginWarnings = [];
        set_error_handler(function ($errno, $errstr) use (&$loginWarnings) {
            $loginWarnings[] = "[E{$errno}] " . preg_replace('/\s+/', ' ', $errstr);
            return true;
        });

        $login = ftp_login($conn, $user, $pass);
        restore_error_handler();

        if (!$login) {
            ftp_close($conn);
            $jsonExit([
                'success'  => false,
                'message'  => '❌ ftp_login() failed — Error 530: Login authentication failed.',
                'detail'   => !empty($loginWarnings) ? implode(' | ', $loginWarnings) : 'Incorrect username or password for this FTP account.',
                'tls'      => $tlsNote,
                'host'     => $host,
                'port'     => $port,
                'user'     => $user,
                'hint'     => 'In GreenGeeks cPanel → FTP Accounts, verify the password and that the account is not suspended.',
            ]);
        }

        // Passive mode is required when the PHP server is behind NAT/firewall.
        ftp_pasv($conn, true);

        $cwd   = ftp_pwd($conn);
        $files = ftp_nlist($conn, '.');

        ftp_close($conn);

        $jsonExit([
            'success'  => true,
            'message'  => '🟢 FTP CONNECTION SUCCESSFUL',
            'tls'      => $tlsNote,
            'host'     => $host,
            'port'     => $port,
            'user'     => $user,
            'cwd'      => $cwd !== false ? $cwd : '(ftp_pwd returned false — user may lack read permission on root)',
            'filelist' => $files !== false ? $files : [],
            'warnings' => array_merge($warnings, $loginWarnings),
        ]);

    } catch (Throwable $e) {
        // Catch any unexpected exception/error that the FTP extension
        // might throw in edge cases (some PHP versions differ).
        restore_error_handler();
        if ($conn) { @ftp_close($conn); }
        $jsonExit([
            'success' => false,
            'message' => '❌ Unexpected PHP exception during FTP sequence.',
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
    <title>FTP Connection Tester — Pegaso Expediciones</title>
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
            background: #0ea5e9;
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

        input, select {
            width: 100%;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: #f1f5f9;
            font-size: 0.95rem;
            transition: border-color 0.2s;
            appearance: none;
        }

        input:focus, select:focus {
            outline: none;
            border-color: #0ea5e9;
            box-shadow: 0 0 0 3px rgba(14,165,233,0.15);
        }

        select option { background: #1e293b; }

        .readonly-field {
            display: flex;
            gap: 0.75rem;
        }

        .readonly-field input {
            color: #475569;
            cursor: not-allowed;
        }

        .tag {
            display: inline-flex;
            align-items: center;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: #475569;
            font-size: 0.85rem;
            white-space: nowrap;
        }

        button[type="submit"] {
            width: 100%;
            padding: 0.875rem;
            background: #0ea5e9;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            margin-top: 0.5rem;
        }

        button[type="submit"]:hover { background: #0284c7; }
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
        .result-header.loading { background: rgba(14,165,233,0.1);  color: #0ea5e9; }

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

        .file-list {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 0.75rem 1rem;
            font-family: 'Cascadia Code', 'Fira Mono', monospace;
            font-size: 0.8rem;
            color: #94a3b8;
            max-height: 220px;
            overflow-y: auto;
            line-height: 1.8;
        }

        .spinner {
            display: inline-block;
            width: 14px; height: 14px;
            border: 2px solid #334155;
            border-top-color: #0ea5e9;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            vertical-align: middle;
            margin-right: 0.5rem;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
            border: none;
            border-top: 1px solid #334155;
            margin: 1.5rem 0;
        }
    </style>
</head>
<body>
<div class="card">
    <span class="badge">DevOps Tool</span>
    <h1>FTP Connection Tester</h1>
    <p class="subtitle">pegasoexpediciones.com &mdash; GreenGeeks Hosting &mdash; Port 21 / FTPS Explicit</p>

    <form id="ftpForm">
        <div class="field">
            <label>Host &amp; Port</label>
            <div class="readonly-field">
                <input type="text" value="ftp.pegasoexpediciones.com" readonly>
                <span class="tag">Port 21</span>
            </div>
        </div>

        <div class="field">
            <label>FTP Username</label>
            <select name="username" id="username">
                <option value="ftp_user@pegasoexpediciones.com">ftp_user@pegasoexpediciones.com</option>
                <option value="despliegue@pegasoexpediciones.com">despliegue@pegasoexpediciones.com</option>
            </select>
        </div>

        <div class="field">
            <label>FTP Password</label>
            <input type="password" name="password" id="password" placeholder="Paste your password here" autocomplete="off">
        </div>

        <button type="submit" id="submitBtn">Test FTP Connection</button>
    </form>

    <div id="result"></div>
</div>

<script>
document.getElementById('ftpForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const btn      = document.getElementById('submitBtn');
    const resultEl = document.getElementById('result');
    const pass     = document.getElementById('password').value;
    const user     = document.getElementById('username').value;

    if (!pass) {
        showError(resultEl, 'Please enter the password before testing.');
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Connecting…';
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
        <div class="result-box">
            <div class="result-header loading"><span class="spinner"></span>Attempting FTP connection…</div>
            <div class="result-body">
                <div class="result-row">
                    <span class="result-key">User</span>
                    <span class="result-val">${escHtml(user)}</span>
                </div>
                <div class="result-row">
                    <span class="result-key">Status</span>
                    <span class="result-val">Sending credentials to server…</span>
                </div>
            </div>
        </div>`;

    const body = new URLSearchParams({ action: 'test', username: user, password: pass });

    fetch(window.location.pathname, { method: 'POST', body })
        .then(r => r.json())
        .then(data => renderResult(resultEl, data))
        .catch(err => showError(resultEl, 'fetch() failed: ' + err.message))
        .finally(() => {
            btn.disabled    = false;
            btn.textContent = 'Test FTP Connection';
        });
});

function renderResult(el, d) {
    if (d.success) {
        const fileRows = (d.filelist || []).length
            ? d.filelist.map(f => escHtml(f)).join('\n')
            : '(empty directory or ftp_nlist returned no files)';

        el.innerHTML = `
            <div class="result-box">
                <div class="result-header success">${escHtml(d.message)}</div>
                <div class="result-body">
                    <div class="result-row">
                        <span class="result-key">Host</span>
                        <span class="result-val">${escHtml(d.host)}:${escHtml(String(d.port))}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">User</span>
                        <span class="result-val ok">${escHtml(d.user)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">TLS</span>
                        <span class="result-val">${escHtml(d.tls)}</span>
                    </div>
                    <div class="result-row">
                        <span class="result-key">Remote CWD</span>
                        <span class="result-val ok">${escHtml(d.cwd)}</span>
                    </div>
                    <div class="result-row" style="flex-direction:column;gap:0.5rem;">
                        <span class="result-key">Root File List</span>
                        <div class="file-list">${fileRows}</div>
                    </div>
                </div>
            </div>`;
    } else {
        el.innerHTML = `
            <div class="result-box">
                <div class="result-header error">${escHtml(d.message)}</div>
                <div class="result-body">
                    ${d.host ? `<div class="result-row"><span class="result-key">Host</span><span class="result-val">${escHtml(d.host)}:${escHtml(String(d.port))}</span></div>` : ''}
                    ${d.user ? `<div class="result-row"><span class="result-key">User</span><span class="result-val err">${escHtml(d.user)}</span></div>` : ''}
                    ${d.tls  ? `<div class="result-row"><span class="result-key">TLS</span><span class="result-val">${escHtml(d.tls)}</span></div>` : ''}
                    <div class="result-row">
                        <span class="result-key">PHP Error</span>
                        <span class="result-val err">${escHtml(d.detail || 'No further detail.')}</span>
                    </div>
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
