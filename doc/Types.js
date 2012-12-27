'use strict';


var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');


//keep a list of all types used in the project
var typeMap = {};
var undeclaredTypes = [];


var Types = {

	map: typeMap,


	undeclared: undeclaredTypes,


	populateTypeMap: function(types) {
		_.each(types, function(type) {
			typeMap[type.longName || type.name || type.regexp] = type;
		});

		_.each(typeMap, function(type) {
			if (!type.longName) {
				type.longName = type.name;
			}
		});
	},


	addType: function(typeName, def) {
		typeMap[typeName] = def;
	},


	getType: function(name, debugContext) {
		if (!name) {
			return typeMap['void'];
		}

		//first try the fast dictionary approach for perfect String matches
		if (typeMap[name]) {
			return typeMap[name];
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
				var type = Types.getType(arg.trim(), debugContext + ' (type parameter #' + i + ' to ' + name + ')');
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
		var shortNames = _.filter(typeMap, function(type) {
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
		_.every(typeMap, function(type) {
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

	},


	defaultType: function(name) {
		return {
			name: name,
			longName: name,
			link: ''
		};
	}

};


module.exports = Types;
