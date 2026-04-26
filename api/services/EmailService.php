<?php

declare(strict_types=1);

/**
 * EmailService — Notificaciones automáticas de reservas.
 *
 * Resiliencia local: si mail() falla (localhost sin SMTP), el contenido completo
 * del correo se escribe en logs/emails.log para verificación manual.
 * Un fallo aquí NUNCA interrumpe el flujo de confirmación de pago.
 */
class EmailService
{
    private \PDO $pdo;
    private string $logPath;
    private string $frontendUrl;

    public function __construct(\PDO $pdo)
    {
        $this->pdo         = $pdo;
        $this->logPath     = dirname(__DIR__, 2) . '/logs/emails.log';
        $this->frontendUrl = $this->readEnvKey('FRONTEND_URL', 'http://localhost:3000');
    }

    // ── API pública ─────────────────────────────────────────────

    /**
     * Envía el recibo HTML al cliente. Registra en log si falla.
     * @param array<string,mixed> $data
     */
    public function sendBookingConfirmation(array $data): void
    {
        $to      = (string) ($data['customer_email'] ?? '');
        $name    = (string) ($data['customer_name']  ?? '');
        $exp     = (string) ($data['expedition_name'] ?? 'tu expedición');
        $subject = "¡Tu reserva está confirmada! - Pegaso Expediciones";
        $html    = $this->buildReceiptHtml($data);

        $this->dispatch($to, $name, $subject, $html, 'sendBookingConfirmation');
    }

    /**
     * Envía alerta a todos los admins listados en system_settings.admin_notification_emails.
     * @param array<string,mixed> $data
     */
    public function sendAdminAlert(array $data): void
    {
        $emails = $this->getAdminEmails();
        if ($emails === []) {
            $this->writeLog('sendAdminAlert', 'Sin emails de admin configurados. Saltando.', null, null);
            return;
        }

        $exp     = (string) ($data['expedition_name'] ?? '?');
        $subject = "🚨 NUEVA RESERVA PAGADA - {$exp}";
        $html    = $this->buildAdminAlertHtml($data);

        foreach ($emails as $email) {
            $this->dispatch($email, 'Equipo Pegaso', $subject, $html, 'sendAdminAlert');
        }
    }

    // ── Despacho con fallback a log ─────────────────────────────

    private function dispatch(string $to, string $toName, string $subject, string $html, string $context): void
    {
        if ($to === '' || filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            $this->writeLog($context, "Email inválido: {$to}", null, null);
            return;
        }

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: Pegaso Expediciones <no-reply@pegasoexpediciones.com>\r\n";
        $headers .= "X-Mailer: PegasoMailer/1.0\r\n";

        $sent = false;
        try {
            $sent = @mail($to, $subject, $html, $headers);
        } catch (\Throwable $e) {
            // mail() puede lanzar en configuraciones restrictivas
        }

        if (!$sent) {
            $this->writeLog($context, "mail() falló o está deshabilitado — volcando al log", $to, $html);
        } else {
            $this->writeLog($context, "Email enviado exitosamente a {$to}", null, null);
        }
    }

    // ── Templates HTML ──────────────────────────────────────────

    /** @param array<string,mixed> $d */
    private function buildReceiptHtml(array $d): string
    {
        $name      = htmlspecialchars((string) ($d['customer_name']         ?? ''), ENT_QUOTES);
        $exp       = htmlspecialchars((string) ($d['expedition_name']       ?? ''), ENT_QUOTES);
        $date      = htmlspecialchars((string) ($d['departure_date']        ?? ''), ENT_QUOTES);
        $rawTime   = trim((string) ($d['departure_time'] ?? ''));
        $time      = $rawTime !== '' ? htmlspecialchars($rawTime, ENT_QUOTES) : 'Por confirmar';
        $spots     = (int) ($d['num_spots']   ?? 1);
        $total     = htmlspecialchars((string) ($d['total_amount']          ?? '0.00'), ENT_QUOTES);
        $txId      = htmlspecialchars((string) ($d['paypal_transaction_id'] ?? ''), ENT_QUOTES);
        $createdAt = htmlspecialchars((string) ($d['created_at']            ?? ''), ENT_QUOTES);

        $spotLabel = $spots === 1 ? '1 persona' : "{$spots} personas";

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmación de Reserva</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#f26d52 0%,#e05a40 100%);padding:40px 40px 32px;text-align:center;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center">
              <div style="display:inline-block;background:rgba(255,255,255,.2);border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:16px;">📍</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Pegaso Expediciones</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:15px;">¡Tu reserva está confirmada! 🎉</p>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:36px 40px 0;">
          <p style="margin:0;font-size:16px;color:#0f0200;">Hola <strong>{$name}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#4c4c4c;line-height:1.6;">¡Gracias por tu compra! Tu pago fue procesado exitosamente a través de PayPal. Aquí está el resumen de tu aventura:</p>
        </td>
      </tr>

      <!-- Booking card -->
      <tr>
        <td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#fcfaf5;border-radius:12px;border:1px solid #ede8df;overflow:hidden;">
            <tr>
              <td colspan="2" style="background:#f26d52;padding:14px 20px;">
                <p style="margin:0;color:#fff;font-size:17px;font-weight:700;">{$exp}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#4c4c4c;font-size:13px;">Fecha de salida</td>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$date}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#4c4c4c;font-size:13px;">Hora de salida</td>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$time}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#4c4c4c;font-size:13px;">Personas</td>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$spotLabel}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#4c4c4c;font-size:13px;">ID de transacción PayPal</td>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#0f0200;font-size:11px;font-weight:700;text-align:right;word-break:break-all;">{$txId}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#4c4c4c;font-size:13px;">Fecha de reserva</td>
              <td style="padding:14px 20px;border-bottom:1px solid #ede8df;color:#0f0200;font-size:13px;text-align:right;">{$createdAt}</td>
            </tr>
            <tr style="background:#fff8f7;">
              <td style="padding:18px 20px;color:#0f0200;font-size:15px;font-weight:700;">Total pagado</td>
              <td style="padding:18px 20px;color:#f26d52;font-size:22px;font-weight:700;text-align:right;">\${$total} MXN</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Next steps -->
      <tr>
        <td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;padding:20px;">
            <tr>
              <td>
                <p style="margin:0;font-size:14px;font-weight:700;color:#14532d;">✅ Prepárate para la aventura</p>
                <ul style="margin:10px 0 0;padding-left:18px;color:#166534;font-size:13px;line-height:1.9;">
                  <li>Nos pondremos en contacto contigo pronto con los detalles del punto de encuentro.</li>
                  <li>Recuerda llegar <strong>15 minutos antes</strong> de tu hora de salida.</li>
                  <li>Trae <strong>bloqueador solar biodegradable</strong> (obligatorio para proteger el ecosistema).</li>
                  <li>Lleva ropa cómoda y equipo adecuado para la actividad.</li>
                  <li>¿Dudas? Contáctanos por WhatsApp al número que te compartiremos.</li>
                </ul>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#fcfaf5;padding:24px 40px;text-align:center;border-top:1px solid #ede8df;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Pegaso Expediciones · La Paz, BCS, México</p>
          <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Este correo fue generado automáticamente. Por favor no respondas a este mensaje.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
    }

    /** @param array<string,mixed> $d */
    private function buildAdminAlertHtml(array $d): string
    {
        $name     = htmlspecialchars((string) ($d['customer_name']         ?? ''), ENT_QUOTES);
        $email    = htmlspecialchars((string) ($d['customer_email']        ?? ''), ENT_QUOTES);
        $phone    = htmlspecialchars((string) ($d['customer_phone']        ?? ''), ENT_QUOTES);
        $exp      = htmlspecialchars((string) ($d['expedition_name']       ?? ''), ENT_QUOTES);
        $date     = htmlspecialchars((string) ($d['departure_date']        ?? ''), ENT_QUOTES);
        $rawTime  = trim((string) ($d['departure_time'] ?? ''));
        $time     = $rawTime !== '' ? htmlspecialchars($rawTime, ENT_QUOTES) : 'Por asignar';
        $spots    = (int) ($d['num_spots']   ?? 1);
        $total    = htmlspecialchars((string) ($d['total_amount']          ?? '0.00'), ENT_QUOTES);
        $txId     = htmlspecialchars((string) ($d['paypal_transaction_id'] ?? ''), ENT_QUOTES);

        $dashboardUrl = htmlspecialchars(rtrim($this->frontendUrl, '/') . '/admin/login', ENT_QUOTES);
        $phoneRow     = $phone !== ''
            ? "<tr><td style=\"padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;\">WhatsApp / Teléfono</td>
               <td style=\"padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;\">{$phone}</td></tr>"
            : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nueva Reserva Pagada</title></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:24px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

      <!-- Header -->
      <tr>
        <td style="background:#0f0200;padding:28px 32px;">
          <p style="margin:0;color:#f26d52;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Pegaso · Sistema de Reservas</p>
          <h2 style="margin:8px 0 0;color:#ffffff;font-size:22px;">🚨 Nueva reserva pagada</h2>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.6);font-size:13px;">{$exp}</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 32px;">

          <!-- Datos del cliente -->
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Datos del Cliente</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Nombre</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$name}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Email</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;text-align:right;">{$email}</td>
            </tr>
            {$phoneRow}
          </table>

          <!-- Detalles de compra -->
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Detalles de Compra</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Expedición</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$exp}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Fecha de salida</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$date}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Hora de salida</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$time}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">Lugares</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:13px;font-weight:700;text-align:right;">{$spots}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">TX PayPal</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#0f0200;font-size:11px;text-align:right;word-break:break-all;">{$txId}</td>
            </tr>
            <tr style="background:#fff8f7;">
              <td style="padding:16px 0;color:#0f0200;font-size:15px;font-weight:700;">Monto Total</td>
              <td style="padding:16px 0;color:#f26d52;font-size:22px;font-weight:700;text-align:right;">\${$total} MXN</td>
            </tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:8px 0 4px;">
                <a href="{$dashboardUrl}"
                   style="display:inline-block;background:#f26d52;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
                  Ver detalles en el Dashboard →
                </a>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#fcfaf5;padding:16px 32px;text-align:center;border-top:1px solid #ede8df;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Notificación automática · Pegaso Expediciones</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
    }

    // ── Helpers ─────────────────────────────────────────────────

    /** @return string[] */
    private function getAdminEmails(): array
    {
        try {
            $stmt = $this->pdo->prepare(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'admin_notification_emails'"
            );
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row === false || trim((string) $row['setting_value']) === '') {
                return [];
            }
            return array_values(array_filter(
                array_map('trim', explode(',', $row['setting_value'])),
                static fn(string $e): bool => filter_var($e, FILTER_VALIDATE_EMAIL) !== false
            ));
        } catch (\Throwable) {
            return [];
        }
    }

    private function readEnvKey(string $key, string $default = ''): string
    {
        $path = dirname(__DIR__, 2) . '/.env';
        if (!is_readable($path)) {
            return $default;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return $default;
        }
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false || $pos === 0) {
                continue;
            }
            $k = trim(substr($line, 0, $pos));
            if ($k !== $key) {
                continue;
            }
            $v   = trim(substr($line, $pos + 1));
            $len = strlen($v);
            if ($len >= 2 && (($v[0] === '"' && $v[$len - 1] === '"') || ($v[0] === "'" && $v[$len - 1] === "'"))) {
                $v = substr($v, 1, $len - 2);
            }
            return $v;
        }
        return $default;
    }

    private function writeLog(string $context, string $message, ?string $to, ?string $htmlBody): void
    {
        $logDir = dirname($this->logPath);
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }

        $separator = str_repeat('─', 70);
        $entry     = "\n{$separator}\n";
        $entry    .= sprintf("[%s][EmailService::%s]\n", date('Y-m-d H:i:s'), $context);
        $entry    .= "MSG: {$message}\n";
        if ($to !== null) {
            $entry .= "TO:  {$to}\n";
        }
        if ($htmlBody !== null) {
            $entry .= "--- HTML BODY START ---\n{$htmlBody}\n--- HTML BODY END ---\n";
        }
        $entry .= "{$separator}\n";

        @error_log($entry, 3, $this->logPath);
    }
}
