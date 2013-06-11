'use strict';


var fs = require('fs');
var path = require('path');

var Modules = require('amd-tools/util/Modules');
var forOwn = require('mout/object/forOwn');
var get = require('mout/object/get');

var util = require('./util');


var _copyDoclets = function(source, target) {
	target.kind = source.kind;
	target.type = source.type;
	target.params = source.params;
	target.returns = source.returns;
	target.description = source.description;
	//target.meta = source.meta;
	target.imported = {
		module: source.module,
		path: source.meta.path,
		filename: source.meta.filename,
		lineno: source.meta.lineno
	};
	target.undocumented = false;
};


var withModuleInfo = function(doclets, rjsconfig) {

	var cache = {};
	//derive module names from the file name
	var ret = doclets.map(function(record) {
		if (!get(record, 'meta.path')) {
			return undefined;
		}

		var file = util.getFile(record);
		var moduleLongName = cache[file] = cache[file] || Modules.getId(file, rjsconfig);
		record.moduleLongName = moduleLongName;
		record.moduleName = moduleLongName.split('/').pop();
		record.meta.file = file;
		return record;
	}).filter(function(record) {
		return record !== undefined;
	});

	//add jsdoc "kind: module" doclets
	forOwn(cache, function(moduleId, file) {
		var record = {
			meta: {
				file: file,
				filename: path.basename(file) + path.extname(file),
				path: path.dirname(file),
				lineno: 1
			},
			kind: 'module',
			name: moduleId,
			//longname: 'module:' + moduleId,
			longname: moduleId,
			moduleLongName: moduleId,
			moduleName: moduleId.split('/').pop()
		};
		ret.push(record);
	});

	//convention: if one class/namespace per module, name the same as this module
	ret.filter(function(record, i, list) {
		var isClass = (record.kind === 'class' || record.kind === 'namespace');
		var isOnlyClassInModule = list.filter(function(other) {
			return (other.kind === 'class' || other.kind === 'namespace') &&
				other.moduleLongName === record.moduleLongName;
		});
		return isClass && isOnlyClassInModule;
	}).forEach(function(record) {
		//update members of this class/namespace
		ret.filter(function(other) {
			return other.moduleLongName === record.moduleLongName &&
				(
					other.memberof === record.longname ||
					other.memberof === '<anonymous>~' + record.longname ||
					other.memberof === '<anonymous>~' + record.name
				);

		}).forEach(function(other) {
			//other.longname = other.longname.replace(other.memberof, 'module:' + record.moduleLongName);
			other.longname = other.longname.replace(other.memberof, record.moduleLongName);
			//other.memberof = 'module:' + record.moduleLongName;
			other.memberof = record.moduleLongName;
		});

		//update the class/namespace itself
		record.name = record.moduleName;
		//record.longname = 'module:' + record.moduleLongName;
		record.longname = record.moduleLongName;
	});

	//convention: see if there's a sibling file of the same name as
	//each undocumented property which contains an implementation (and documentation)
	ret.filter(function(record) {
		return record.undocumented;
	}).forEach(function(record) {
		var implFile = record.meta.path + '/' + record.name + '.js';
		if (!fs.existsSync(implFile)) {
			return;
		}

		var impl = ret.filter(function(other) {
			return (
				!other.undocumented &&
				util.getFile(other) === implFile &&
				other.name === record.name
			);
		})[0];

		if (!impl) {
			return;
		}

		_copyDoclets(impl, record);
	});

	//convention: see if there's a sibling directory of the same name as
	//each namespace which contains implementations (and documentation)
	ret.filter(function(record, i, list) {
		if (record.kind !== 'namespace') {
			return false;
		}
		var hasUndocumentedMembers = list.filter(function(other) {
			return (
				other.undocumented &&
				other.memberof === record.longname &&
				other.moduleLongName === record.moduleLongName
			);
		});
		return hasUndocumentedMembers;
	}).forEach(function(record) {
		var implPath = record.meta.path + '/' + record.name.toLowerCase();
		if (!fs.existsSync(implPath)) {
			return;
		}

		var impl = ret.filter(function(other) {
			return (
				!other.undocumented &&
				other.meta.path === implPath &&
				other.meta.filename === record.name + '.js' &&
				other.name === record.name
			);
		})[0];

		if (!impl) {
			return;
		}

		_copyDoclets(impl, record);
	});

	//console.log(JSON.stringify(ret, false, 4));


	return ret;

};


module.exports = withModuleInfo;
