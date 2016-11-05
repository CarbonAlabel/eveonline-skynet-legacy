function urlParam(n){
	return decodeURIComponent((new RegExp('[?|&]'+n+'='+'([^&;]+?)(&|#|;|$)').exec(location.search) || [,""])[1].replace(/\+/g,'%20')) || null;
}

var login=angular.module("skynetLogin",["ngStorage"]);
login.controller("login",function($scope,$http,$localStorage){
	$scope.title="Logging you in";
	$scope.dots=true;
	$scope.desc="";
	$scope.info="";
	$scope.link="";
	$scope.href="";
	if(urlParam("code")){
		$http({
			method:"POST",
			url:"../api/session/",
			data:{code:urlParam("code")}
		}).then(function(response){
			$scope.title="Logged in";
			$scope.dots=false;
			$scope.desc="You have been logged in as "+response.data.userName+".";
			$localStorage.skynetUser={
				id:response.data.userID,
				name:response.data.userName,
				token:response.data.token,
				loggedIn:true
			};
			setTimeout(function(){
				if(window.opener){
					window.opener.focus();
					window.hide();
				}
				else{
					window.location.replace("..");
				}
			},300);
		},function(response){
			$scope.title="An error occurred";
			$scope.dots=false;
			$scope.desc="Reload the page to try again.";
			$scope.info=response.data.error.message || response.data;
		});
	}
	else{
		$scope.title="Something went wrong";
		$scope.dots=false;
		$scope.desc="Try logging in again.";
		$scope.link="Log in";
		$scope.href=".";
	}
});

setInterval(function(){
	var e=document.querySelector("#dots");
	if(e){
		if(e.innerHTML.length>=7){
			e.innerHTML=".";
		}
		else{
			e.innerHTML+=".";
		}
	}
},200);