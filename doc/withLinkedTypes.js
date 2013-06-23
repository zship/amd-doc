'use strict';


var every = require('mout/object/every');
var filter = require('mout/object/filter');


//find the best match for a name out of known types
var cache = {};
var _materializeType = function(name, longNameMap, transformer) {
	if (cache[name]) {
		return cache[name];
	}

	//first try long names
	if (longNameMap[name]) {
		cache[name] = transformer({
			name: longNameMap[name],
			longName: name,
			displayName: name,
			link: '#'
		}, true);
		return cache[name];
	}

	//next try generics (e.g. Array<String>)
	var matches;
	if ((matches = name.match(/(.*?)<(.*)>/))) {
		var container = matches[1];
		var containerType = _materializeType(container, longNameMap, transformer);

		if (!containerType) {
			return;
		}

		var argString = matches[2];

		var args = [];
		argString.split(',').forEach(function(arg) {
			var type = _materializeType(arg.trim(), longNameMap, transformer);
			args.push(type || {});
		});

		cache[name] = transformer({
			generic: true,
			name: containerType.name,
			longName: containerType.longName,
			displayName: containerType.longName,
			link: containerType.link,
			args: args
		});
		return cache[name];
	}

	//next try defined short names
	var found;
	every(longNameMap, function(shortname, key) {
		if (shortname === name) {
			found = key;
			return false;
		}
		return true;
	});

	if (found) {
		var shortName = longNameMap[found];
		cache[shortName] = transformer({
			name: shortName,
			longName: found,
			displayName: found,
			link: '#'
		}, true);
		return cache[shortName];
	}

	cache[name] = transformer({
		name: name,
		longName: name,
		displayName: name,
		link: '#'
	});
	return cache[name];
};


var _rEscapeChars = /[\\.+*?\^$\[\](){}\/'#]/g;

var _escapeRegExp = function(str) {
	return str.replace(_rEscapeChars,'\\$&');
};

var sNamePath = '{(\\S*?)([#~\\.])(\\S*?)}';
var rNamePath = new RegExp(sNamePath);
var rNamePathGlobal = new RegExp(sNamePath, 'g');

var sClassName = '{([^{]\\S*?)}';
var rClassName = new RegExp(sClassName);
var rClassNameGlobal = new RegExp(sClassName, 'g');

var rParams = /(\S*?)<(\S*?)>/;


//finds the use of jsdoc longNames in descriptions and replaces them with links
//example: joss.mvc.Controller#bind -> [Controller.bind](link to joss.mvc.Controller#bind)
var _transformDescription = function(description, map, transformer, debug) {

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


		var clazz = _materializeType(typeName, map, transformer, 'inside ' + debug + ' description');
		var longName = clazz.longName + scope + propName;
		var type = _materializeType(longName, map, transformer);

		var rName = new RegExp(name, 'g');

		if (type.link) {
			description = description.replace(rName, '<a href="' + type.link + '" title="' + type.longName + '">' + type.displayName + '</a>');
		}
		else {
			description = description.replace(rName, type.displayName);
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

			var baseType = _materializeType(baseTypeName, map, transformer, 'parameterized type inside ' + debug + ' description');

			var html = '<a href="' + baseType.link + '">' + baseType.displayName + '</a>';
			html += '&lt;';

			args.forEach(function(arg, i) {
				arg = arg.trim();
				if (i !== 0) {
					html += ', ';
				}
				var argType = _materializeType(arg, map, transformer, 'parameterized type #' + i + ' inside ' + debug + ' description');
				html += '<a href="' + argType.link + '">' + argType.displayName + '</a>';
			});

			html += '&gt;';

			description = description.replace(rName, html);
			return;
		}


		var type = _materializeType(typeName, map, transformer, 'inside ' + debug + ' description');

		if (type.link) {
			description = description.replace(rName, '<a href="' + type.link + '" title="' + type.longName + '">' + type.displayName + '</a>');
		}
		else {
			description = description.replace(rName, type.displayName);
		}
	});

	return description;

};


var withLinkedTypes = function(doclets, transformer) {
	transformer = transformer || function() {};

	var longNameMap = {};

	doclets.forEach(function(record) {
		if (record.imported) {
			return;
		}

		if (record.undocumented) {
			return;
		}

		if (record.kind === 'module') {
			longNameMap[record.moduleLongName] = record.moduleName;
		}
		else if (record.isEnum) {
			longNameMap[record.longname] = record.moduleName + '.' + record.name;
		}
		else {
			longNameMap[record.longname] = record.name;
		}
	});

	/*
	 *longNameMap = filter(longNameMap, function(name, longName) {
	 *    if (longName.search(/<anonymous>~/) === -1) {
	 *        return true;
	 *    }
	 *    var parts = longName.match(/<anonymous>~(\S*?)/);
	 *    Object.keys(longNameMap).filter
	 *});
	 */

	//console.log(JSON.stringify(typeMap, false, 4));

	var result = doclets.map(function(record) {
		var params = record.params || [];
		params.forEach(function(param) {
			param.types = param.type.names.map(function(name) {
				return _materializeType(name, longNameMap, transformer);
			});
		});

		var returns = record.returns || [];
		returns.forEach(function(param) {
			//special: '@return this' sets the return type to the class' type
			if (param.description === 'this') {
				param.types = [_materializeType(record.memberof, longNameMap, transformer)];
				record.chainable = true;
				return;
			}

			//special: flag methods returning a new instance of their class
			if (_materializeType(param.type.names[0], longNameMap, transformer) === _materializeType(record.memberof, longNameMap, transformer)) {
				record.chainable = false;
			}

			param.types = param.type.names.map(function(name) {
				return _materializeType(name, longNameMap, transformer);
			});
		});

		if (record.kind === 'function' && !returns.length) {
			record.returns = [{
				types: [
					_materializeType('void', longNameMap, transformer)
				]
			}];
		}

		if (record.augments) {
			record.augments = record.augments.map(function(name) {
				return _materializeType(name, longNameMap, transformer);
			});
		}

		if (record.type) {
			record.types = record.type.names.map(function(name) {
				return _materializeType(name, longNameMap, transformer);
			});
		}

		if (record.kind === 'event' && !record.type) {
			record.types = [
				_materializeType('void', longNameMap, transformer)
			];
		}

		if (record.description) {
			record.description = _transformDescription(record.description, longNameMap, transformer);
		}
		return record;
	});

	//console.log(JSON.stringify(cache, false, 4));
	return result;

};


module.exports = withLinkedTypes;
