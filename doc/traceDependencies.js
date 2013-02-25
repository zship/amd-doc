'use strict';


var grunt = require('grunt/lib/grunt.js');
var util = require('./util.js');
var amd = require('grunt-lib-amd');


var traceDependencies = function(files) {

	var deps = {};

	files.forEach(function(filePath) {
		var moduleName = util.fileToModuleName(filePath);
		grunt.verbose.write('\t');
		deps[moduleName] = amd.getDeps(filePath);

		//resolve requirejs dependencies relative to src path
		//(as opposed to relative to the file in which they're require'd)
		deps[moduleName] = deps[moduleName].map(function(depName) {
			return {
				fullName: util.moduleFullName(depName, filePath),
				link: ''
			};
		});
	});

	return deps;

};


module.exports = traceDependencies;
