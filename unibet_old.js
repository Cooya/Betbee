var Nightmare = require('nightmare');
var nightmare = Nightmare({
	show: true,
	waitTimeout: 3000,
	gotoTimeout: 3000,
	loadTimeout: 3000,
	executionTimeout: 3000
});

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
function bet(competition, category, title, date, time, odds) {
	this.competition = competition;
	this.category = category;
	this.title = title;
	this.date = date;
	this.time = time;
	this.odds = odds;
}

function retrieveSports() {
	nightmare
	.goto('https://www.unibet.fr/sport/cotes-boostees')
	.wait('.eventpath-wrapper')
	.click('#boostedsportsmenu > h3:nth-child(1) > span:nth-child(2)')
	.wait('.SPORT_COTESBOOSTEES')
	.evaluate(function() {
		var sports = [];
		$('#boostedsportsmenu > .content > ul:nth-child(1) > li').each(function(index) {
			var title = $(this).find('.head .linkaction .label').text();
			var betsCount = $(this).find('.head > .arrowaction > span:nth-child(1)').text();
			if(title != 'Cotes Boostées')
				sports.push({title: title.split(/ |-/)[0], betsCount: betsCount});
		});
		return sports;
	})
	.then(function(value) {
		sports = value;
		console.log(sports);
	})
	.catch(function(error) {
		console.error("error : " + JSON.stringify(error));
	});
}

function retrieveCompetitions(sportIndex) {
	var cssSelector = '#boostedsportsmenu > .content > ul:nth-child(1) > li:nth-child(' + (sportIndex + 2) + ')';

	nightmare
	.goto('https://www.unibet.fr/sport/cotes-boostees')
	.wait('.eventpath-wrapper')
	.click('#boostedsportsmenu > h3:nth-child(1) > span:nth-child(2)')
	.wait('.SPORT_COTESBOOSTEES')
	.click(cssSelector)
	.wait(cssSelector + ' > .level1')
	.evaluate(function(cssSelector) {
		var competitions = [];
		$(cssSelector + ' > .level1 > li').each(function(index) {
			var title = $(this).find('.head .linkaction .label').text();
			var betsCount = $(this).find('.head > .arrowaction > span:nth-child(1)').text();
			competitions.push({title: title, betsCount: betsCount});
		}, cssSelector);
		return competitions;
	})
	.then(function(value) {
		sports[sportIndex].competitions = value;
		console.log(sports[sportIndex].competitions);
	})
	.catch(function(error) {
		console.error("error : " + JSON.stringify(error));
	});
}

//retrieveSports();
retrieveCompetitions(0);