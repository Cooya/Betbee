var json2xls = require('json2xls');
var fs = require('fs');
var casper = require('casper').create({
	verbose: true,
	logLevel: 'debug',
	waitTimeout: 10000
});
casper.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:49.0) Gecko/20100101 Firefox/49.0');
casper.options.viewportSize = {width: 1600, height: 900};
casper.options.pageSettings.loadImages = false;
casper.options.pageSettings.loadPlugins = false; 
casper.options.onWaitTimeout = function() {
	this.capture('timeout.png');
};
casper.on('remote.message', function(message) {
	this.echo('remote.message : ' + JSON.stringify(message));
});
casper.on("page.error", function(message) {
	this.echo('page.error : ' + JSON.stringify(message));
});
casper.on("resource.error", function(message) {
	this.echo('resource.error : ' + JSON.stringify(message));
});
casper.on('error', function(message) {
	this.echo('error : ' + JSON.stringify(message));
})

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
function bet(title, date, time, odds) {
	this.competition = competition;
	this.category = category;
	this.title = title;
	this.date = date;
	this.time = time;
	this.odds = odds;
}

function retrieveSports() {
	console.log("retrieveSports()");
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
		console.log(JSON.stringify(sports));
		retrieveCompetitions(0);
	});
}

function retrieveCompetitions(sportIndex) {
	console.log("retrieveCompetitions()");
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
		console.log(JSON.stringify(sports[sportIndex].competitions));
		retrieveCategories(sportIndex, 0);
	});
}

function retrieveCategories(sportIndex, competitionIndex) {
	console.log("retrieveCategories()");
	casper.click('#boostedsportsmenu > div:nth-child(2) > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ') > div:nth-child(1) > a:nth-child(2)');
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
		console.log(JSON.stringify(sports[sportIndex].competitions[competitionIndex].categories));
	});
}

function retrieveBets(sportIndex, competitionIndex, categoryIndex) {
	console.log("retrieveBets()");
	casper.click('.marketstypes-list > li:nth-child(' + (categoryIndex + 1) + ')');
	casper.waitForSelector('.eventpath-wrapper > h2', function() {
		sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].bets = this.evaluate(function() {
			var bets = [];
			$('.marketstypes-list > li').each(function(index) {
				var title = $(this).find('').text();
				var date = $(this).find('').text();
				var time = $(this).find('').text();
				var odds = $(this).find('').text();
				bets.push({title: title, date: date, time: time, odds: odds});
			});
			return bets;
		});
		console.log(JSON.stringify(sports[sportIndex].competitions[competitionIndex].categories[categoryIndex].bets));
	});
}

startTime = new Date().getTime();
console.log("Starting web scraper for gathering bets on unibet.fr.");
retrieveSports();
casper.run(function() {
	this.exit();
});