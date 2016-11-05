"use strict";
const crestRoot="https://crest-tq.eveonline.com";
var app=angular.module("skynet",["ngMessages","ngSanitize","ngRoute","ngStorage","ngMaterial"]);
app.config(function($mdThemingProvider){
	$mdThemingProvider.theme("default").primaryPalette("deep-purple").accentPalette("deep-orange");
});
app.service("alertService",function($mdDialog,$mdToast){
	this.makeError=(description,response)=>{
		if(response.data && response.data.error){
			//Internal API error
			return {
				title:description,
				type:response.data.error.type,
				message:response.data.error.message
			};
		}
		if(response.data && response.data.key){
			//External API error
			return {
				title:response.data.title || description,
				type:response.data.key+"/"+response.data.exceptionType,
				message:response.data.message
			};
		}
		//Misc error
		return {
			title:description,
			type:"unknown"+response.status+response.statusText.replace(/\s/g,""),
			message:response.data
		};
	};

	this.notice=(txt)=>{
		$mdToast.show($mdToast.simple().textContent(txt).hideDelay(4000));
		console.info(txt);
	};
	this.errorNotice=(error)=>{
		let message=`${error.title}: ${error.message} (${error.type})`;
		$mdToast.show($mdToast.simple().textContent(message).hideDelay(8000));
		console.warn(message);
	};
	this.errorBreaking=(error)=>{
		$mdDialog.show($mdDialog.alert().title(error.title).textContent(error.type+": "+error.message).ok("Ok"));
		console.error(`${error.title}: ${error.message} (${error.type})`);
	};
	this.errorUnrecoverable=(error)=>{
		$mdDialog.show($mdDialog.alert().title("Unrecoverable error: "+error.title).textContent(error.type+": "+error.message).ok("Reload").
		escapeToClose(false).clickOutsideToClose(false)).then(()=>{window.location.reload();});
		console.error(`${error.title}: ${error.message} (${error.type})`);
	};

	const testError={title:"Something awful happened",type:"doomsdayException",message:"lol"};
});
app.service("loadingService",function(){
	this.loading=false;
});
app.service("sessionService",function($http,$timeout,$localStorage,alertService){
	this.timeout=false;
	this.active=false;

	this.get=()=>{
		if(this.active || !$localStorage.skynetUser.loggedIn) return;
		this.active=true;
		$http({
			method:"GET",
			url:"api/token/",
			headers:{Authorization:"Basic "+btoa($localStorage.skynetUser.id+":"+$localStorage.skynetUser.token)}
		}).then((response)=>{
			this.accessToken=response.data.accessToken;
		},(response)=>{
			alertService.errorNotice(alertService.makeError("Couldn't refresh access token",response));
		}).finally(()=>{
			this.timeout=$timeout(()=>{
				this.active=false;
				this.get();
			},30000);
		});
	};

	this.init=()=>{
		$timeout(()=>{
			if($localStorage.skynetUser.loggedIn && !this.active){
				this.get();
			}
		},250);
	};
	this.stop=()=>{
		$timeout.cancel(this.timeout);
		this.active=false;
	};
	this.activeFleetID=0;
	this.accessToken="";
});
app.service("staticInfoService",function($http,$localStorage,alertService,loadingService){
	var staticInfo={ships:{},shipClasses:{},systems:{},systemList:[]};
	var loaded={ships:false,systems:false};
	var refSystem=false;
	
	loadingService.loading=true;
	
	$http.get("static/ships.json").then((response)=>{
		staticInfo.ships=response.data.ships;
		staticInfo.shipClasses=response.data.shipClasses;
		loaded.ships=true;
		if(loaded.systems) loadingService.loading=false;
	},(response)=>{
		alertService.errorUnrecoverable(alertService.makeError("Couldn't load static data",response));
	});
	$http.get("static/systems.json").then((response)=>{
		staticInfo.systems=response.data.systems;
		staticInfo.systemList=response.data.systemList;
		loaded.systems=true;
		if(loaded.ships) loadingService.loading=false;
	},(response)=>{
		alertService.errorUnrecoverable(alertService.makeError("Couldn't load static data",response));
	});

	function setReferenceSystem(referenceSystem,systemList){
		if(refSystem==referenceSystem) return;
	}
	
	this.static=staticInfo;
	this.reference=setReferenceSystem;
	this.isLoaded=function(){return loaded.ships && loaded.systems};
});
app.service("fleetInfoService",function($http,$q,$timeout,$localStorage,alertService,sessionService,loadingService,staticInfoService){
	var fleetInfo={details:{},members:{},memberList:[],composition:{},structure:{}};
	var fleetActive=false;
	var endpoints={fleet:false,members:false,wings:false};

	function parseFleet(fleetID){
		if(!endpoints.fleet || !endpoints.members || !endpoints.wings) return;
		var temp={details:{},members:{},memberList:[],composition:{},structure:{}};
		
		temp.details={motd:endpoints.fleet.motd,freemove:endpoints.fleet.isFreeMove,voice:endpoints.fleet.isVoiceEnabled,advert:endpoints.fleet.isRegistered};
		temp.structure={capacity:1,count:0,commander:0,booster:0,wingList:[],wingCount:0,wings:{},squads:{}};
		temp.composition={systemList:[]};
		endpoints.wings.items.forEach(function(wing){
			temp.structure.capacity++;
			temp.structure.wingCount++;
			temp.structure.wingList.push(wing.id);
			temp.structure.wings[wing.id]={name:wing.name,count:0,commander:0,booster:0,squadList:[],squadCount:0};
			wing.squadsList.forEach(function(squad){
				temp.structure.capacity+=10;
				temp.structure.wings[wing.id].squadCount++;
				temp.structure.wings[wing.id].squadList.push(squad.id);
				temp.structure.squads[squad.id]={name:squad.name,count:0,commander:0,booster:0,members:[]};
			});
		});

		let referenceSystem=false;
		endpoints.members.items.forEach(function(member){
			if(member.character.id==$localStorage.skynetUser.id) referenceSystem=member.solarSystem.id;
			temp.memberList.push(member.character.id);
			temp.members[member.character.id]={
				name:member.character.name,
				ship:member.ship.id,
				system:member.solarSystem.id,
				docked:member.station?member.station.name:false,
				warps:member.takesFleetWarp
			};
			
			temp.structure.count++;
			if(member.roleID==1) temp.structure.commander=member.character.id;
			if(member.boosterID==1) temp.structure.booster=member.character.id;
			if(member.wingID>0){
				temp.structure.wings[member.wingID].count++;
				if(member.roleID==2) temp.structure.wings[member.wingID].commander=member.character.id;
				if(member.boosterID==2) temp.structure.wings[member.wingID].booster=member.character.id;
			}
			if(member.squadID>0){
				temp.structure.squads[member.squadID].count++;
				if(member.roleID==4) temp.structure.squads[member.squadID].members.push(member.character.id);
				if(member.roleID==3) temp.structure.squads[member.squadID].commander=member.character.id;
				if(member.boosterID==3) temp.structure.squads[member.squadID].booster=member.character.id;
			}

			if(!temp.composition[member.solarSystem.id]){
				temp.composition.systemList.push(member.solarSystem.id);
				temp.composition[member.solarSystem.id]={count:0,classList:[],classes:{}};
			}
			if(!temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class]){
				temp.composition[member.solarSystem.id].classList.push(staticInfoService.static.ships[member.ship.id].class);
				temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class]={count:0,typeList:[],types:{}};
			}
			if(!temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class].types[member.ship.id]){
				temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class].typeList.push(member.ship.id);
				temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class].types[member.ship.id]=0;
			}
			temp.composition[member.solarSystem.id].count++;
			temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class].count++;
			temp.composition[member.solarSystem.id].classes[staticInfoService.static.ships[member.ship.id].class].types[member.ship.id]++;
		});
		staticInfoService.reference(referenceSystem,temp.composition.systemList);
		loadingService.loading=false;
		fleetActive=true;
		Object.assign(fleetInfo,temp);
		$timeout(loadFleet,5250,true,fleetID);
	}
	
	function loadFleet(fleetID){
		loadingService.loading=true;
		endpoints={fleet:false,members:false,wings:false};
		var endRequests=$q.defer();
		
		function loadError(response){
			if(!fleetActive) return;
			fleetActive=false;
			endRequests.resolve();
			loadingService.loading=false;
			alertService.errorBreaking(alertService.makeError("Error loading fleet data",response));
		}
		
		$http({
			method:"get",
			url:crestRoot+"/fleets/"+fleetID+"/",
			headers:{
				Authorization:"Bearer "+sessionService.accessToken,
				Accept:"application/vnd.ccp.eve.Fleet-v1+json"
			},
			timeout:endRequests
		}).then(function(response){
			endpoints.fleet=response.data;
			parseFleet(fleetID);
		},loadError);
		$http({
			method:"get",
			url:crestRoot+"/fleets/"+fleetID+"/members/",
			headers:{
				Authorization:"Bearer "+sessionService.accessToken,
				Accept:"application/vnd.ccp.eve.FleetMembers-v1+json"
			},
			timeout:endRequests
		}).then(function(response){
			endpoints.members=response.data;
			parseFleet(fleetID);
		},loadError);
		$http({
			method:"get",
			url:crestRoot+"/fleets/"+fleetID+"/wings/",
			headers:{
				Authorization:"Bearer "+sessionService.accessToken,
				Accept:"application/vnd.ccp.eve.FleetWings-v1+json"
			},
			timeout:endRequests
		}).then(function(response){
			endpoints.wings=response.data;
			parseFleet(fleetID);
		},loadError);
	}
	
	this.fleet=fleetInfo;
	this.active=function(){return fleetActive};
	this.useFleetID=function(fleetID){loadFleet(fleetID);};
});
app.service("sortService",function(staticInfoService,fleetInfoService){
	this.currentCategory=false;
	this.activeSort={
		composition:"name",
		members:"name"
	};
	this.f={
		systemName:s=>staticInfoService.static.systems[s].name,
		systemJumps:s=>staticInfoService.static.systems[s].jumps,
		systemLy:s=>staticInfoService.static.systems[s].ly,
		systemNav:s=>-staticInfoService.static.systems[s].nav,
		shipClass:s=>staticInfoService.static.shipClasses[s].name,
		shipType:s=>staticInfoService.static.ships[s].name,
		memberName:m=>fleetInfoService.fleet.members[m].name,
		memberDocked:m=>fleetInfoService.fleet.members[m].docked,
		memberSystemName:m=>staticInfoService.static.systems[fleetInfoService.fleet.members[m].system].name,
		memberSystemJumps:m=>staticInfoService.static.systems[fleetInfoService.fleet.members[m].system].jumps,
		memberSystemLy:m=>staticInfoService.static.systems[fleetInfoService.fleet.members[m].system].ly,
		memberSystemNav:m=>staticInfoService.static.systems[fleetInfoService.fleet.members[m].system].nav,
		memberShipClass:m=>staticInfoService.static.shipClasses[staticInfoService.static.ships[fleetInfoService.fleet.members[m].ship].class].name,
		memberShipType:m=>staticInfoService.static.ships[fleetInfoService.fleet.members[m].ship].name
	};
	this.sorts={
		composition:{
			name:{text:"System name",sort:this.f.systemName},
			jumps:{text:"Distance in jumps",sort:[this.f.systemNav,this.f.systemJumps,this.f.systemName]},
			ly:{text:"Distance in LY",sort:[this.f.systemNav,this.f.systemLy,this.f.systemName]}
		},
		members:{
			name:{text:"Name",sort:this.f.memberName},
			shipClass:{text:"Ship class",sort:[this.f.memberShipClass,this.f.memberShipType,this.f.memberSystemName,this.f.memberName]},
			shipType:{text:"Ship type",sort:[this.f.memberShipType,this.f.memberSystemName,this.f.memberDocked,this.f.memberName]},
			system:{text:"System name",sort:[this.f.memberSystemName,this.f.memberDocked,this.f.memberName]},
			jumps:{text:"Jumps away",sort:[this.f.memberSystemNav,this.f.memberSystemJumps,this.f.memberSystemName,this.f.memberDocked,this.f.memberName]},
			ly:{text:"LY away",sort:[this.f.memberSystemNav,this.f.memberSystemLy,this.f.memberSystemName,this.f.memberDocked,this.f.memberName]}
		}
	};
	this.setCurrent=(val=false)=>{
		this.currentCategory=val;
	};
	this.setActive=(sort)=>{
		this.activeSort[this.currentCategory]=sort;
	}
});
app.controller("loadingIndicator",function($scope,loadingService){
	$scope.loading=loadingService;
});
app.controller("sortMenu",function($scope,sortService){
	$scope.sort=sortService;
});
app.controller("toolbar",function($scope){
});
app.controller("loginController",function($scope,$http,$localStorage,alertService,sessionService){
	$scope.ls=$localStorage;
	$scope.logout=function(){
		sessionService.stop();
		$http({
			method:"delete",
			url:"api/session/",
			headers:{Authorization:"Basic "+btoa($localStorage.skynetUser.id+":"+$localStorage.skynetUser.token)}
		}).then(function(){
			sessionService.accessToken=false;
			$localStorage.skynetUser={loggedIn:false};
		},function(response){
			if(response.status==401){
				sessionService.accessToken=false;
				$localStorage.skynetUser={loggedIn:false};
			}
			else{
				alertService.errorNotice(alertService.makeError("Couldn't log out",response));
			}
		});

	};
});
app.controller("fleet",function($scope,$http,$timeout,$localStorage,$mdToast,$mdDialog,alertService,sessionService,staticInfoService,fleetInfoService,sortService){
	$scope.staticData=staticInfoService;
	$scope.fleetInfo=fleetInfoService;
	$scope.sort=sortService;
	$scope.ls=$localStorage;
	$scope.session=sessionService;
	$scope.alert=alertService;
	sessionService.init();
	
	$scope.memberSummary=member=>{
		let name=fleetInfoService.fleet.members[member].name,
			sType=staticInfoService.static.ships[fleetInfoService.fleet.members[member].ship].name,
			sClass=staticInfoService.static.shipClasses[staticInfoService.static.ships[fleetInfoService.fleet.members[member].ship].class].name;
		//sysName=staticInfoService.static.systems[fleetInfoService.fleet.members[member].system].name
		//regName=staticInfoService.static.systems[fleetInfoService.fleet.members[member].system].reg
		return `${name} - ${sType} (${sClass})`;
	};
	$scope.systemDetails=system=>{
		let sysName=staticInfoService.static.systems[system].name,
			regName=staticInfoService.static.systems[system].reg,
			secStatus=staticInfoService.static.systems[system].sec.toFixed(1);
		return `${sysName}, ${regName} (${secStatus})`+("");
	};
	
	$scope.start=function(){
		sessionService.activeFleetID=/\d+/.exec($localStorage.skynetFleetURL)[0];
		fleetInfoService.useFleetID(sessionService.activeFleetID);
	};

	$scope.updateFreemove=function(){
		$http({
			method:"put",
			url:crestRoot+`/fleets/${sessionService.activeFleetID}/`,
			headers:{Authorization:"Bearer "+sessionService.accessToken},
			data:{isFreeMove:fleetInfoService.fleet.details.freemove}
		}).then(function(){
			alertService.notice(fleetInfoService.fleet.details.freemove?"Free-move enabled":"Free-move disabled");
		},function(response){
			alertService.errorNotice(alertService.makeError("Couldn't toggle free-move",response));
		});
	};

	$scope.createWing=function(){
		fleetInfoService.fleet.structure.wingCount++;
		$http({
			method:"post",
			url:crestRoot+"/fleets/"+sessionService.activeFleetID+"/wings/",
			headers:{Authorization:"Bearer "+sessionService.accessToken}
		}).then(function(){
			alertService.notice("New wing created");
		},function(response){
			alertService.errorNotice(alertService.makeError("Couldn't create new wing",response));
		});
	};
	$scope.deleteWing=function(wingID){
		$http({
			method:"delete",
			url:crestRoot+"/fleets/"+sessionService.activeFleetID+"/wings/"+wingID+"/",
			headers:{Authorization:"Bearer "+sessionService.accessToken}
		}).then(function(){
			alertService.notice("Wing deleted");
		},function(response){
			alertService.errorNotice(alertService.makeError("Couldn't delete wing",response));
		});
	};
	$scope.createSquad=function(wingID){
		fleetInfoService.fleet.structure.wings[wingID].squadCount++;
		$http({
			method:"post",
			url:crestRoot+"/fleets/"+sessionService.activeFleetID+"/wings/"+wingID+"/squads/",
			headers:{Authorization:"Bearer "+sessionService.accessToken}
		}).then(function(){
			alertService.notice("New squad created");
		},function(response){
			alertService.errorNotice(alertService.makeError("Couldn't create new squad",response));
		});
	};
	$scope.deleteSquad=function(wingID,squadID){
		$http({
			method:"delete",
			url:crestRoot+"/fleets/"+sessionService.activeFleetID+"/wings/"+wingID+"/squads/"+squadID+"/",
			headers:{Authorization:"Bearer "+sessionService.accessToken}
		}).then(function(){
			alertService.notice("Squad deleted");
		},function(response){
			alertService.errorNotice(alertService.makeError("Couldn't delete squad",response));
		});
	};
	
	$scope.kickMember=function(id,event){
		if(id==$localStorage.skynetUser.id){
			alertService.notice("There are better ways to punish yourself than by kicking yourself from your fleet");
		}
		else{
			$mdDialog.show($mdDialog.confirm().title("Kicking member").textContent("Are you sure you want to kick this guy from your fleet?").
			ok("Yeah").cancel("No, I love that dude!").targetEvent(event)).
			then(()=>{
				$http({
					method:"delete",
					url:crestRoot+`/fleets/${sessionService.activeFleetID}/members/${id}/`,
					headers:{Authorization:"Bearer "+sessionService.accessToken}
				}).then(()=>{
					alertService.notice(`Kicked ${fleetInfoService.fleet.members[id].name} from fleet`);
				},(response)=>{
					alertService.errorNotice(alertService.makeError(`Couldn't kick ${fleetInfoService.fleet.members[id].name} from fleet`,response));
				});
			});
		}
	};
});

app.controller("fleetInvite",function($scope,$http,$timeout,$localStorage,$mdToast,alertService){
	$scope.queryText="";
	$scope.selectedChar=null;
	$scope.matchedChars=[];
	
	$scope.search=()=>{
		let query=$scope.queryText;
		if(query){
			$http.get(`https://zkillboard.com/autocomplete/characterID/${encodeURIComponent(query)}/`).then(request=>{
				if(query==$scope.queryText) $scope.matchedChars=request.data;
			});
		}
	};
	
	$scope.inviteChar=()=>{
		let char=$scope.selectedChar;
		if(char && char.id){
			$scope.queryText="";
			$scope.selectedChar=null;
			$scope.matchedChars=[];
			console.log(`Inviting ${char.name} to fleet`);
			$http({
				method:"post",
				url:`${crestRoot}/fleets/${sessionService.activeFleetID}/members/`,
				headers:{
					Authorization:"Bearer "+sessionService.accessToken,
					Accept:"application/vnd.ccp.eve.FleetMemberInvite-v1+json"
				},
				data:{
					character:{href:`${crestRoot}/characters/${char.id}/`},
					role:"squadMember"
				}
			}).then(()=>{
				$mdToast.showSimple(`Invited ${char.name} to fleet`);
			},response=>{
				alertService.errorNotice(alertService.makeError(`Couldn't invite ${char.name} to fleet`,response));
			});
		}
	};
});