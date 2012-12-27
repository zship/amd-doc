'use strict';


var fs = require('fs');
var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var util = require('./util.js');
var constants = require('../constants.js');


var getJsdocCache = function(files) {

	var fileHashes = {};
	var staleFiles = [];
	var freshFiles = [];

	if (fs.existsSync(constants.fileHashesPath)) {
		fileHashes = JSON.parse(grunt.file.read(constants.fileHashesPath));

		staleFiles = _.chain(fileHashes).map(function(hash, filePath) {
			return {
				file: filePath,
				hash: hash
			};
		}).filter(function(obj) {
			//renamed or deleted .js file
			if (!fs.existsSync(obj.file)) {
				return false;
			}

			var cur = util.hashFile(obj.file);
			var prev = obj.hash;
			return cur !== prev;
		}).pluck('file').value();

		var newOrUpdatedFiles = _.difference(files, staleFiles);

		newOrUpdatedFiles.forEach(function(filePath) {
			var module = util.fileToModuleName(filePath);
			var cachePath = constants.cachedir + '/' + module + '.json';

			if (!fs.existsSync(cachePath)) { //new .js file
				staleFiles.push(filePath);
			}
			else {
				freshFiles.push(cachePath);
			}
		});
		//freshFiles = _.difference(freshFiles, toRemove);
		//staleFiles = _.difference(files, freshFiles);
	}
	else {
		staleFiles = files.slice(0);
	}

	return {
		index: fileHashes,
		stale: staleFiles,
		fresh: freshFiles
	};

};


module.exports = getJsdocCache;
