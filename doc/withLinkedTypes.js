'use strict';

var forOwn = require('mout/object/forOwn');
var every = require('mout/object/every');
var isFunction = require('mout/lang/isFunction');


var _resolveType = function(name, map) {
	//first try the fast dictionary approach for perfect String matches
	if (map[name]) {
		return map[name];
	}

	//next try generics (e.g. Array<String>)
	var matches;
	if ((matches = name.match(/(.*?)<(.*)>/))) {
		var container = matches[1];
		var containerType = _resolveType(container, map);

		if (!containerType) {
			return;
		}

		var argString = matches[2];

		var args = [];
		argString.split(',').forEach(function(arg) {
			var type = _resolveType(arg.trim(), map);
			args.push(type || {});
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
	var shortMatches = [];
	forOwn(map, function(type) {
		if (name === type.name) {
			shortMatches.push(type);
		}
	});

	if (shortMatches.length === 1) {
		return shortMatches[0];
	}
	/*
	 *else if (shortNames.length > 1){
	 *    grunt.log.subhead('WARNING: Ambiguous usage of short-name ' + name + '. Documentation will not present a link.');
	 *}
	 */


	var found;
	//next try types specified as functions, matching
	//against the provided name
	every(map, function(type) {
		if (isFunction(type.name)) {
			if (type.name(name) === true) {
				found = {
					name: name,
					longName: name,
					link: type.link
				};
				return false;
			}
		}

		return true;
	});

	return found || {
		name: name,
		longName: name,
		link: false
	};

};


var _rEscapeChars = /[\\.+*?\^$\[\](){}\/'#]/g;

var _escapeRegExp = function(str) {
	return str.replace(_rEscapeChars,'\\$&');
};

var sNamePath = '{(\\S*?)([#~\\.])(\\S*?)}';
var rNamePath = new RegExp(sNamePath);
var rNamePathGlobal = new RegExp(sNamePath, 'g');

var sClassName = '{([^{].*?)}';
var rClassName = new RegExp(sClassName);
var rClassNameGlobal = new RegExp(sClassName, 'g');

var rParams = /(\S*?)<(.*?)>/;


//finds the use of jsdoc longNames in descriptions and replaces them with links
//example: joss.mvc.Controller#bind -> [Controller.bind](link to joss.mvc.Controller#bind)
var _transformDescription = function(description, map, debug) {

	var matches;

	//first, class name + member name

	//global matching will disregard capturing groups, so
	//capture the full matches and then iterate over all of
	//them, matching again.
	matches = description.match(rNamePathGlobal) || [];
	matches.forEach(function(match) {
		var submatches = match.match(rNamePath);

		var name = submatches[0];
		var typeName = submatches[1];
		var scope = submatches[2];
		var propName = submatches[3];

		var rName = new RegExp(name, 'g');

		var type = _resolveType(typeName, map, 'inside ' + debug + ' description');

		var longName = type.longName + scope + propName;
		var shortName = type.name + '.' + propName;

		if (type.link) {
			description = description.replace(rName, '<a href="#/' + longName + '" title="' + longName + '">' + shortName + '</a>');
		}
		else {
			description = description.replace(rName, shortName);
		}
	});


	//then, just plain class names (no member name following)
	matches = description.match(rClassNameGlobal) || [];
	matches.forEach(function(match) {
		var submatches = match.match(rClassName);

		var typeName = submatches[1];
		var rName = new RegExp('{' + _escapeRegExp(typeName) + '}', 'g');
		//console.log(typeName);

		//see if the type is parameterized (like Java Generics; e.g. Array<Function>)
		if (typeName.search(rParams) !== -1) {
			var subMatches = typeName.match(rParams);
			var baseTypeName = subMatches[1];
			var args = subMatches[2].split(',');

			var baseType = _resolveType(baseTypeName, map, 'parameterized type inside ' + debug + ' description');

			var html = '<a href="' + baseType.link + '">' + baseType.name + '</a>';
			html += '&lt;';

			args.forEach(function(arg, i) {
				arg = arg.trim();
				if (i !== 0) {
					html += ', ';
				}
				var argType = _resolveType(arg, 'parameterized type #' + i + ' inside ' + debug + ' description');
				html += '<a href="' + argType.link + '">' + argType.name + '</a>';
			});

			html += '&gt;';

			description = description.replace(rName, html);
			return;
		}


		var type = _resolveType(typeName, map, 'inside ' + debug + ' description');
		var title = type.longName;
		if (type.longName === type.name) {
			title = '';
		}


		if (type.link) {
			description = description.replace(rName, '<a href="' + type.link + '" title="' + title + '">' + type.name + '</a>');
		}
		else {
			description = description.replace(rName, typeName);
		}
	});

	return description;

};


var withLinkedTypes = function(doclets, extraTypes) {

	var typeMap = {};

	doclets.forEach(function(record) {
		if (record.imported) {
			return;
		}

		if (record.kind === 'class' || record.kind === 'namespace') {
			typeMap[record.longname] = {
				longName: record.longname,
				name: record.name,
				link: '#/' + record.longname
			};
		}

		if (record.isEnum) {
			typeMap[record.longname] = {
				longName: record.longname,
				name: record.moduleName + '.' + record.name,
				link: '#/' + record.longname
			};
		}
	});

	//console.log(JSON.stringify(typeMap, false, 4));

	extraTypes.forEach(function(type) {
		if (!type.longName) {
			type.longName = type.name;
		}
		typeMap[type.longName || type.name] = type;
	});

	//console.log(JSON.stringify(typeMap, false, 4));

	return doclets.map(function(record) {
		var params = record.params || [];
		params.forEach(function(param) {
			param.types = param.type.names.map(function(name) {
				return _resolveType(name, typeMap);
			});
		});

		var returns = record.returns || [];
		returns.forEach(function(param) {
			//special: '@return this' sets the return type to the class' type
			if (param.description === 'this') {
				param.types = [_resolveType(record.memberof, typeMap)];
				record.chainable = true;
				return;
			}

			//special: flag methods returning a new instance of their class
			if (_resolveType(param.type.names[0], typeMap) === _resolveType(record.memberof, typeMap)) {
				record.chainable = false;
			}

			param.types = param.type.names.map(function(name) {
				return _resolveType(name, typeMap);
			});
		});

		if (record.kind === 'function' && !returns.length) {
			record.returns = record.returns || {};
			record.returns.types = [_resolveType('void', typeMap)];
		}

		if (record.augments) {
			record.augments = record.augments.map(function(name) {
				return _resolveType(name, typeMap);
			});
		}

		if (record.type) {
			record.types = record.type.names.map(function(name) {
				return _resolveType(name, typeMap);
			});
		}

		if (record.description) {
			record.description = _transformDescription(record.description, typeMap);
		}
		return record;
	});

};


module.exports = withLinkedTypes;
