'use strict';


var grunt = require('grunt/lib/grunt.js');
var child = require("child_process");
var constants = require('../constants.js');
var Deferred = require('deferreds/Deferred');


var runJsdoc = function(files) {
	var deferred = new Deferred();

	var command = constants.jsdocExe + ' -X ' + files.join(' ');
	grunt.verbose.writeln('> ' + command);

	child.exec(command, {maxBuffer: 2000000}, function(error, stdout) {
		if (error !== null) {
			throw new Error(error);
		}

		var result = JSON.parse(stdout);
		deferred.resolve({out: result});
	});

	return deferred.promise();
};


module.exports = runJsdoc;
