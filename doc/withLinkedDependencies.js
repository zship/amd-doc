'use strict';


var path = require('path');

var getDependencies = require('amd-tools/tasks/getDependencies');
var Modules = require('amd-tools/util/Modules');
var flatten = require('mout/array/flatten');
var compact = require('mout/array/compact');

var util = require('./util');


var withLinkedDependencies = function(doclets, linker, rjsconfig) {

	var idCache = {};
	var depCache = {};

	var ownModules = {};
	doclets.filter(function(record) {
		return record.kind === 'module';
	}).forEach(function(record) {
		ownModules[record.name] = true;
	});

	doclets.filter(function(record) {
		return record.kind === 'module';
	}).map(function(record) {
		var file = util.getFile(record);
		depCache[file] = getDependencies(file);
		record.meta.dependencies = depCache[file].map(function(id) {
			if (id === 'require') {
				return undefined;
			}

			var depFile;
			try {
				depFile = Modules.getFile(id, path.dirname(file), rjsconfig);
				idCache[depFile] = idCache[depFile] || Modules.getId(depFile, rjsconfig);
			}
			catch (e) {
				throw new Error('Error trying to resolve dependency "' + id + '" of module "' + util.getFile(record) + '"');
			}

			return {
				id: idCache[depFile],
				link: linker(idCache[depFile], ownModules[idCache[depFile]])
			};
		}).filter(function(dep) {
			return dep !== undefined;
		});
		return record;
	}).map(function(record) {
		record.meta.whatrequires = compact(flatten(
			doclets.filter(function(other) {
				return other.kind === 'module' && other.name !== record.name;
			}).map(function(other) {
				var requiresModule = other.meta.dependencies.filter(function(dep) {
					return dep.id === record.name;
				}).length;
				if (requiresModule) {
					return {
						id: other.name,
						link: linker(other.name, true)
					};
				}
			})
		));
		return record;
	});

	return doclets;

};


module.exports = withLinkedDependencies;
