<?php

if(!auth::getUserID() || !auth::getToken() || !auth::checkToken()){
	throw new AuthException();
}

$logoutQuery=sql::get()->prepare("DELETE FROM `usersessions` WHERE `token`=? AND `userID`=?");
$logoutQuery->execute([auth::getToken(),auth::getUserID()]);

comm::respond();