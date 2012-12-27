'use strict';


var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var Types = require('./Types.js');


var mixinInherited = function(graph) {

	// C3 Method Resolution Order
	// lifted from dojo/_base/declare and altered for our limited case
	var _c3mro = function(bases, className){
		var result = [], roots = [{cls: 0, refs: []}], nameMap = {}, clsCount = 1,
			l = bases.length, i = 0, j, lin, base, top, rec, name, refs;

		//console.log('C3: ' + className);

		// build a list of bases naming them if needed
		for(; i < l; ++i){
			base = bases[i];
			//console.log('base: ' + base.name);
			lin = base._meta ? base._meta.bases : [base];
			//lin = base.bases;
			/*
			 *lin.forEach(function(val) {
			 *    console.log('lin: ' + val.name);
			 *});
			 */
			top = 0;
			// add bases to the name map
			for(j = lin.length - 1; j >= 0; --j){
				name = lin[j].name;
				//console.log('get here 2: ' + name);
				//console.log('got here: ' + name);
				if(!nameMap.hasOwnProperty(name)){
					nameMap[name] = {count: 0, refs: [], cls: lin[j]};
					++clsCount;
				}
				rec = nameMap[name];
				if(top && top !== rec){
					rec.refs.push(top);
					++top.count;
				}
				top = rec;
				//console.log(JSON.stringify(top, false, 4));
			}
			++top.count;
			roots[0].refs.push(top);
		}

		//console.log(JSON.stringify(nameMap, false, 4));

		// remove classes without external references recursively
		while(roots.length){
			top = roots.pop();
			result.push(top.cls);
			--clsCount;
			// optimization: follow a single-linked chain
			while(refs = top.refs, refs.length == 1){
				top = refs[0];
				if(!top || --top.count){
					// branch or end of chain => do not end to roots
					top = 0;
					break;
				}
				result.push(top.cls);
				--clsCount;
			}
			if(top){
				// branch
				for(i = 0, l = refs.length; i < l; ++i){
					top = refs[i];
					if(!--top.count){
						roots.push(top);
					}
				}
			}
		}
		if(clsCount){
			console.error("can't build consistent linearization", className);
		}

		// calculate the superclass offset
		base = bases[0];
		/*
		 *result[0] = base ?
		 *    base._meta && base === result[result.length - base._meta.bases.length] ?
		 *        base._meta.bases.length : 1 : 0;
		 */
		if (!base) {
			result[0] = 0;
		}
		else if (base.bases && base === result[result.length - base.bases.length]) {
			result[0] = base.bases.length;
		}
		else {
			result[0] = 1;
		}

		if (result.length === 1) {
			return [];
		}
		else {
			return result.slice(1);
		}

	};


	//a simplied class graph containing only inheritance info
	var inheritanceGraph = (function() {
		var result = {};
		//start by just defining placeholders for each class
		_.each(graph, function(obj, className) {
			result[className] = {
				name: className,
				_meta: {},
				bases: []
			};
		});

		var requiresMissing = false;

		//add inheritance info
		_.each(graph, function(obj, className) {
			if (obj.constructor.augments) {
				obj.constructor.augments.forEach(function(superclassName) {
					if (!graph[superclassName]) {
						grunt.log.subhead('WARNING: ' + superclassName + ' declared as a superclass of ' + className + ', but does not exist or was not included in grunt option doc.include. Inheritance info will not be written out.');
						requiresMissing = true;
					}
					result[className].bases.push(result[superclassName]);
				});
			}
		});

		//we cannot determine all inheritance info with a missing
		//superclass. skip the rest.
		if (requiresMissing) {
			return {};
		}

		var _depth = function(base, depth) {
			depth = depth || 0;

			if (!base || !base.bases || !base.bases.length) {
				return depth;
			}

			depth++;

			var childDepth = [];
			base.bases.forEach(function(child, i) {
				childDepth[i] = _depth(child, depth);
			});
			return _.max(childDepth);
		};

		//sort by number of superclasses
		var sorted = _.chain(result).values().sortBy(function(obj) {
			return _depth(obj);
		}).map(function(obj) {
			return obj.name;
		}).value();

		//console.log(JSON.stringify(sorted, false, 4));

		//expand bases out to full hierarchy/linearize
		_.each(sorted, function(className) {
			if (!result[className].bases.length) {
				result[className]._meta.bases = [result[className]];
				result[className].isTop = true;
			}
			else {
				result[className]._meta.bases = _c3mro(result[className].bases, className);
				result[className]._meta.bases.unshift(result[className]);
			}
		});

		//console.log(JSON.stringify(result, false, 4));

		var ret = {};
		_.each(result, function(obj, className) {
			ret[className] = {
				name: className,
				bases: []
			};
			obj._meta.bases.forEach(function(base) {
				ret[className].bases.push(base.name);
			});
		});

		return ret;
	})();

	//console.log(JSON.stringify(inheritanceGraph, false, 4));

	//sort inheritanceGraph by number of superclasses, and override subclasses'
	//methods in-order
	_.chain(inheritanceGraph).values().sortBy(function(obj) {
		return -1 * obj.bases.length;
	}).value().forEach(function(obj) {
		var clazz = graph[obj.name];
		var className = obj.name;

		//add inheritance info into `graph` for use in final doc templates
		if (clazz.constructor && clazz.constructor.augments) {
			clazz.extends = [];
			clazz.constructor.augments.forEach(function(name) {
				clazz.extends.push(Types.getType(name, 'inheritance info - superclass of ' + className) || Types.defaultType(name));
			});
		}

		if (obj.bases.length) {
			clazz.heirarchy = [];
			obj.bases.forEach(function(name) {
				clazz.heirarchy.push(Types.getType(name, 'inheritance info - in heirarchy of ' + className) || Types.defaultType(name));
			});
		}

		//order from highest ancestor -> self
		obj.bases = obj.bases.reverse();
		//last entry is the class itself. remove.
		obj.bases.pop();

		var ownProps = {};
		['methods', 'properties'].forEach(function(type) {
			_.each(clazz[type], function(val, key) {
				ownProps[key] = true;
			});
		});

		obj.bases.forEach(function(superclassName) {
			var superclass = graph[superclassName];
			['methods', 'properties'].forEach(function(type) {
				_.each(superclass[type], function(prop, key) {
					//inherited (not defined on clazz)
					if (!ownProps[key]) {
						var oldDescription = (clazz[type][key] && clazz[type][key].description);
						clazz[type][key] = _.clone(prop);
						if (oldDescription) {
							clazz[type][key].description = oldDescription;
						}
						clazz[type][key].inherited = {
							name: Types.getType(superclassName).name,
							longName: prop.longName,
							link: '/#/' + prop.longName
						};
						clazz[type][key].link = prop.link.replace(superclassName, className);
						clazz[type][key].longName = prop.longName.replace(superclassName, className);

						//"chainable" property only applies to methods returning
						//instances of their class, which is impossible for an
						//inherited method
						delete clazz[type][key].chainable;
					}
					//overridden
					else {
						clazz[type][key].overridden = {
							name: Types.getType(superclassName).name,
							longName: prop.longName,
							link: '/#/' + prop.longName
						};
						clazz[type][key].description = clazz[type][key].description || prop.description;
					}
				});
			});
		});
	});

};


module.exports = mixinInherited;
