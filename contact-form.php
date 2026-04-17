<?php
$fname= $_POST['fname'];
$phone= $_POST['phone'];
$email= $_POST['email'];
$subject= $_POST['subject'];
$message= $_POST['msg'];

if(isset($fname) && isset($email))
{
	global $to_email,$vpb_message_body,$headers;
	$to_email="dacadomx@yahoo.com";
	$email_subject= $fname . " has a Query from PEGASO WEB";
	$vpb_message_body = nl2br("Dear Dany,\n
	A person interested in your services has sent this message \n
	from ".$_SERVER['HTTP_HOST']." dated ".date('d-m-Y').".\n
	
	FirstName: ".$fname."\n
	Phone: ".$phone."\n
	Email Address: ".$email."\n
	Subject: ".$subject."\n
	Message: ".$message."\n
	
	Make The Deal!\n\n");
	
	//Set up the email headers
    $headers  = "From: no-reply@pegasoexpediciones.com\r\n";
    $headers .= "Content-type: text/html; charset=iso-8859-1\r\n";
    $headers .= "Message-ID: <".time().rand(1,1000)."@".$_SERVER['SERVER_NAME'].">". "\r\n"; 
	$headers .= "Reply-To: <".$_REQUEST['con_email'].">" . "\r\n";
	$headers .= "Cc: ".$_REQUEST['con_email'] . "\r\n";


	 if(@mail($to_email, $email_subject, $vpb_message_body, $headers))
		{
			  $status='Success';
			//Displays the success message when email message is sent
			  $output="Congrats ".$fname.", Thank you for your inquiry. Our sales team has been notified and will be in touch shortly.";
		} 
		else 
		{
			 $status='error';
			 //Displays an error message when email sending fails
			  $output="Sorry, your email could not be sent at the moment. Please try again or contact this website admin to report this error message if the problem persist. Thanks.";
		}
		
}
else{
	$status='error';
	$output="please fill require fields";
	
	}
echo json_encode(array('status'=> $status, 'msg'=>$output));

?>