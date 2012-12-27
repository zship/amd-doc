'use strict';


var Types = require('./Types.js');

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
var transformLongNames = function(description, debug) {

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

		var type = Types.getType(typeName, 'inside ' + debug + ' description') || Types.defaultType(typeName);

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

			var baseType = Types.getType(baseTypeName, 'parameterized type inside ' + debug + ' description') || Types.defaultType(baseTypeName);

			var html = '<a href="' + baseType.link + '">' + baseType.name + '</a>';
			html += '&lt;';

			args.forEach(function(arg, i) {
				arg = arg.trim();
				if (i !== 0) {
					html += ', ';
				}
				var argType = Types.getType(arg, 'parameterized type #' + i + ' inside ' + debug + ' description') || Types.defaultType(arg);
				html += '<a href="' + argType.link + '">' + argType.name + '</a>';
			});

			html += '&gt;';

			description = description.replace(rName, html);
			return;
		}


		var type = Types.getType(typeName, 'inside ' + debug + ' description') || Types.defaultType(typeName);
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


module.exports = transformLongNames;
