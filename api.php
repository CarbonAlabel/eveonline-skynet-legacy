<?php
require "includes/configApi.php";
try{
	if(!api::$endpointExists){
		//404 if endpoint doesn't exist
		http_response_code(404);
		exit;
	}
	if(api::$requestMethod=="OPTIONS"){
		//Always respond to value OPTIONS request
		header("Allow: ".implode(", ",api::$endpointAccepts));
		exit;
	}
	if(!in_array(api::$requestMethod,api::$endpointAccepts)){
		//405 if method isn't supported
		header("Allow: ".implode(", ",api::$endpointAccepts));
		http_response_code(405);
		exit;
	}
	foreach(api::$endpointRequires as $name){
		require_once "includes/$name.php";
	}
	require "api/".api::$endpointName."/".strtolower(api::$requestMethod).".php";
}catch(AuthException $e){
	comm::responseAdd("authErrors",auth::getErrors());
	comm::respondError($e,401);
}catch(ExternalException $e){
	comm::respondError($e,500);
}catch(InputException $e){
	comm::respondError($e,400);
}catch(PDOException $e){
	comm::respondError($e,500);
}catch(Exception $e){
	comm::respondError($e,500);
}catch(Error $e){
	comm::respondError($e,500);
}