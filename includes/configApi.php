<?php

class api{
	public static $requestMethod;
	public static $endpointName;
	public static $endpointExists;
	public static $endpointAccepts;
	public static $endpointRequires;
	
	private static $parametersList;
	
	private static $endpointAcceptsList=[
		"session"  =>["DELETE","POST"],
		"token"     =>["GET"]
	];
	private static $endpointRequiresList=[
		"session"  =>["basic"],
		"token"     =>["basic","crest"]
	];
	
	public static function initialize(){
		self::$requestMethod=$_SERVER["REQUEST_METHOD"]=="HEAD"?"GET":$_SERVER["REQUEST_METHOD"];
		self::$parametersList=explode("/",$_GET["p"] ?? "");
		self::$endpointName=$_GET["e"] ?? "";
		self::$endpointExists=isset(self::$endpointAcceptsList[self::$endpointName]);
		self::$endpointAccepts=self::$endpointAcceptsList[self::$endpointName];
		self::$endpointRequires=self::$endpointRequiresList[self::$endpointName];
	}
	
	public static function parameter(int $index=0){
		if(!self::$parametersList || !isset(self::$parametersList[$index])){
			return false;
		}
		return self::$parametersList[$index];
	}
}
api::initialize();