'use strict';


var fs = require('fs');
var path = require('path');
var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var constants = require('./constants.js');
var Deferred = require('deferreds/Deferred');
var pipe = require('deferreds/pipe');
var loadConfig = require('amd-tools/util/loadConfig');
var forOwn = require('mout/object/forOwn');
var map = require('mout/object/map');
var isPlainObject = require('mout/lang/isPlainObject');
var isArray = require('mout/lang/isArray');

var util = require('./doc/util.js');
var Stopwatch = require('./doc/Stopwatch.js');

var Types = require('./doc/Types.js');
var runJsdoc = require('./doc/runJsdoc.js');
var massageJsdoc = require('./doc/massageJsdoc.js');
var mixinMarkdown = require('./doc/mixinMarkdown.js');
var transformLongNames = require('./doc/transformLongNames.js');
var parseMarkdown = require('./doc/parseMarkdown.js');
var mixinInherited = require('./doc/mixinInherited.js');
var renderModule = require('./doc/renderModule.js');
var renderTaglist = require('./doc/renderTaglist.js');
var renderMenu = require('./doc/renderMenu.js');
var printSummary = require('./doc/printSummary.js');
var traceDependencies = require('./doc/traceDependencies.js');
var withModuleInfo = require('./doc/withModuleInfo');
var withLinkedDependencies = require('./doc/withLinkedDependencies');
var withMarkdownDescriptions = require('./doc/withMarkdownDescriptions');
var withRenderedMarkdown = require('./doc/withRenderedMarkdown');
var withLinkedTypes = require('./doc/withLinkedTypes');
var groupModules = require('./doc/groupModules');


var amddoc = {};


amddoc.compile = function(opts) {

	var totalStopwatch = new Stopwatch().start();

	if (opts.verbose) {
		grunt.option('verbose', true);
	}

	constants.outdir = opts.out || 'doc/out';
	constants.cachedir = opts.cache || 'doc/cache';
	constants.mixindir = opts.mixin || 'doc/mixin';
	constants.outdir = path.resolve(process.cwd() + '/' + constants.outdir);
	constants.cachedir = path.resolve(process.cwd() + '/' + constants.cachedir);
	constants.mixindir = path.resolve(process.cwd() + '/' + constants.mixindir);
	constants.fileHashesPath = path.resolve(constants.cachedir + '/cache.json');

	//Types.populateTypeMap(opts.types || []);

	var files = grunt.file.expand({filter: 'isFile'}, opts.files);
	var stopwatch = new Stopwatch().start();

	grunt.log.subhead('Generating documentation for ' + files.length + ' files');
	grunt.log.writeln('===========================================================');


	var rjsconfig = loadConfig(opts.requirejs);
	util.rjsconfig = rjsconfig;


	var doclets = []; //jsdoc output
	//var graph = {}; //object graph to be passed to templates

	/*
	 *var documentedNames;
	 *var undocumentedNames;
	 *var markdownDocumentedNames;
	 */


	return pipe([

		function() {
			grunt.log.writeln('');
			grunt.log.writeln('Running jsdoc on ' + files.length + ' files...');

			var deferred = new Deferred();

			runJsdoc(files).then(function(result) {
				var out = result.out;
				//console.log(JSON.stringify(out, false, 4));
				doclets = doclets.concat(out);
				deferred.resolve({out: out});
			});

			return deferred.promise();
		},


		function() {
			var undefinedStringToUndefined = function(obj) {
				if (isPlainObject(obj)) {
					return map(obj, function(child) {
						if (child === 'undefined') {
							return false;
						}
						return undefinedStringToUndefined(child);
					});
				}
				if (isArray(obj)) {
					return obj.map(function(child) {
						return undefinedStringToUndefined(child);
					});
				}
				return obj;
			};

			doclets = doclets.map(function(record) {
				return undefinedStringToUndefined(record);
			});
		},


		function() {
			grunt.log.writeln('');
			grunt.log.writeln('Tracing AMD dependencies...');
			return traceDependencies(files, rjsconfig);
		},


		function() {
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();

			grunt.log.writeln('');
			grunt.log.writeln('Massaging jsdoc output...');

			//console.log(JSON.stringify(doclets, false, 4));

			var result = withModuleInfo(doclets, rjsconfig);
			//console.log(JSON.stringify(result, false, 4));
			/*
			 *graph = result.graph;
			 *documentedNames = result.documented;
			 *undocumentedNames = result.undocumented;
			 */

			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();

			result = withLinkedDependencies(result, opts.types, rjsconfig);
			//console.log(JSON.stringify(result, false, 4));



			grunt.log.writeln('');
			grunt.log.writeln('Mixing in markdown documentation...');
			result = withMarkdownDescriptions(result, opts.mixin, rjsconfig);
			//console.log(JSON.stringify(result, false, 4));
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			//console.log(JSON.stringify(graph, false, 4));

			/*
			 *var readme = path.join(process.cwd(), opts.mixin, 'README.md');
			 *if (fs.existsSync(readme)) {
			 *    grunt.log.writeln('');
			 *    grunt.log.writeln('Parsing and linking ' + readme + '...');
			 *    var readmeContent = grunt.file.read(readme).toString();
			 *    readmeContent = transformLongNames(readmeContent, 'README.md');
			 *    readmeContent = parseMarkdown(readmeContent);
			 *    var readmeSave = constants.outdir + '/README.html';
			 *    grunt.file.write(readmeSave, readmeContent, 'utf-8');
			 *    grunt.log.ok(stopwatch.elapsed() + 'ms');
			 *    stopwatch.reset();
			 *}
			 */


			var transformer = function(type, own) {
				if (opts.types) {
					type.link = opts.types(type.longName, own);
				}
				type.displayName = (function() {
					//console.log(type.longName);
					if (!own) {
						return type.longName;
					}
					//class/module name
					if (type.longName.trim().search(/[#~\.]/) === -1) {
						return type.name;
					}
					//member namepath
					var parts = type.longName.trim().match(/^(\S*?)([#~\.])(\S*?)$/);
					if (!parts) {
						return type.longName;
					}
					if (parts[3].search(/event:/) !== -1) {
						return parts[1].split('/').pop() + ':"' + parts[3].replace('event:', '') + '"';
					}
					return parts[1].split('/').pop() + parts[2] + parts[3];
				})();

				return type;
			};
			result = withLinkedTypes(result, transformer);
			//console.log(JSON.stringify(result, false, 4));
			//
			result = result.map(function(record) {
				if (!record.meta) {
					return;
				}
				record.meta.srcview = opts.srcview(util.getFile(record), record.meta.lineno);
				if (record.imported) {
					record.imported.srcview = opts.srcview(record.imported.path + record.imported.filename, record.imported.lineno);
				}
				return record;
			});

			result = withRenderedMarkdown(result);

			result = groupModules(result);

			//console.log(JSON.stringify(result, false, 4));

			/*
			 *grunt.log.writeln('');
			 *grunt.log.writeln('Transforming references to defined methods in descriptions into links...');
			 *util.getDescriptions(graph).forEach(function(obj) {
			 *    obj.description = transformLongNames(obj.description, obj.longName);
			 *});
			 *grunt.log.ok(stopwatch.elapsed() + 'ms');
			 *stopwatch.reset();
			 */


			/*
			 *grunt.log.writeln('');
			 *grunt.log.writeln('Parsing and rendering markdown in descriptions...');
			 *util.getDescriptions(graph).forEach(function(obj) {
			 *    obj.description = parseMarkdown(obj.description);
			 *});
			 *grunt.log.ok(stopwatch.elapsed() + 'ms');
			 *stopwatch.reset();
			 */


			grunt.log.writeln('');
			grunt.log.writeln('Mixing inherited methods into class definitions...');
			//mixinInherited(graph);
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Rendering module definition files into ' + constants.outdir + '/classes...');
			_.each(result, function(val, key) {
				if (!key) {
					return true; //continue
				}

				var jadeStopwatch = new Stopwatch().start();

				//var path = key.replace(/\./g, '/');
				grunt.verbose.write('\t');
				grunt.verbose.writeln('Rendering class definition file ' + key + '...');
				//console.log(path);
				//console.log(val);
				renderModule(val, key, opts, function(graph, path, data) {
					var filePath = constants.outdir + '/classes/' + path + '.html';
					grunt.verbose.write('\t\t');
					grunt.file.write(filePath, data, 'utf-8');
				});

				grunt.verbose.write('\t');
				grunt.verbose.ok(jadeStopwatch.elapsed() + 'ms');
			});
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Rendering taglist files into ' + constants.outdir + '/taglists...');
			_.each(result, function(val, key) {
				if (!key) {
					return true; //continue
				}

				var jadeStopwatch = new Stopwatch().start();

				//var path = key.replace(/\./g, '/');
				grunt.verbose.write('\t');
				grunt.verbose.writeln('Rendering taglist file ' + key + '...');
				//console.log(path);
				//console.log(val);
				renderTaglist(val, key, function(graph, path, data) {
					var filePath = constants.outdir + '/taglists/' + path + '.html';
					grunt.verbose.write('\t\t');
					grunt.file.write(filePath, data, 'utf-8');
				});
				grunt.verbose.write('\t');
				grunt.verbose.ok(jadeStopwatch.elapsed() + 'ms');
			});
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Rendering module list into ' + constants.outdir + '/menu.html...');

			var classList = _.clone(Object.keys(result));
			var classStructure = {};
			_.each(classList, function(className) {
				var path = className.replace(/\//g,'.');
				util.setObject(path, className, classStructure);
			});

			var menu = renderMenu(classStructure, '');
			grunt.verbose.write('\t');
			grunt.file.write(constants.outdir + '/menu.html', menu, 'utf-8');

			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			//printSummary(graph, documentedNames, undocumentedNames, markdownDocumentedNames);

		}

	]).then(function() {
		grunt.log.writeln('');
		grunt.log.writeln('Total Time: ' + totalStopwatch.elapsed() + 'ms');
	}, function(err) {
		if (err.stack) {
			process.stderr.write(err.stack);
		}
		else {
			process.stderr.write(err.toString());
		}
		process.stderr.write('\n\n');
		process.exit(1);
	});

};


module.exports = amddoc;
