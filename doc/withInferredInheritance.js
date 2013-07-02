'use strict';


var path = require('path');

var compact = require('mout/array/compact');
var deepClone = require('mout/lang/deepClone');
var rjs = require('amd-tools/util/requirejs');

var util = require('./util');


var withInferredInheritance = function(doclets, rjsconfig) {
	var requirejs = rjs();
	rjsconfig.baseUrl = path.resolve(rjsconfig.baseUrl);
	//rjsconfig.nodeRequire = require;
	requirejs.config(rjsconfig);

	var classList = doclets.filter(function(record) {
		return record.kind === 'class';
	});

	/*
	 *requirejs(classList.map(function(record) {
	 *    return util.getFile(record);
	 *}), function(args) {
	 *    debugger;
	 *});
	 *return doclets;
	 */

	classList.map(function(record) {
		var moduleId = util.getModule(record);
		//var file = util.getFile(record);
		//record.prototypeObject = requireWith(moduleId, rjsconfig).prototype;
		record.prototypeObject = requirejs(moduleId).prototype;
		return record;
	}).map(function(record) {
		var bases = [];
		var curr = record.prototypeObject;
		while ((curr = Object.getPrototypeOf(curr)) !== Object.prototype) {
			bases.push(curr);
		}

		var baseNames = bases.map(function(base) {
			var baseRecord = classList.filter(function(record) {
				return record.prototypeObject === base;
			})[0];
			if (baseRecord) {
				//console.log(baseRecord.longname);
				return baseRecord.longname;
			}

			//try global objects
			var globalName;
			Object.getOwnPropertyNames(root).every(function(key) {
				if (root[key] && root[key].prototype === base) {
					globalName = key;
					return false;
				}
				return true;
			});

			return globalName;
		});

		if (compact(baseNames).length) {
			record.augments = baseNames;
		}
		record.augments = record.augments || [];

		return record;
	});

	//console.log(JSON.stringify(classList, false, 4));

	//doclets = withResolvedAugments(doclets);

	//convert "augments" doclets into linearized inheritance heirarchy
	//doclets = withLinearizedHeirarchy(doclets);

	//remove any existing inherited doclets
	doclets = doclets.filter(function(record) {
		return !record.inherited;
	});

	var inheritedDoclets = [];

	//sort classes by number of superclasses, and override subclasses' methods
	//in-order
	classList.sort(function(a, b) {
		return a.augments.length - b.augments.length;
	}).forEach(function(clazz) {
		var className = clazz.longname;

		//order from highest ancestor -> self
		var bases = clazz.augments.reverse();

		var ownProps = {};
		doclets.forEach(function(record) {
			if (record.memberof === className) {
				ownProps[record.name] = record;
			}
		});

		bases.forEach(function(superclassName) {
			//for js global objects (String, Array...) which are probably not
			//documented in this jsdoc run, mark any same-named overridden
			//methods/props as being overridden
			if (root[superclassName]) {
				var proto = root[superclassName].prototype;
				Object.getOwnPropertyNames(proto).forEach(function(name) {
					if (ownProps.hasOwnProperty(name)) {
						ownProps[name].overrides = ownProps[name].longname.replace(className, superclassName);
						ownProps[name].overridden = true;
					}
				});
			}

			doclets.filter(function(record) {
				return record.memberof === superclassName;
			}).forEach(function(record) {

				//inherited (not defined on clazz)
				if (!ownProps.hasOwnProperty(record.name)) {
					if (record.access && record.access === 'private') {
						return;
					}

					var inherited = deepClone(record);
					inherited.memberof = className;
					inherited.longname = inherited.longname.replace(superclassName, className);
					inherited.inherits = record.longname;
					inherited.inherited = true;
					inheritedDoclets.push(inherited);
				}
				//overridden
				else {
					ownProps[record.name].overrides = record.longname;
					ownProps[record.name].overridden = true;
				}

			});
		});

	});

	//return doclets to a state consistent with vanilla jsdoc
	classList.map(function(record) {
		if (!record.augments.length) {
			delete record.augments;
		}
		delete record.prototypeObject;
		return record;
	});

	return doclets.concat(inheritedDoclets);

};


module.exports = withInferredInheritance;
