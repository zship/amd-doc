'use strict';


var groupModules = function(doclets) {

	var ret = {};

	doclets.filter(function(record) {
		return !record.undocumented;
	}).forEach(function(record) {
		if (!record.moduleLongName) {
			return;
		}

		ret[record.moduleLongName] = ret[record.moduleLongName] || {
			meta: {
				dependencies: []
			},
			module: {},
			constructor: {},
			properties: {},
			methods: {}
		};

		if (record.kind === 'module') {
			ret[record.moduleLongName].module = record;
		}

		if (record.kind === 'class' && !record.imported) {
			ret[record.moduleLongName].constructor = record;
			return;
		}

		if (record.kind === 'member' || record.isEnum) {
			ret[record.moduleLongName].properties[record.name] = record;
			return;
		}

		if (record.kind === 'function') {
			ret[record.moduleLongName].methods[record.name] = record;
			return;
		}
	});

	return ret;

};


module.exports = groupModules;
