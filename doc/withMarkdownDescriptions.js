'use strict';


var path = require('path');
var fs = require('fs');

var unique = require('mout/array/unique');
var compact = require('mout/array/compact');
var forOwn = require('mout/object/forOwn');

var util = require('./util.js');


var _commonBaseDirectory = function(firstDir, secondDir) {
	var first = firstDir.split('/');
	var second = secondDir.split('/');

	var x = 0;

	for (var i = 0; i < first.length; i++) {
		if ((i >= first.length) || (i >= second.length)) {
			break;
		}
		if (first[i + x] === second[i + x]) {
			x++;
		}
	}

	return first.slice(0, x).join('/');
};


var _commonBaseDirectoryInList = function(list) {
	var min;
	for (var i = 0; i < list.length - 1; i++) {
		var common = _commonBaseDirectory(list[i], list[i+1]);
		if (!min || common.length < min.length) {
			min = common;
		}
	}
	return min;
};


var withMarkdownDescriptions = function(doclets, markdownDir) {
	var files = doclets.map(function(record) {
		return util.getFile(record);
	});
	files = unique(compact(files));

	var srcDir = _commonBaseDirectoryInList(files);

	files = files.map(function(file) {
		var relative = path.relative(srcDir, file);
		var mdFile = path.resolve(markdownDir, path.dirname(relative), path.basename(relative, '.js') + '.md');
		if (!fs.existsSync(mdFile)) {
			return undefined;
		}
		return {
			src: file,
			md: mdFile
		};
	});
	files = compact(files);

	files.every(function(file) {
		var contents = fs.readFileSync(file.md, 'utf-8');

		//parse markdown "mixin" file for h2's "## [memberName]"
		var parts = contents.split(/^(##\s*\S*)$/gm);

		//first description in the file is the module description, if no
		//"## [memberName]" declaration exists before it
		if (parts.length && parts[0].trim() && parts[0].search(/^##\s*\S*$/) === -1) {
			var moduleDoclet = doclets.filter(function(record) {
				return record.kind === 'module' && util.getFile(record) === file.src;
			})[0];
			if (moduleDoclet) {
				moduleDoclet.description = parts[0];
			}
		}

		var mixinGraph = {};
		parts.forEach(function(part, i) {
			if (i === parts.length) {
				return;
			}
			if (part.search(/^##\s*\S*$/) !== -1 && parts[i+1]) {
				mixinGraph[part.replace(/##\s*/, '')] = parts[i+1];
			}
		});

		forOwn(mixinGraph, function(description, name) {
			doclets.forEach(function(record) {
				if (record.longname === name) {
					record.description = description;
					return;
				}
				if (record.name === name && util.getFile(record) === file.src) {
					record.description = description;
				}
			});
		});

		return true;
	});

	return doclets;

};


module.exports = withMarkdownDescriptions;
