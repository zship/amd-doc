'use strict';


var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var util = require('./util.js');
var constants = require('../constants.js');


var mixinMarkdown = function(graph) {
	var mixins = grunt.file.expand({filter: 'isFile'}, constants.mixindir + '/**');
	var documentedNames = [];

	mixins.every(function(path) {
		grunt.verbose.write('\t');
		var mixin = grunt.file.read(path);

		var moduleName = path.replace(constants.mixindir + '/', '').replace('.md', '');
		//var name = path.replace(/\//g, '.');
		var clazz = graph[moduleName];

		if (!clazz) {
			return true;
		}

		//console.log(JSON.stringify(clazz, false, 4));

		//mixin = mixin.replace(/^`*js$/gm, '```');
		//console.log(mixin);

		//parse markdown "mixin" file for h2's "## [memberName]"
		var mixinParts = mixin.split(/^(##\s*\S*)$/gm);
		//console.log(moduleName);
		//console.log('----');
		//console.log(mixinParts);

		//first description in the file is the module description, if no
		//"%[memberName]" declaration exists before it
		if (mixinParts.length && mixinParts[0].trim() && mixinParts[0].search(/^##\s*\S*$/) === -1) {
			clazz['module'] = {};
			clazz['module']['description'] = mixinParts[0];
		}

		var mixinGraph = {};
		for (var i = 0, l = mixinParts.length; i < l; i++) {
			var part = mixinParts[i];
			if (part.search(/^##\s*\S*$/) !== -1 && mixinParts[i+1]) {
				mixinGraph[part.replace(/##\s*/, '')] = mixinParts[i+1];
			}
		}
		//console.log(JSON.stringify(mixinGraph, false, 4));

		var descriptions = util.getDescriptions(clazz);
		//console.log(JSON.stringify(Object.keys(descriptions), false, 4));

		_.each(mixinGraph, function(value, key) {
			_.each(descriptions, function(obj) {
				var shortName;
				if (obj.longName === moduleName) {
					shortName = 'constructor';
				}
				else {
					shortName = obj.name;
				}

				if (shortName === key) {
					obj.description = value;
					documentedNames.push(obj.longName);
				}
			});
		});

		return true;
	});

	return documentedNames;

};


module.exports = mixinMarkdown;
