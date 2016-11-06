var Nightmare = require('nightmare');
var nightmare = Nightmare({
	show: true,
	waitTimeout: 3000,
	gotoTimeout: 3000,
	loadTimeout: 3000,
	executionTimeout: 3000
});

var sports = [];

nightmare
.goto('https://www.unibet.fr/sport/cotes-boostees')
.wait('.eventpath-wrapper')
.evaluate(function() {
	var sports = [];
	$('.linkaction').each(function(index) {
		sports.push($(this).attr('href'));
	});
	return sports;
})
.end()
.then(function(value) {
	console.log(value);
});


/*
.run(function(err, nightmare) {
	if(err) return console.log(err);
	console.log('Done!');
})
*/