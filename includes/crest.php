<?php

function getProperAccessToken(int $userID):string{
	$query1=sql::get()->prepare("SELECT `accessToken`,`refreshToken`,IF(`validUntil`<DATE_ADD(NOW(),INTERVAL 90 SECOND),1,0) AS `needsRefreshing` FROM `usertokens` WHERE `userID`=?");
	$query1->execute([$userID]);
	$result1=$query1->fetch();
	
	if($result1->needsRefreshing){
		$request1=curl_init(EVE_SSO_ROOT."/oauth/token");
		curl_setopt_array($request1,[
			CURLOPT_USERAGENT     =>EVE_APP_USER_AGENT,
			CURLOPT_RETURNTRANSFER=>true,
			CURLOPT_HTTPHEADER    =>["Authorization: Basic ".EVE_APP_AUTH],
			CURLOPT_POST          =>true,
			CURLOPT_POSTFIELDS    =>"grant_type=refresh_token&refresh_token=".urlencode($result1->refreshToken)]);
		$response1=curl_exec($request1);
		if(curl_error($request1)){
			throw new ExternalException(curl_error($request1));
		}
		$response1=json_decode($response1);
		if(!$response1->access_token){
			throw new ExternalException("SSO service hasn't properly responded.");
		}
		
		$query2=sql::get()->prepare("UPDATE `usertokens` SET `accessToken`=?,`validUntil`=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE `userID`=?");
		$query2->execute([$response1->access_token,$response1->expires_in,$userID]);
	}
	return $result1->needsRefreshing?$response1->access_token:$result1->accessToken;
}