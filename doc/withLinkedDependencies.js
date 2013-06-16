'use strict';


var path = require('path');

var getDependencies = require('amd-tools/tasks/getDependencies');
var Modules = require('amd-tools/util/Modules');

var util = require('./util');


var withLinkedDependencies = function(doclets, linker, rjsconfig) {

	var cache = {};

	doclets.filter(function(record) {
		return record.kind === 'module';
	}).forEach(function(record) {
		var file = util.getFile(record);
		record.meta.dependencies = getDependencies(file).map(function(id) {
			if (id === 'require') {
				return undefined;
			}
			var depFile = Modules.getFile(id, path.dirname(file), rjsconfig);
			cache[depFile] = cache[depFile] || Modules.getId(depFile, rjsconfig);
			return {
				id: cache[depFile],
				link: linker(cache[depFile])
			};
		}).filter(function(dep) {
			return dep !== undefined;
		});
	});

	return doclets;

};


module.exports = withLinkedDependencies;
