var process = {argv: [], env: {COLORTERM: true}}; // pour corriger un bug avec le module "colors"

var json2xls = require('json2xls');
var colors = require('colors');
var fs = require('fs');
var casper = require('casper').create({
	verbose: false,
	logLevel: 'debug',
	waitTimeout: 10000,
	pageSettings: {
		loadImages: false,
		loadPlugins: false
	},
	viewportSize: {
		width: 1600,
		height: 900
	},
	onWaitTimeout: function() {
		this.capture('timeout.png');
	}
});
casper.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:49.0) Gecko/20100101 Firefox/49.0');
casper.on('remote.message', function(message) {
	log(ERROR, 'remote.message : ' + JSON.stringify(message));
});
casper.on("page.error", function(message) {
	log(ERROR, 'page.error : ' + JSON.stringify(message));
});
casper.on("resource.error", function(message) {
	log(ERROR, 'resource.error : ' + JSON.stringify(message));
});
casper.on('error', function(message) {
	log(ERROR, 'error : ' + JSON.stringify(message));
});

/* Log levels (syslog) */
var EMERGENCY = 0; // system is unusable
var ALERT = 1; // action must be taken immediately
var CRITICAL = 2; // the system is in critical condition
var ERROR = 3; // error condition
var WARNING = 4; // warning condition
var NOTICE = 5; // a normal but significant condition
var INFO = 6; // a purely informational message
var DEBUG = 7; // messages to debug an application

var htmlMode = casper.cli.args == 'html-mode';
var startTime;
var sports = [];
var bets = [];
// sport = title, expectedBetsCount, retrievedBetsCount, competitions
// competition = title, expectedBetsCount, retrievedBetsCount, categories
// category = title, expectedBetsCount, retrievedBetsCount
// bet = sport, competition, category, type, title, date, time, odds

function retrieveSports() {
	log(INFO, "Retrieving sports on \"unibet.fr\"...");
	casper.start('https://www.unibet.fr/sport/cotes-boostees');
	casper.waitForSelector('.eventpath-wrapper', function() {
		casper.click('#boostedsportsmenu > h3:nth-child(1) > span:nth-child(2)');
	});
	casper.waitForSelector('#boostedsportsmenu > div:nth-child(2)', function() {
		sports = this.evaluate(function() {
			var sports = [];
			$('#boostedsportsmenu > .content > ul:nth-child(1) > li').each(function(index) {
				var title = $(this).find('.head .linkaction .label').text();
				var betsCount = $(this).find('.head > .arrowaction > span:nth-child(1)').text();
				if(title != 'Cotes Boostées')
					sports.push({title: title.split(/ |-/)[0], expectedBetsCount: parseInt(betsCount), retrievedBetsCount: 0});
			});
			return sports;
		});
		log(INFO, sports.length + " sports available on \"unibet.fr\".");
		retrieveCompetitions(0);
	});
}

function retrieveCompetitions(sportIndex) {
	log(INFO, "Retrieving competitions for \"" + sports[sportIndex].title + "\"...");
	casper.click('#boostedsportsmenu > div:nth-child(2) > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > div:nth-child(1) > a:nth-child(1)');
	casper.waitForSelector('#boostedsportsmenu > div:nth-child(2) > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > ul', function() { 
		sports[sportIndex].competitions = this.evaluate(function(sportIndex) {
			var competitions = [];
			$('#boostedsportsmenu > div:nth-child(2) > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > ul > li').each(function(index) {
				var title = $(this).find('.head .linkaction .label').text();
				var betsCount = $(this).find('.head > .arrowaction > span:nth-child(1)').text();
				competitions.push({title: title, expectedBetsCount: parseInt(betsCount), retrievedBetsCount: 0});
			});
			return competitions;
		}, sportIndex);
		log(INFO, sports[sportIndex].competitions.length + " competitions available for \"" + sports[sportIndex].title + "\".");
		retrieveCategories(sportIndex, 0);
	});
}

function retrieveCategories(sportIndex, competitionIndex) {
	log(INFO, "Retrieving categories for \"" + sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + 
		sports[sportIndex].title + "\"...");
	casper.click('#boostedsportsmenu > .content > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > .level1 > li:nth-child(' + 
		(competitionIndex + 1) + ') > div > .linkaction');
	casper.waitFor(function() {
		return this.evaluate(function(competitionTitle) {
			return $('.depth-3').text() == competitionTitle && $('.eventpath-wrapper').length;
		}, sports[sportIndex].competitions[competitionIndex].title);
	}, function() {
		sports[sportIndex].competitions[competitionIndex].categories = this.evaluate(function() {
			var categories = [];
			$('.marketstypes-list > li').each(function(index) {
				var title = $(this).find('span').text().split(' (')[0];
				var betsCount = $(this).find('small').text().replace(/\(|\)/g, '');
				categories.push({title: title, expectedBetsCount: parseInt(betsCount), retrievedBetsCount: 0});
			});
			return categories;
		});
		log(INFO, sports[sportIndex].competitions[competitionIndex].categories.length + " categories available for \"" + 
			sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + sports[sportIndex].title + "\".");
		retrieveBets(sportIndex, competitionIndex, 0);
	});
}

function retrieveBets(sportIndex, competitionIndex, categoryIndex) {
	log(INFO, "Retrieving bets for \"" + sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].title + "\" for \"" + 
		sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + sports[sportIndex].title + "\"...");
	casper.click('.marketstypes-list > li:nth-child(' + (categoryIndex + 1) + ')');
	casper.waitForSelector('.eventpath-wrapper > h2', function() {
		this.evaluate(function() {
			$('i.fa.fa-fw').each(function(elt) {
				$(elt).click();
			});
		});
		var localBets = casper.evaluate(function(sportTitle, categoryTitle) {
			var localBets = [];
			var bet = {};
			var type;
			var date;
			$('.eventpath-wrapper > div').each(function(index) {
				type = $('.eventpath-wrapper > h2:nth-child(' + (index * 2 + 1) + ')').text().trim();
				$(this).find('.box').each(function(index) {
					date = $(this).find('h2').text();
					$(this).find('.inline-market.cell, .block-market.cell').each(function(index) {
						bet = {};
						bet.sport = sportTitle;
						bet.category = categoryTitle;
						bet.type = type;
						bet.date = date;
						bet.title = $(this).find('a > span:nth-child(1)').text().trim();
						bet.time = $(this).find('a > span:nth-child(2)').text();
						bet.competition = $(this).find('a > span:nth-child(3)').text();
						bet.odds = [];
						$(this).find('.oddc').each(function(index) {
							bet.odds.push({label: $(this).find('.label').text(), price: $(this).find('.price').text()});
						});
						bet.odds = JSON.stringify(bet.odds);
						if(bet.type == "" || bet.competition == "" || bet.title == "" || bet.date == "" || bet.time == "" || bet.odds == "[]")
							console.log("Failed to retrieve a bet : " + JSON.stringify(bet));
						else
							localBets.push(bet);
					});
				});
			});
			return localBets;
		}, sports[sportIndex].title, sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].title);

		for(var i in localBets)
			bets.push(localBets[i]);
		sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].retrievedBetsCount += localBets.length;
		sports[sportIndex].competitions[competitionIndex].retrievedBetsCount += localBets.length;
		sports[sportIndex].retrievedBetsCount += localBets.length;

		nextStep(sportIndex, competitionIndex, categoryIndex);
	});
}

function nextStep(sportIndex, competitionIndex, categoryIndex) {
	// fin d'une catégorie
	var realityNumber = sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].retrievedBetsCount;
	var expectedNumber = sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].expectedBetsCount;
	log(realityNumber != expectedNumber ? WARNING : INFO, realityNumber + "/" + expectedNumber + " bets retrieved for \"" + 
		sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].title + "\" for \"" + 
		sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + 
		sports[sportIndex].title + "\".");

	if(++categoryIndex < sports[sportIndex].competitions[competitionIndex].categories.length)
		retrieveBets(sportIndex, competitionIndex, categoryIndex);
	else { // fin d'une compétition
		var realityNumber = sports[sportIndex].competitions[competitionIndex].retrievedBetsCount;
		var expectedNumber = sports[sportIndex].competitions[competitionIndex].expectedBetsCount;
		log(realityNumber != expectedNumber ? WARNING : INFO, realityNumber + "/" + expectedNumber + " bets retrieved for \"" + 
			sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + 
			sports[sportIndex].title + "\".");

		if(++competitionIndex < sports[sportIndex].competitions.length) {
			retrieveCategories(sportIndex, competitionIndex);
		}
		else { // fin d'un sport
			var realityNumber = sports[sportIndex].retrievedBetsCount;
			var expectedNumber = sports[sportIndex].expectedBetsCount;
			log(realityNumber != expectedNumber ? WARNING : INFO, realityNumber + "/" + expectedNumber + " bets retrieved for \"" + 
				sports[sportIndex].title + "\".");

			if(++sportIndex < sports.length)
				retrieveCompetitions(sportIndex);
			else { // fin de la collecte
				log(NOTICE, "Gathering done, " + bets.length + "/" + computeTotalBets() + " bets gathered in " +
					Math.round((new Date().getTime() - startTime) / 1000) + " seconds.");
				log(NOTICE, "Generating output file...");
				fs.write('out.xlsx', json2xls(bets, {fields: ['sport', 'category', 'competition', 'type', 'title', 'date', 'time', 'odds']}), 'b');
				log(NOTICE, "Output file generated.");
			}
		}
	}
}

startTime = new Date().getTime();
log(NOTICE, "Starting web scraper for gathering bets on unibet.fr.");
retrieveSports();
casper.run(function() {
	this.exit();
});

function log(level, msg) {
	if(htmlMode) {
		if(level in [EMERGENCY, ALERT, CRITICAL, ERROR])
			console.log('{"content":"' + msg.replace(/"/g, '\\"') + '","color":"red"}');
		else if(level == WARNING)
			console.log('{"content":"' + msg.replace(/"/g, '\\"') + '","color":"orange"}');
		else if(level == NOTICE)
			console.log('{"content":"' + msg.replace(/"/g, '\\"') + '","color":"blue"}');
		else if(level == INFO)
			console.log('{"content":"' + msg.replace(/"/g, '\\"') + '","color":"green"}');
		else if(level == DEBUG)
			console.log('{"content":"' + msg.replace(/"/g, '\\"') + '","color":"black"}');
	}
	else {
		if(level in [EMERGENCY, ALERT, CRITICAL, ERROR])
			console.log(msg.red);
		else if(level == WARNING)
			console.log(msg.yellow);
		else if(level == NOTICE)
			console.log(msg.blue);
		else if(level == INFO)
			console.log(msg.green);
		else if(level == DEBUG)
			console.log(msg.white);
	}
}

function computeTotalBets() {
	var sum = 0;
	for(var i in sports)
		sum += sports[i].expectedBetsCount;
	return sum;
}