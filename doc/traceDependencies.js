'use strict';


var constants = require('../constants.js');
var requirejs = require(constants.rjs);
var grunt = require('grunt/lib/grunt.js');
var util = require('./util.js');
var Deferred = require('../lib/deferreds.js').Deferred;


var traceDependencies = function(files) {

	var deferred = new Deferred();

	requirejs.config({
		baseUrl: __dirname,
		nodeRequire: require
	});

	requirejs(['../lib/parse'], function(parse) {

		var deps = {};

		files.forEach(function(filePath) {
			var moduleName = util.fileToModuleName(filePath);

			grunt.verbose.write('\t');
			var contents = grunt.file.read(filePath);

			try {
				deps[moduleName] = parse.findDependencies(filePath, contents);
			}
			catch(e) {
				deps[moduleName] = [];
			}

			//resolve requirejs dependencies relative to src path
			//(as opposed to relative to the file in which they're require'd)
			deps[moduleName] = deps[moduleName].map(function(depName) {
				return {
					fullName: util.moduleFullName(depName, filePath),
					link: ''
				};
			});
		});

		deferred.resolve(deps);

	});

	return deferred.promise();

};


module.exports = traceDependencies;
