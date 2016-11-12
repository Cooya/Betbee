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
	this.echo(('remote.message : ' + JSON.stringify(message)).red);
});
casper.on("page.error", function(message) {
	this.echo(('page.error : ' + JSON.stringify(message)).red);
});
casper.on("resource.error", function(message) {
	this.echo(('resource.error : ' + JSON.stringify(message)).red);
});
casper.on('error', function(message) {
	this.echo(('error : ' + JSON.stringify(message)).red);
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

var startTime;
var sports = [];
function sport(title, betsCount) {
	this.title = title;
	this.betsCount = betsCount;
	this.competitions = [];
}
function competition(title, betsCount) {
	this.title = title;
	this.betsCount = betsCount;
	this.categories = [];
}
function category(title, betsCount) {
	this.title = title;
	this.betsCount = betsCount;
	this.bets = [];
}
function bet(type, competition, title, date, time, odds) {
	this.type = type;
	this.competition = competition;
	this.title = title;
	this.date = date;
	this.time = time;
	this.odds = odds;
}

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
					sports.push({title: title.split(/ |-/)[0], betsCount: betsCount});
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
				competitions.push({title: title, betsCount: betsCount});
			});
			return competitions;
		}, sportIndex);
		log(INFO, sports[sportIndex].competitions.length + " competitions available for \"" + sports[sportIndex].title + "\".");
		retrieveCategories(sportIndex, 0);
	});
}

function retrieveCategories(sportIndex, competitionIndex) {
	log(INFO, "Retrieving categories for \"" + sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + sports[sportIndex].title + "\"...");
	casper.click('#boostedsportsmenu > .content > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > .level1 > li:nth-child(' + (competitionIndex + 1) + ') > div > .linkaction');
	casper.waitFor(function() {
		return this.evaluate(function(sportTitle) {
			return $('.depth-2').text().split(/ |-/)[0] == sportTitle;
		}, sports[sportIndex].title);
	}, function() {
		sports[sportIndex].competitions[competitionIndex].categories = this.evaluate(function() {
			var categories = [];
			$('.marketstypes-list > li').each(function(index) {
				var title = $(this).find('span').text().split(' (')[0];
				var betsCount = $(this).find('small').text().replace(/\(|\)/g, '');
				categories.push({title: title, betsCount: betsCount});
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
		sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].bets = this.evaluate(function() {
			// dépliage de tous les options de pari
			//$('.fa.fa-fw').each(function(index) {
			//	$(this).click();
			//});


			var bets = [];
			var bet = {};
			var type;
			var date;
			$('.eventpath-wrapper > div').each(function(index) {
				type = $('.eventpath-wrapper > h2:nth-child(' + (index * 2 + 1) + ')').text().trim();
				$(this).find('.box').each(function(index) {
					date = $(this).find('h2').text();
					$(this).find('.inline-market.cell, .block-market.cell').each(function(index) {
						bet = {};
						bet.type = type;
						bet.date = date;
						bet.title = $(this).find('a > span:nth-child(1)').text().trim();
						bet.time = $(this).find('a > span:nth-child(2)').text();
						bet.competition = $(this).find('a > span:nth-child(3)').text();
						bet.odds = [];
						$(this).find('.oddc').each(function(index) {
							bet.odds.push({label: $(this).find('.label').text(), price: $(this).find('.price').text()});
						});
						if(bet.type == "" || bet.competition == "" || bet.title == "" || bet.date == "" || bet.time == "" || bet.odds == [])
							console.log("Failed to retrieve a bet : " + JSON.stringify(bet));
						else
							bets.push(bet);
					});
				});
			});
			return bets;
		});
		log(INFO, sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].bets.length + "/" + 
			sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].betsCount +  " bets retrieved for \"" + 
			sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].title + "\" for \"" + 
			sports[sportIndex].competitions[competitionIndex].title + "\" for \"" + 
			sports[sportIndex].title + "\".");
		nextStep(sportIndex, competitionIndex, categoryIndex);
	});
}

function nextStep(sportIndex, competitionIndex, categoryIndex) {
	if(++categoryIndex < sports[sportIndex].competitions[competitionIndex].categories.length)
		retrieveBets(sportIndex, competitionIndex, categoryIndex);
	else if(++competitionIndex < sports[sportIndex].competitions.length)
		retrieveCategories(sportIndex, competitionIndex);
	else if(++sportIndex < sports.length)
		retrieveCompetitions(sportIndex);
}

startTime = new Date().getTime();
log(NOTICE, "Starting web scraper for gathering bets on unibet.fr.");
retrieveSports();
casper.run(function() {
	this.exit();
});

function log(level, msg) {
	if(level in [EMERGENCY, ALERT, CRITICAL, ERROR])
		console.error(msg.red);
	else if(level == WARNING)
		console.log(msg.yellow);
	else if(level == NOTICE)
		console.log(msg.blue);
	else if(level == INFO)
		console.log(msg.green);
	else if(level == DEBUG && debugMode)
		console.log(msg.white);
}