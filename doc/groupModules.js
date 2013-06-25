'use strict';


var util = require('./util');


var groupModules = function(doclets) {

	var ret = {};

	doclets.filter(function(record) {
		return !record.undocumented;
	}).forEach(function(record) {
		var moduleId = util.getModule(record);
		if (!moduleId) {
			return;
		}

		ret[moduleId] = ret[moduleId] || {
			meta: {
				dependencies: []
			},
			module: {},
			constructor: {},
			properties: {},
			methods: {},
			events: {}
		};

		if (record.kind === 'module') {
			ret[moduleId].module = record;
		}

		if (record.kind === 'class' && !record.imported) {
			ret[moduleId].constructor = record;
			return;
		}

		if (record.kind === 'member' || record.isEnum) {
			if (record.memberof !== moduleId) {
				//remove members of enums
				return;
			}
			ret[moduleId].properties[record.name] = record;
			return;
		}

		if (record.kind === 'function') {
			ret[moduleId].methods[record.name] = record;
			return;
		}

		if (record.kind === 'event') {
			ret[moduleId].events[record.name] = record;
			return;
		}
	});

	return ret;

};


module.exports = groupModules;
