<?php
// --- Saneamiento de entradas: elimina CR/LF para impedir inyección de cabeceras SMTP ---
function clean_header_value(string $value): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $value));
}

$fname   = clean_header_value($_POST['fname'] ?? '');
$phone   = clean_header_value($_POST['phone'] ?? '');
$email   = clean_header_value($_POST['email'] ?? '');
$subject = clean_header_value($_POST['subject'] ?? '');
$message = htmlspecialchars($_POST['msg'] ?? '', ENT_QUOTES, 'UTF-8');

if ($fname !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $to_email = "dacadomx@yahoo.com";
    $email_subject = $fname . " has a Query from PEGASO WEB";
    $vpb_message_body = nl2br("Dear Dany,\n
    A person interested in your services has sent this message \n
    from " . $_SERVER['HTTP_HOST'] . " dated " . date('d-m-Y') . ".\n

    FirstName: " . $fname . "\n
    Phone: " . $phone . "\n
    Email Address: " . $email . "\n
    Subject: " . $subject . "\n
    Message: " . $message . "\n

    Make The Deal!\n\n");

    // Cabeceras de correo: solo valores saneados, sin datos de usuario en Cc/Bcc
    $headers  = "From: no-reply@pegasoexpediciones.com\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "Message-ID: <" . time() . rand(1, 1000) . "@" . $_SERVER['SERVER_NAME'] . ">\r\n";
    $headers .= "Reply-To: <" . $email . ">\r\n";

    if (@mail($to_email, $email_subject, $vpb_message_body, $headers)) {
        $status = 'Success';
        $output = "Congrats " . $fname . ", Thank you for your inquiry. Our sales team has been notified and will be in touch shortly.";
    } else {
        $status = 'error';
        $output = "Sorry, your email could not be sent at the moment. Please try again or contact this website admin to report this error message if the problem persist. Thanks.";
    }
} else {
    $status = 'error';
    $output = "please fill require fields";
}

echo json_encode(array('status' => $status, 'msg' => $output));
