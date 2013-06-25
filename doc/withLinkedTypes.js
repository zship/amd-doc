'use strict';


var escapeRegExp = require('mout/string/escapeRegExp');

var resolve = require('../doclets/resolve');


//find the best match for a name out of known types
var cache = {};
var _materializeType = function(name, doclets, transformer) {
	name = name.replace(/[{}]/g, '');

	if (cache[name]) {
		return cache[name];
	}

	var match = resolve(doclets, name);
	if (match) {
		cache[name] = transformer({
			own: true,
			name: match.name,
			longName: match.longname,
			displayName: name,
			link: '#'
		});
		return cache[name];
	}

	//generics (e.g. Array<String>)
	var matches;
	if ((matches = name.match(/(.*?)<(.*)>/))) {
		var container = matches[1];
		var containerType = _materializeType(container, doclets, transformer);

		if (!containerType) {
			return;
		}

		var argString = matches[2];

		var args = [];
		argString.split(',').forEach(function(arg) {
			var type = _materializeType(arg.trim(), doclets, transformer);
			args.push(type || {});
		});

		cache[name] = {
			generic: true,
			name: containerType.name,
			longName: containerType.longName,
			displayName: containerType.displayName,
			link: containerType.link,
			args: args
		};
		return cache[name];
	}

	//give up
	cache[name] = transformer({
		name: name,
		longName: name,
		displayName: name,
		link: '#'
	});
	return cache[name];
};


//finds the use of jsdoc longNames in descriptions and replaces them with links
//example: joss.mvc.Controller#bind -> [Controller.bind](link to joss.mvc.Controller#bind)
var _transformDescription = function(description, doclets, transformer) {

	var matches = description.match(/\{[^\{]\S+?\}/g) || [];
	matches.forEach(function(name) {
		var type = _materializeType(name, doclets, transformer);
		var from = new RegExp(escapeRegExp(name), 'g');
		var to = type.displayName;

		if (type.args) {
			to = '<a href="' + type.link + '">' + type.displayName + '</a>';
			to += '&lt;';

			type.args.forEach(function(arg, i) {
				if (i !== 0) {
					to += ', ';
				}
				to += '<a href="' + arg.link + '">' + arg.displayName + '</a>';
			});

			to += '&gt;';
		}
		else if (type.link) {
			to = '<a href="' + type.link + '" title="' + type.longName + '">' + type.displayName + '</a>';
		}

		description = description.replace(from, to);
	});

	return description;

};


var withLinkedTypes = function(doclets, transformer) {
	transformer = transformer || function() {};

	doclets = doclets.filter(function(record) {
		return !record.undocumented;
	});

	var result = doclets.map(function(record) {
		var params = record.params || [];
		params.forEach(function(param) {
			param.types = param.type.names.map(function(name) {
				return _materializeType(name, doclets, transformer);
			});
		});

		var returns = record.returns || [];
		returns.forEach(function(param) {
			//special: '@return this' sets the return type to the class' type
			if (param.description === 'this') {
				param.types = [_materializeType(record.memberof, doclets, transformer)];
				record.chainable = true;
				return;
			}

			//special: flag methods returning a new instance of their class
			if (_materializeType(param.type.names[0], doclets, transformer) === _materializeType(record.memberof, doclets, transformer)) {
				record.chainable = false;
			}

			param.types = param.type.names.map(function(name) {
				return _materializeType(name, doclets, transformer);
			});
		});

		if (record.kind === 'function' && !returns.length) {
			record.returns = [{
				types: [
					_materializeType('void', doclets, transformer)
				]
			}];
		}

		if (record.augments) {
			record.augments = record.augments.map(function(name) {
				return _materializeType(name, doclets, transformer);
			});
		}

		if (record.inherits) {
			record.inherits = _materializeType(record.inherits, doclets, transformer);
		}

		if (record.overrides) {
			record.overrides = _materializeType(record.overrides, doclets, transformer);
		}

		if (record.type) {
			record.types = record.type.names.map(function(name) {
				return _materializeType(name, doclets, transformer);
			});
		}

		if (record.kind === 'module' || record.kind === 'class') {
			record.types = [_materializeType(record.longname, doclets, transformer)];
		}

		if (record.kind === 'event' && !record.type) {
			record.types = [
				_materializeType('void', doclets, transformer)
			];
		}

		if (record.description) {
			record.description = _transformDescription(record.description, doclets, transformer, doclets);
		}
		return record;
	});

	//console.log(JSON.stringify(cache, false, 4));
	return result;

};


module.exports = withLinkedTypes;
