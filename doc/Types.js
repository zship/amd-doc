'use strict';


var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');


var Types = {};


Types.getTypes = function(doclets) {
	var map = {};

	doclets.forEach(function(record) {
		if (record.kind === 'class' || record.kind === 'namespace') {
			map[record.longName] = {
				longName: record.longName,
				name: record.name
			};
		}

		if (record.isEnum) {
			map[record.longname] = {
				longName: record.longname,
				name: record.moduleName + '.' + record.name
			};
		}
	});

	return map;
};


Types.resolve = function(name, map, debugContext) {
	if (!name) {
		return map['void'];
	}

	//first try the fast dictionary approach for perfect String matches
	if (map[name]) {
		return map[name];
	}

	//next try generics (e.g. Array<String>)
	var matches;
	if ((matches = name.match(/(.*?)<(.*)>/))) {
		var container = matches[1];
		var containerType = Types.getType(container, debugContext);

		if (!containerType) {
			return;
		}

		var argString = matches[2];

		var args = [];
		argString.split(',').forEach(function(arg, i) {
			var type = Types.resolve(arg.trim(), map, debugContext + ' (type parameter #' + i + ' to ' + name + ')');
			args.push(type || Types.defaultType(arg.trim()));
		});

		return {
			generic: true,
			name: containerType.name,
			longName: containerType.longName,
			link: containerType.link,
			args: args
		};
	}

	//next try short-names
	var shortNames = _.filter(map, function(type) {
		return (name === type.name);
	});

	if (shortNames.length === 1) {
		return shortNames[0];
	}
	else if (shortNames.length > 1){
		grunt.log.subhead('WARNING: Ambiguous usage of short-name ' + name + '. Documentation will not present a link.');
	}

	var foundMatch;

	//next try types specified as RegExp objects, matching
	//against the provided name
	_.every(map, function(type) {
		if (!type.regexp) {
			return true;
		}

		if (name.search(type.regexp) !== -1) {
			foundMatch = {
				name: name.replace(type.regexp, '$1'),
				longName: name,
				link: name.replace(type.regexp, type.link)
			};
			return false;
		}

		return true;
	});

	if (foundMatch) {
		return foundMatch;
	}


	undeclaredTypes.push({
		name: name,
		context: debugContext
	});

	//a class, not a method/member
	/*
	 *if (name.search(/[#~\.]/g) === -1 && !missingNames[name]) {
	 *    missingNames[name] = true;
	 *    grunt.log.subhead('WARNING: The type ' + name + ' was not declared anywhere in the project. Documentation will not present a link.');
	 *}
	 */

};


module.exports = Types;
