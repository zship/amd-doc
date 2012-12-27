'use strict';


var constants = require('../constants.js');
var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var util = require('./util.js');


var cacheJsdoc = function(json) {

	var cache = json.filter(function(record) {
		return record.meta && record.meta.filename && record.meta.path;
	});

	var moduleNameCache = {};
	cache = _.groupBy(cache, function(record) {
		var file = record.meta.path + '/' + record.meta.filename;
		moduleNameCache[file] = moduleNameCache[file] || util.fileToModuleName(file);
		return moduleNameCache[file];
	});
	moduleNameCache = {};

	_.each(cache, function(obj, key) {
		grunt.file.write(constants.cachedir + '/' + key + '.json', JSON.stringify(obj, false, 2), 'utf-8');
	});

};


module.exports = cacheJsdoc;
