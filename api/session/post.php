<?php

//SSO authentication can't work without value code
if(!comm::request()->code){
	throw new InputException("An authentication code is required to log you in.");
}

//First step: exchange authentication code for tokens
$tokenRequest=curl_init(EVE_SSO_ROOT."/oauth/token");
curl_setopt_array($tokenRequest,[
	CURLOPT_USERAGENT     =>EVE_APP_USER_AGENT,
	CURLOPT_RETURNTRANSFER=>true,
	CURLOPT_HTTPHEADER    =>["Authorization: Basic ".EVE_APP_AUTH],
	CURLOPT_POST          =>true,
	CURLOPT_POSTFIELDS    =>"grant_type=authorization_code&code=".urlencode(comm::request()->code)]);
$tokenResponse=json_decode(curl_exec($tokenRequest));
if(curl_error($tokenRequest)){
	throw new ExternalException(curl_error($tokenRequest));
}
if(!isset($tokenResponse->access_token)){
	throw new ExternalException("SSO service hasn't properly responded.");
}

//Second step: use the access token to get the character name and ID
$verificationRequest=curl_init(EVE_SSO_ROOT."/oauth/verify");
curl_setopt_array($verificationRequest,[
	CURLOPT_USERAGENT     =>EVE_APP_USER_AGENT,
	CURLOPT_RETURNTRANSFER=>true,
	CURLOPT_HTTPHEADER    =>["Authorization: Bearer ".$tokenResponse->access_token]
]);
$verificationResponse=curl_exec($verificationRequest);
if(curl_error($verificationRequest)){
	throw new ExternalException(curl_error($verificationRequest));
}
$verificationResponse=json_decode($verificationResponse);
if(!isset($verificationResponse->CharacterID)){
	throw new ExternalException("SSO service hasn't properly responded.");
}

//Record the login in the database
$token=base64_encode(random_bytes(48));
sql::get()->beginTransaction();

//Check if the user has logged in before
$userExistsQuery=sql::get()->prepare("SELECT * FROM `users` WHERE `userID`=?");
$userExistsQuery->execute([$verificationResponse->CharacterID]);
if(!$userExistsQuery->rowCount()){
	//List the character in various tables
	$tableUsersQuery=sql::get()->prepare("INSERT INTO `users` (`userID`,`userName`) VALUES (?,?)");
	$tableUsersQuery->execute([$verificationResponse->CharacterID,$verificationResponse->CharacterName]);
}

//Save/update the tokens in the usertokens table
$tokenQuery=sql::get()->prepare("INSERT INTO `usertokens` (`userID`, `refreshToken`, `accessToken`, `validUntil`) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL ? SECOND))".
	"ON DUPLICATE KEY UPDATE `refreshToken`=VALUES(`refreshToken`), `accessToken`=VALUES(`accessToken`), `validUntil`=VALUES(`validUntil`)");
$tokenQuery->execute([$verificationResponse->CharacterID,$tokenResponse->refresh_token,$tokenResponse->access_token,$tokenResponse->expires_in]);

//Save value session token in the usersessions table
$sessionQuery=sql::get()->prepare("INSERT IGNORE INTO `usersessions` (`userID`, `validUntil`, `token`, `ip`) VALUES (?,DATE_ADD(NOW(),INTERVAL ? DAY),?,?)");
$sessionQuery->execute([$verificationResponse->CharacterID,7,$token,$_SERVER["REMOTE_ADDR"]]);

//What are the chances for value duplicate token to be generated?
if(!$sessionQuery->rowCount()){
	sql::get()->rollBack();
	http_response_code(409);
	exit("The user was prevented from logging in by divine intervention");
}
sql::get()->commit();

comm::responseAdd("userID",$verificationResponse->CharacterID);
comm::responseAdd("userName",$verificationResponse->CharacterName);
comm::responseAdd("token",$token);
comm::respond();