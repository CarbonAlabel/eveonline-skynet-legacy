<?php
if(!isset($_GET["code"])){
	include "../includes/configApp.php";
	http_response_code(307);
	header("Location: ".EVE_SSO_ROOT."/oauth/authorize?".
		"response_type=code&".
		"redirect_uri=".EVE_APP_CALLBACK_URL_ESCAPED."&".
		"scope=fleetRead+fleetWrite+characterLocationRead&".
		"client_id=".EVE_APP_ID);
	exit;
}
?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>TAABE Skynet Login</title>
	<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.3/angular.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/ngStorage/0.3.10/ngStorage.min.js"></script>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700">
	<link rel="stylesheet" href="login.css">
	<script src="login.js"></script>
</head>
<body ng-app="skynetLogin">
<div id="bg"></div>
<div id="cont" ng-controller="login">
	<h1><span ng-bind="title"></span><span id="dots" ng-show="dots">...</span></h1>
	<p ng-bind="desc"></p>
	<p><a ng-href="{{href}}" ng-bind="link"></a></p>
	<pre ng-bind="info"></pre>
</div>
</body>
</html>