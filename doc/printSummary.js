'use strict';


var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var Types = require('./Types.js');
var util = require('./util.js');


var printSummary = function(graph, documentedNames, undocumentedNames, markdownDocumentedNames) {
	var typeNames = [];
	_.each(Types.typeMap, function(obj) {
		typeNames.push(obj.name);
	});

	var typeConflicts = _.difference(typeNames, _.uniq(typeNames));

	grunt.log.subhead('Declared types');
	grunt.log.writeln('===========================================================');
	grunt.log.writeln('Use --verbose for more information');

	grunt.log.writeln('');
	grunt.log.writeln('Ambiguous short-names: ' + typeConflicts.length);
	grunt.verbose.writeln('-----------------------------------------------------------');
	if (typeConflicts.length) {
		grunt.verbose.writeln('Long-names must be used in jsdoc annotations and inline "{}" references for these types:');
		typeConflicts.forEach(function(name) {
			var types = _.filter(Types.map, function(obj) {
				return obj.name === name;
			});
			grunt.verbose.write(name + ' could refer to: ');
			types.forEach(function(obj) {
				grunt.verbose.write(obj.longName + ' ');
			});
			grunt.verbose.write('\n');
		});
	}
	else {
		grunt.verbose.writeln('(None)');
	}
	/*
	 *else {
	 *    grunt.log.writeln('Congratulations! You can use short names ("Rect" vs "joss/geometry/Rect") in your jsdoc annotations and inline "{}" references!');
	 *}
	 */

	grunt.verbose.writeln('');
	grunt.log.writeln('Never-declared (but used) types: ' + Types.undeclared.length);
	grunt.verbose.writeln('-----------------------------------------------------------');
	if (Types.undeclared.length) {
		Types.undeclared.forEach(function(type) {
			grunt.verbose.writeln(type.name + ' (Location: ' + type.context + ')');
		});
	}
	else {
		grunt.verbose.writeln('(None)');
	}

	grunt.verbose.writeln('');
	grunt.verbose.writeln('All declared types:');
	grunt.verbose.writeln('-----------------------------------------------------------');
	var typeLongNames = _.compact(_.pluck(Types.map, 'longName'));
	var maxLength = _.max(typeLongNames, function(name) {
		return name.length;
	}).length + 1;
	grunt.verbose.writeln(grunt.log.table([maxLength, 2, 40], ['Long Name', '|', 'Short Name']));
	grunt.verbose.writeln('-----------------------------------------------------------');
	typeLongNames.sort().forEach(function(name) {
		grunt.verbose.writeln(grunt.log.table([maxLength, 2, 40], [name, '|', Types.map[name].name]));
		//grunt.verbose.writeln(name + ' - ' + typeMap[name].name);
	});


	grunt.log.subhead('Documentation Coverage');
	grunt.log.writeln('===========================================================');
	grunt.log.writeln('Use --verbose to see the names of all undocumented variables');
	grunt.log.writeln('');

	//calculate documentation coverage
	var docFileMap = {};
	var docTotal = util.getDescriptions(graph).filter(function(obj) {
		return !!obj.longName;
	}).map(function(obj) {
		if (!obj.inherited) {
			docFileMap[obj.longName] = obj.meta.path + '/' + obj.meta.filename + ':' + obj.meta.lineno;
			return obj.longName;
		}
		return '';
	});

	docTotal = _.chain(docTotal).compact().uniq().value();

	var mdownMissing = _.difference(docTotal, markdownDocumentedNames);
	grunt.verbose.writeln('');
	grunt.log.writeln('Markdown description coverage: ' + markdownDocumentedNames.length + ' of ' + docTotal.length + ' (' + ((markdownDocumentedNames.length / docTotal.length) * 100).toFixed(1) + '%)');
	grunt.verbose.writeln('-----------------------------------------------------------');
	grunt.verbose.writeln('The following variables have no markdown documentation:');
	grunt.verbose.writeln('');
	if (mdownMissing.length) {
		mdownMissing.sort().forEach(function(name) {
			grunt.verbose.writeln(name + ' (' + docFileMap[name] + ')');
		});
	}
	else {
		grunt.verbose.writeln('(None)');
	}

	var docPresent = util.getDescriptions(graph).map(function(obj) {
		if (obj.description && obj.description.trim() && !obj.inherited) {
			return obj.longName;
		}
		return '';
	});

	docPresent = _.chain(docPresent).compact().uniq().value();

	var docMissing = _.difference(docTotal, docPresent);
	grunt.verbose.writeln('');
	grunt.log.writeln('All description coverage: ' + docPresent.length + ' of ' + docTotal.length + ' (' + ((docPresent.length / docTotal.length) * 100).toFixed(1) + '%)');
	grunt.verbose.writeln('-----------------------------------------------------------');
	grunt.verbose.writeln('The following variables have no descriptions (inherited or otherwise):');
	grunt.verbose.writeln('');
	if (docMissing.length) {
		docMissing.sort().forEach(function(name) {
			grunt.verbose.writeln(name + ' (' + docFileMap[name] + ')');
		});
	}
	else {
		grunt.verbose.writeln('(None)');
	}

	undocumentedNames = undocumentedNames.filter(function(obj) {
		//remove private-ish names and proven-documented names (jsdoc will count all usages of a property as separate undocumented cases)
		return (obj.name.search(/.*[#.][_'"]/) === -1)
			&& (!documentedNames[obj.name])
			&& (obj.name.search(/~/g) === -1);
	}).map(function(obj) {
		return obj.name + ' (' + obj.file + ')';
	});

	undocumentedNames = _.chain(undocumentedNames).compact().value();

	grunt.verbose.writeln('');
	grunt.log.writeln('Direct members of classes with no jsdoc annotations: ' + undocumentedNames.length);
	grunt.verbose.writeln('-----------------------------------------------------------');
	grunt.verbose.writeln('_name, \'name\', "name" not included.');
	grunt.verbose.writeln('');
	if (undocumentedNames.length) {
		undocumentedNames.sort().forEach(function(name) {
			grunt.verbose.writeln(name);
		});
	}
	else {
		grunt.verbose.writeln('(None)');
	}
};


module.exports = printSummary;
