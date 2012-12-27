'use strict';


var grunt = require('grunt/lib/grunt.js');
var child = require("child_process");
var constants = require('../constants.js');
var Deferred = require('../lib/deferreds.js').Deferred;


var runJsdoc = function(files) {
	var deferred = new Deferred();

	var command = constants.jsdocExe + ' -X ' + files.join(' ');
	grunt.verbose.writeln('> ' + command);

	child.exec(command, {maxBuffer: 2000000}, function(error, stdout) {
		if (error !== null) {
			deferred.reject(error);
		}

		//strip out error-causing lines
		stdout = stdout.replace(/<CircularRef>/gm, "\"CircularRef\"");
		stdout = stdout.replace(/<Object>/gm, "\"Object\"");
		stdout = stdout.replace(/:\sundefined/gm, ": \"undef\"");

		var result = JSON.parse(stdout);
		deferred.resolve({out: result});
	});

	return deferred.promise();
};


module.exports = runJsdoc;
