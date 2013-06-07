'use strict';


var fs = require('fs');
var Modules = require('amd-tools/util/Modules');
var get = require('mout/object/get');


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

		var file = record.meta.path + '/' + record.meta.filename;
		var moduleLongName = cache[file] = cache[file] || Modules.getId(file, rjsconfig);
		record.moduleLongName = moduleLongName;
		record.moduleName = moduleLongName.split('/').pop();
		record.meta.file = file;
		return record;
	}).filter(function(record) {
		return record !== undefined;
	});

	//convention: if one class/namespace per module, name the same as this module
	ret.filter(function(record, i, list) {
		var isClass = (record.kind === 'class' || record.kind === 'namespace');
		var isOnlyClassInModule = list.filter(function(other) {
			return (other.kind === 'class' || other.kind === 'namespace') &&
				other.moduleLongName === record.moduleLongName;
		});
		return isClass && isOnlyClassInModule;
	}).forEach(function(record, i, list) {
		//update members of this class/namespace
		list.filter(function(other) {
			return other.moduleLongName === record.moduleLongName &&
				(
					other.memberof === record.longname ||
					other.memberof === '<anonymous>~' + record.longname
				);

		}).forEach(function(other) {
			other.longname = other.longname.replace(other.memberof, record.moduleName);
			other.memberof = record.moduleName;
		});

		//update the class/namespace itself
		record.name = record.moduleName;
		record.longname = record.moduleLongName;
	});

	//convention: see if there's a sibling file of the same name as
	//each undocumented property which contains an implementation (and documentation)
	ret.filter(function(record) {
		return record.undocumented;
	}).forEach(function(record, i, list) {
		var implFile = record.meta.path + '/' + record.name + '.js';
		var hasImplFile = fs.existsSync(implFile);

		if (!hasImplFile) {
			return;
		}

		var impl = list.filter(function(other) {
			return (
				!other.undocumented &&
				other.file === implFile &&
				other.name === record.name
			);
		})[0];

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
	}).forEach(function(record, i, list) {
		var implPath = record.meta.path + '/' + record.name.toLowerCase();
		var hasImplDirectory = fs.existsSync(implPath);

		if (!hasImplDirectory) {
			return;
		}
		
		var impl = list.filter(function(other) {
			return (
				!other.undocumented &&
				other.meta.path === implPath &&
				other.meta.filename === record.name + '.js' &&
				other.name === record.name
			);
		})[0];

		_copyDoclets(impl, record);
	});

	return ret;

};


module.exports = withModuleInfo;
