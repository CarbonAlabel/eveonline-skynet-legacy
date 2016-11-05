<?php
const MYSQL_DB_NAME="taabe_tools_skynet";
const MYSQL_HOST_NAME="localhost";
const MYSQL_USER_NAME="carbon";
const MYSQL_PASSWORD="carbon";

const EVE_APP_ID="137f7808c40e49f5a42643723e4e31fd";
const EVE_APP_KEY="KcBJKczwqiTKl6XgKeelWbl5WL3zdZ4Jpj0RqZUJ";
//const EVE_APP_AUTH="";
define("EVE_APP_AUTH",base64_encode(EVE_APP_ID.":".EVE_APP_KEY));
const EVE_APP_CALLBACK_URL="https://tools.taabe.xyz/skynet/login/";
//const EVE_APP_CALLBACK_URL_ESCAPED="";
define("EVE_APP_CALLBACK_URL_ESCAPED",urlencode(EVE_APP_CALLBACK_URL));
const EVE_APP_USER_AGENT="TAABE Skynet | carbonalabel@gmail.com";

//Root URLs of EVE online services
const EVE_SSO_ROOT="https://login.eveonline.com";
const EVE_CREST_ROOT="https://crest-tq.eveonline.com/";
