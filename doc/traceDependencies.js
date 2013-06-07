'use strict';


var path = require('path');
var grunt = require('grunt/lib/grunt.js');
var getDependencies = require('amd-tools/tasks/getDependencies');
var Modules = require('amd-tools/util/Modules');


var traceDependencies = function(files, rjsconfig) {

	var deps = {};

	files.forEach(function(filePath) {
		var moduleName = Modules.getId(filePath, rjsconfig);
		grunt.verbose.write('\t');
		deps[moduleName] = getDependencies(filePath, rjsconfig);

		//resolve requirejs dependencies relative to src path
		//(as opposed to relative to the file in which they're require'd)
		deps[moduleName] = deps[moduleName].map(function(depName) {
			var file = Modules.getFile(depName, path.dirname(filePath), rjsconfig);
			console.log(file);
			if (!file) {
				return {};
			}
			return {
				fullName: Modules.getId(file, rjsconfig),
				link: ''
			};
		});
	});

	return deps;

};


module.exports = traceDependencies;
