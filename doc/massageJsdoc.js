'use strict';


var path = require('path');
var fs = require('fs');
var taffy = require('taffy');
var Types = require('./Types.js');
var Modules = require('amd-tools/util/Modules');


var massageJsdoc = function(json, deps, rjsconfig) {

	var documentedNames = {};
	var undocumentedNames = [];

	//console.log(JSON.stringify(json, false, 4));


	var db = taffy(json);


	//we're handling (multiple) inheritance ourselves. besides, jsdoc has a
	//weird behavior of assigning the filename and path from the superclass
	//to the subclass, and I'd like to be able to identify methods by filename
	db({inherited: true}).remove();


	var cache = {};
	//derive module names from the file name
	db().each(function(record) {
		if (record && record.meta && record.meta.path) {
			var fileName = record.meta.path + '/' + record.meta.filename;
			cache[fileName] = cache[fileName] || Modules.getId(fileName, rjsconfig);

			var moduleName = cache[fileName];
			var moduleShortName;
			if (moduleName.search(/\//g) !== -1) {
				moduleShortName = moduleName.match(/.*\/(.*)$/).pop();
			}
			else {
				moduleShortName = moduleName;
			}

			record.module = moduleName;
			record.moduleShortName = moduleShortName;
		}
	});
	cache = {};


	db({kind: ['class', 'namespace']}).each(function(record) {
		//AMD convention: class names and namespace names are the same as
		//their module name
		var clazz = record;
		var moduleName = record.module;

		//update members of this class to point to the new class name
		db(function() {
			return !!(
				this.memberof === clazz.longname &&
				this.meta &&
				this.meta.path === clazz.meta.path &&
				this.meta.filename === clazz.meta.filename
			);
		}).each(function(record) {
			record.longname = record.longname.replace(record.memberof, moduleName);
			record.memberof = moduleName;
		});

		clazz.longname = moduleName;
		//convention: class short names are the last part of their module's name (e.g. 'joss/geometry/Point' -> 'Point')
		clazz.name = record.moduleShortName;
		//console.log(JSON.stringify(clazz, false, 4));

		//update "static" members of this class to point to the new class name
		db(function() {
			return !!(
				(
					this.memberof === '<anonymous>~' + clazz.name ||
					this.memberof === clazz.name
				) &&
				this.meta &&
				this.meta.path === clazz.meta.path &&
				this.meta.filename === clazz.meta.filename
			);
		}).each(function(record) {
			record.longname = record.longname.replace(record.memberof, moduleName);
			record.memberof = moduleName;
		});

		//update "inner" members of this class to point to the new class name
		//(mostly used for jquery plugins inside a module, or anything else
		//which alters a namespace other than this module's)
		db(function() {
			return !!(
				this.meta &&
				this.meta.path === clazz.meta.path &&
				this.meta.filename === clazz.meta.filename &&
				this.memberof &&
				this.memberof.search(/<anonymous>~/) !== -1 &&
				this.memberof.search(new RegExp('<anonymous>~' + clazz.name, 'g')) === -1 &&
				!this.undocumented //these are common, so make transforming their names explicit (only if they have jsdoc annotations)
			);
		}).each(function(record) {
			record.longname = record.longname.replace(/<anonymous>/, moduleName);
			record.memberof = moduleName;
			//retain namespace name in the short name (e.g. '$.fn')
			record.name = record.longname.match(/.*~(.*)$/).pop();
		});
	});


	var _transferDoclets = function(target, source) {
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


	db({kind: ['class', 'namespace']}).each(function(record) {
		var clazz = record;
		var className = clazz.longname;

		//AMD convention: see if there's a sibling directory of the
		//same name as the class which contains implementations (and
		//documentation)
		var implPath = clazz.meta.path + '/' + clazz.name.toLowerCase();
		var resolvedImplPath = path.resolve(process.cwd() + '/' + implPath);
		var hasImplDirectory = fs.existsSync(resolvedImplPath);
		//console.log(implPath, hasImplDirectory);

		//get all undocumented members of this class
		db(function() {
			return (
				this.undocumented &&
				this.memberof === className &&
				this.meta &&
				this.meta.path === clazz.meta.path &&
				this.meta.filename === clazz.meta.filename
			);
		}).each(function(record) {
			var impl;

			//is there an implementation file in the same directory as the
			//class? (with the same name as the undocumented member)
			var implFile = clazz.meta.path + '/' + record.name + '.js';
			var resolvedImplFile = path.resolve(process.cwd() + '/' + implFile);
			var hasImplFile = fs.existsSync(resolvedImplFile);

			if (hasImplFile && (impl = db(function() {
				return (
					this.name === record.name &&
					this.meta &&
					this.meta.path + '/' + this.meta.filename === implFile &&
					!this.undocumented
				);
			}).first())) {
				_transferDoclets(record, impl);
			}
			//find a file with documentation under implPath with the same
			//name as the undocumented member
			else if (hasImplDirectory && (impl = db(function() {
				return (
					this.name === record.name &&
					this.meta &&
					this.meta.path === implPath &&
					this.meta.filename === record.name + '.js' &&
					!this.undocumented
				);
			//if one exists, apply its documentation to the undocumented member
			}).first())) {
				_transferDoclets(record, impl);
			}
			//else, flag this as an undocumented class member (for summary info)
			else {
				undocumentedNames.push({
					name: record.longname,
					file: record.meta.path + '/' + record.meta.filename + ':' + record.meta.lineno
				});
			}
		});
	});


	//subsequent processing can be sped up by removing undocumented
	//variables (which outnumber documented ones, since every single
	//variable in any scope is counted by jsdoc)
	db({undocumented: true}).remove();


	//reassign 'anonymous'-scoped variables to their module's scope
/*
*        db({longname: {'like': '<anonymous>'}}).each(function(record) {
*            if (record.module) {
*                //convention: 'anonymous' variables under the same name as the
*                //module/class's short name are static members of that class
*                var moduleShortName = record.module.match(/.*\/(.*)$/).pop();
*                if (record.longname.search(new RegExp('<anonymous>~' + moduleShortName)) !== -1) {
*                    record.longname = record.longname.replace('<anonymous>~' + moduleShortName, record.module);
*                    return; //continue
*                }
*
*                record.longname = record.longname.replace('<anonymous>', record.module);
*                record.name = record.longname.match(/.*~(.*)$/).pop();
*            }
*        });
*/
	var modules = {};
	db().each(function(record) {
		if (!record.module) {
			return;
		}
		modules[record.module] = modules[record.module] || [];
		modules[record.module].push(record);

		var moduleName = record.module;
		var moduleShortName = record.module.split('/').pop();
		Types.addType(moduleName, {
			userDefined: true,
			longName: moduleName,
			name: moduleShortName,
			link: '#/' + moduleName
		});
	});
	//console.log(JSON.stringify(modules, false, 4));


	//collect a map of longnames to short aliases for classes, to be used
	//when printing parameters and return types
	db({kind: ['class', 'namespace']}).each(function(record) {
		var className = record.name;
		var classLongName = record.longname;
		Types.addType(classLongName, {
			userDefined: true,
			longName: classLongName,
			name: className,
			link: '#/' + classLongName
		});
	});

	db({isEnum: true}).each(function(record) {
		Types.addType(record.longname, {
			userDefined: true,
			longName: record.longname,
			name: record.moduleShortName + '.' + record.name,
			link: '#/' + record.longname
		});
	});


	db().each(function(record) {
		if (!record.longname) {
			return true;
		}

		documentedNames[record.longname] = true;
	});


	var graph = {};
	Object.keys(modules).forEach(function(moduleName) {
		//console.log(moduleName);

		var module = modules[moduleName];
		var kind = (function() {
			var isClassModule = module.filter(function(record) {
				return record.kind === 'class';
			}).length;
			if (isClassModule) {
				return 'class';
			}
			var isNamespaceModule = module.filter(function(record) {
				return record.kind === 'namespace';
			}).length;
			if (isNamespaceModule) {
				return 'namespace';
			}
			return 'misc';
		})();
		var fileName = module[0].meta.path + '/' + module[0].meta.filename;

		//see if items in the dependency array are in the type map (for linking
		//in final documentation)
		deps[moduleName].forEach(function(dep) {
			var type = Types.getType(dep.fullName, fileName + ' requirejs dependency');
			if (type && type.link) {
				dep.link = type.link;
			}
		});


		//record.description = record.description || '';

		graph[moduleName] = {};
		graph[moduleName]['meta'] = {
			deps: deps[moduleName]
		};
		graph[moduleName]['constructor'] = {};
		graph[moduleName]['properties'] = {};
		graph[moduleName]['methods'] = {};
		graph[moduleName]['jquery'] = {};


		if (kind === 'class') {
			var constructor = graph[moduleName]['constructor'] = module.filter(function(record) {
				return record.kind === 'class';
			})[0];
			constructor.longName = constructor.longname;
			constructor.link = Types.getType(constructor.longName).link;
			constructor.description = constructor.description || '';

			constructor.params = constructor.params || [];
			constructor.params.forEach(function(param) {
				if (!param.type || !param.type.names) {
					param.type = Types.getType(null);
					return true;
				}

				param.types = [];
				param.type.names.forEach(function(name, i) {
					var type = Types.getType(name, constructor.longName + ' constructor parameter #' + i);
					if (!type) {
						type = Types.defaultType(name);
					}
					param.types.push(type);
				});
			});
		}


		module
			.filter(function(record) {
				return record.kind === 'member';
			})
			.forEach(function(record) {
				var member = graph[moduleName]['properties'][record.name] = record;
				member.longName = member.longname;
				member.link = '#/' + member.longName;

				if (!member.type || !member.type.names) {
					member.types = [Types.getType(null)];
				}
				else {
					member.types = [];
					member.type.names.forEach(function(name) {
						var type = Types.getType(name, member.longName + ' type');
						if (!type) {
							type = Types.defaultType(name);
						}
						member.types.push(type);
					});
				}

				member.description = member.description || '';
			});


		module
			.filter(function(record) {
				return record.isEnum;
			})
			.forEach(function(record) {
				var member = graph[moduleName]['properties'][record.name] = record;
				member.longName = member.longname;
				member.link = '#/' + member.longName;

				if (!member.type || !member.type.names) {
					member.types = [Types.getType(null)];
				}
				else {
					member.types = [];
					member.type.names.forEach(function(name) {
						var type = Types.getType(name, member.longName + ' type');
						if (!type) {
							type = Types.defaultType(name);
						}
						member.types.push(type);
					});
				}

				member.description = member.description || '';
			});


		module
			.filter(function(record) {
				return record.kind === 'function';
			})
			.forEach(function(record) {
				try {

					//console.log(JSON.stringify(record, null, 4));
					var method;

					if (record.longname.search(/\$\.fn/g) !== -1) {
						method = graph[moduleName]['jquery'][record.name] = record;
						method.scope = ''; //avoid 'static' qualifier
					}
					else {
						method = graph[moduleName]['methods'][record.name] = record;
					}

					method.longName = method.longname;
					method.link = '#/' + method.longName;
					method.description = method.description || '';

					method.params = method.params || [];
					method.params.forEach(function(param) {
						if (!param.type || !param.type.names) {
							param.types = [Types.getType(null)];
							return true;
						}

						//jsdoc outputs "undefined" instead of undefined
						Object.keys(param).forEach(function(key) {
							if (param[key] === 'undefined') {
								param[key] = false;
							}
						});

						param.types = [];
						param.type.names.forEach(function(name, i) {
							var type = Types.getType(name, method.longName + ' parameter #' + i);
							if (!type) {
								type = Types.defaultType(name);
							}
							param.types.push(type);
						});
					});

					if (method.returns && method.returns.length) {
						method.returns.types = [];

						//special: '@return this' sets the return type to the class' type
						if (method.returns[0].description === 'this' && method.memberof) {
							method.returns.types.push(Types.getType(method.memberof));
							method.chainable = true;
						}
						else if (method.returns[0].type) {
							//flag methods returning a new instance of their class
							if (method.returns[0].type.names.length === 1 && Types.getType(method.returns[0].type.names[0]) === Types.getType(method.memberof)) {
								method.chainable = false;
							}

							method.returns[0].type.names.forEach(function(name, i) {
								var type = Types.getType(name, method.longName + ' return type #' + i);
								if (!type) {
									type = Types.defaultType(name);
								}
								method.returns.types.push(type);
							});
						}
					}
					else {
						method.returns = {types: [Types.getType(null)]};
					}

				}
				catch(e) {
					console.error('Error processing ' + record.longname);
					throw e;
				}
			});

	});


	//console.log(JSON.stringify(graph, false, 4));

	return {
		graph: graph,
		documented: documentedNames,
		undocumented: undocumentedNames
	};

};


module.exports = massageJsdoc;
