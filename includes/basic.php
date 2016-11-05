<?php
require_once "configApp.php";


class AuthException extends Exception{
}
class ExternalException extends Exception{
}
class InputException extends Exception{
}


class sql{
	private static $connection;

	private static function connect(){
		if(!isset(self::$connection)){
			$options=[PDO::ATTR_PERSISTENT        =>true,
					  PDO::ATTR_EMULATE_PREPARES  =>false,
					  PDO::ATTR_ERRMODE           =>PDO::ERRMODE_EXCEPTION,
					  PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_OBJ];
			self::$connection=new PDO("mysql:dbname=".MYSQL_DB_NAME.";host=".MYSQL_HOST_NAME,MYSQL_USER_NAME,MYSQL_PASSWORD,$options);
		}
	}
	
	public static function get():PDO{
		self::connect();
		return self::$connection;
	}

	public static function query(string $query,array $vars=[]):PDOStatement{
		if($vars){
			$statement=self::get()->prepare($query);
			$statement->execute($vars);
		}else{
			$statement=self::get()->query($query);
		}
		return $statement;
	}
}


class comm{
	private static $requestObject;
	private static $responseObject;

	public static function request(){
		if(!isset(self::$requestObject)){
			self::$requestObject=json_decode(file_get_contents("php://input"));
		}
		return self::$requestObject;
	}
	
	public static function responseAdd(string $name,$value){
		if(!isset(self::$responseObject)){
			self::$responseObject=new stdClass();
		}
		self::$responseObject->$name=$value;
	}
	
	public static function respond(int $statusCode=200){
		self::responseAdd("time",round((microtime(true)-$_SERVER["REQUEST_TIME_FLOAT"])*1000,1));
		http_response_code($statusCode);
		header("Content-type: application/json");
		echo json_encode(self::$responseObject);
		exit;
	}

	public static function respondError(Throwable $exception,int $statusCode=500){
		$errorObj=[
			"type"=>get_class($exception),
			"message"=>$exception->getMessage(),
			"code"=>$exception->getCode(),
		];
		self::responseAdd("error",$errorObj);
		self::respond($statusCode);
	}
}


class auth{
	private static $authErrors=0;
	public static function getErrors():int{
		return self::$authErrors;
	}

	private static $userID;
	private static $token;
	private static $code;

	private static $tokenValid=false;
	private static $codeValid=false;
	
	private static $authenticationInitialized=false;
	private static function authenticationInitialize(){
		if(self::$authenticationInitialized){
			return;
		}
		self::$userID=comm::request()->userID ?? $_SERVER["PHP_AUTH_USER"] ?? false;
		self::$token=comm::request()->token ?? $_SERVER["PHP_AUTH_PW"] ?? false;
		self::$code=comm::request()->code ?? false;
		if(self::$userID && self::$token){
			$tokenQuery=sql::get()->prepare("SELECT IF(`validUntil`>NOW(),1,0) AS `isValid` FROM `usersessions` WHERE `token`=? AND `userID`=?");
			$tokenQuery->execute([self::$token,self::$userID]);
			$tokenResult=$tokenQuery->fetch();
			if($tokenQuery->rowCount() && $tokenResult->isValid){
				self::$tokenValid=true;
				if(self::$code){
					if(false){
						self::$codeValid=true;
					}else{
						self::$authErrors|=8;
					}
				}else{
					self::$authErrors|=2;
				}
			}else{
				self::$authErrors|=4;
			}
		}else{
			self::$authErrors|=1;
		}
	}
	
	public static function getUserID(){
		self::authenticationInitialize();
		return self::$userID;
	}
	public static function getToken(){
		self::authenticationInitialize();
		return self::$token;
	}

	public static function checkToken():bool{
		self::authenticationInitialize();
		return self::$tokenValid;
	}
	public static function checkCode():bool{
		self::authenticationInitialize();
		return self::$codeValid;
	}

	public static function requireToken(){
		if(!self::checkToken()){
			throw new AuthException;
		}
	}
	public static function requireCode(){
		if(!self::checkCode()){
			throw new AuthException;
		}
	}
}

