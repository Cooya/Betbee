var json2xls = require('json2xls');
var fs = require('fs');
var casper = require('casper').create({
	//verbose: true,
	logLevel: 'debug',
	waitTimeout: 10000
});
casper.userAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.71 Safari/537.36');
casper.options.viewportSize = {width: 1600, height: 900};
casper.options.pageSettings.loadImages = false;
casper.options.pageSettings.loadPlugins = false; 
casper.on('remote.message', function(message) {
	this.echo(message);
});
casper.on("page.error", function(message) {
	this.echo(message);
});
casper.on("resource.error", function(message) {
	this.echo(message);
});
casper.on('error', function(message) {
	this.echo(message);
})

function getSports() {
	var sports = document.querySelectorAll('.sport-list li');
	return Array.prototype.map.call(sports, function(e) { 
		return e.textContent;
	});
}

function getCompetitions() {
	var competitions = document.querySelectorAll('li.expandable');
	return Array.prototype.map.call(competitions, function(e) { 
		return e.textContent;
	});
}

function getBets() {
	var bets = [];
	var currentDate = null;
	var currentTime = null;
	var data = document.querySelectorAll('li.event.cat');

	var nameElt;
	var dateElt;
	var timeElt;
	var infosElt;
	var oddElts;
	for(var i = 0; i < data.length; ++i) {
		dateElt = data[i].querySelector('.date-title.separator.light.block');
		timeElt = data[i].querySelector('.time.space-right');
		infosElt = data[i].querySelector('.competition-name.special');
		nameElt = data[i].querySelector('.event-name > a');
		oddElts = data[i].querySelectorAll('.odd-button > span, .odd-button > strike');
		if(dateElt)
			currentDate = dateElt.textContent;
		if(timeElt)
			currentTime = timeElt.textContent;
		if(!nameElt || oddElts.length == 0)
			continue;
		bets.push({
			date: currentDate,
			time: currentTime,
			infos: infosElt ? infosElt.textContent : null,
			name: nameElt.textContent,
			odd1: oddElts[0].textContent,
			oddN: oddElts.length > 2 ? oddElts[1].textContent : null,
			odd2: oddElts.length > 2 ? oddElts[2].textContent : oddElts[1].textContent
		});
	}
	return bets;
}

function getSpecialBets() {
	var bets = [];
	var data = document.querySelectorAll('li.event.tmt');
	var specialBet;
	var optionsData;

	if(data.length > 0) { // plusieurs paris spéciaux sur la page
		for(var i in data) {
			if(typeof data[i] === 'object') {
				specialBet = {
					name: data[i].querySelector('a.competition-name').textContent,
					options: []
				};
				optionsData = data[i].querySelectorAll('.row.row-outright');
				for(var j in optionsData)
					if(typeof optionsData[j] === 'object') {
						specialBet.options.push({
							name: optionsData[j].querySelector('.event-name > a').textContent,
							value: optionsData[j].querySelector('span.variable').textContent
						});
					}
				bets.push(specialBet);
			}
		}
	}
	else if(document.querySelector('h1.event-title')) { // un seul pari spécial sur la page
		specialBet = {
			name: document.querySelector('h1.event-title').textContent,
			options: []
		};
		optionsData = document.querySelectorAll('li.bet-option');
		for(var j in optionsData)
			if(typeof optionsData[j] === 'object') {
				specialBet.options.push({
					name: optionsData[j].querySelector('div.name').textContent,
					value: optionsData[j].querySelector('span.variable').textContent
				});
			}
		bets.push(specialBet);
	}
	return bets;
}

function nextStep() {
	//console.log("nextStep()");
	if(competitionIndex + 1 < competitions.length) {
		competitionIndex++;
		casper.emit('next.competition');
	}
	else if(sportIndex + 1 < sports.length) {
		console.log(sports[sportIndex].betsGathered + "/" + sports[sportIndex].betsCount + " bets gathered in sport \"" + sports[sportIndex].title + "\".");
		competitionIndex = 0;
		sportIndex++;
		casper.emit('next.sport');
	}
	else {
		console.log(sports[sportIndex].betsGathered + "/" + sports[sportIndex].betsCount + " bets gathered in sport \"" + sports[sportIndex].title + "\".");
		console.log("Gathering done.");
		console.log(globalBetsGathered + "/" + globalBetsCount + " bets gathered in " + Math.round((new Date().getTime() - startTime) / 1000) + " seconds.");
		fs.write('out.xlsx', json2xls(winamax, {fields: ['sport', 'competition', 'infos', 'date', 'time', 'name', 'odd1', 'oddN', 'odd2', 'sum']}), 'b');
		console.log("Output file generated.");
	}
}

var startTime = new Date().getTime();
var winamax = [];
var sports;
var sportIndex = 1; // pour éviter l'onglet "A la une"
var competitions;
var competitionIndex = 0;
var globalBetsCount = 0;
var globalBetsGathered = 0;

console.log("Starting web scraper for gathering bets on winamax.fr.");

// première page
casper.start('https://www.winamax.fr/paris-sportifs#!/sports');
casper.waitForSelector('article.slide:nth-child(1) > a:nth-child(1) > img:nth-child(1)', function() {
	sports = this.evaluate(getSports);
	console.log((sports.length - 1) + " sports found on winamax.fr");
	var betsCount;
	for(var i in sports)
		if(i != 0) {
			betsCount = Number(/\(([0-9]+)\)/.exec(sports[i])[1]);
			sports[i] = {
				title: splitTitle(sports[i]),
				betsCount: betsCount,
				betsGathered: 0
			}
			globalBetsCount += betsCount;
		}
	console.log(globalBetsCount + " bets available.");

	this.emit('next.sport');
});

// sports
casper.on('next.sport', function() {
	this.then(function() {
		this.click('li.sport:nth-child(' + (sportIndex + 1) + ') > div:nth-child(1)');
	});
	this.waitForSelector('.sub-nav', function() {
		competitions = this.evaluate(getCompetitions);
		console.log(competitions.length + " competition(s) found in sport \"" + sports[sportIndex].title + "\".");
		for(var i in competitions)
			competitions[i] = splitTitle(competitions[i]);

		this.emit('next.competition');
	});
});

// compétitions
casper.on('next.competition', function() {
	this.then(function() {
		try {
			this.click('li.expandable:nth-child(' + (competitionIndex + 1) + ') > div:nth-child(1)');
		}
		catch(e) {
			console.log(e);
			this.capture('error.png');
		}
	});
	this.waitFor(function() {
		return this.evaluate(function(competition) {
			var title = document.querySelector('.breadcrumbs > span:nth-child(2)');
			return title ? title.textContent == competition : false;
		}, competitions[competitionIndex]);
	}, null, function() {
		this.capture('timeout.png');	
	});
	this.wait(1000, function() {
		// récupération des paris classiques
		var bets = this.evaluate(getBets);
		console.log("   " + bets.length + " usual bet(s) found in competition \"" + competitions[competitionIndex] + "\".");
		for(var i in bets) {
			bets[i].sport = sports[sportIndex].title;
			bets[i].competition = competitions[competitionIndex];
			if(bets[i].odd1 && bets[i].oddN && bets[i].odd2) {
				bets[i].sum = 1 / bets[i].odd1.replace(',', '.') + 1 / bets[i].oddN.replace(',', '.') + 1 / bets[i].odd2.replace(',', '.');
				bets[i].sum = Math.round(bets[i].sum * 10000) / 10000;
			}
			sports[sportIndex].betsGathered++;
			globalBetsGathered++;
			winamax.push(bets[i]);
		}

		// récupération des paris spéciaux
		var specialBets = this.evaluate(getSpecialBets);
		console.log("   " + specialBets.length + " special bet(s) found in competition \"" + competitions[competitionIndex] + "\".");
		for(var i in specialBets) {
			console.log("      1 special bet with " + specialBets[i].options.length + " options retrieved in competition \"" + competitions[competitionIndex] + "\".");
			sports[sportIndex].betsGathered++;
			globalBetsGathered++;
			for(var j in specialBets[i].options)
				winamax.push({
					date: null,
					time: null,
					infos: specialBets[i].name,
					name: specialBets[i].options[j].name,
					odd1: specialBets[i].options[j].value,
					oddN: null,
					odd2: null,
					sport: sports[sportIndex].title,
					competition: competitions[competitionIndex]
				});
		}
		nextStep();
	});
});

casper.run(function() {
	this.exit();
});


function splitTitle(title) {
	return title.substring(0, title.lastIndexOf(' ('));
}