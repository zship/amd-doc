'use strict';


var fs = require('fs');
var path = require('path');
var grunt = require('grunt/lib/grunt.js');
var _ = require('underscore');
var constants = require('./constants.js');
var requirejs = require(constants.rjs);
var Deferred = require('./lib/deferreds.js').Deferred;
var Deferreds = require('./lib/deferreds.js').Deferreds;

var util = require('./doc/util.js');
var Stopwatch = require('./doc/Stopwatch.js');

var Types = require('./doc/Types.js');
var runJsdoc = require('./doc/runJsdoc.js');
var cacheJsdoc = require('./doc/cacheJsdoc.js');
var getJsdocCache = require('./doc/getJsdocCache.js');
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


var amddoc = {};


//idea: put a search box above class list that filters the class list
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

	['include', 'exclude'].forEach(function(name) {
		opts[name] = util.expand(opts[name]);
	});

	opts.include = _.difference(opts.include, opts.exclude);

	Types.populateTypeMap(opts.types || []);

	var files = opts.include;
	var stopwatch = new Stopwatch().start();

	grunt.log.subhead('Generating documentation for ' + files.length + ' files');
	grunt.log.writeln('===========================================================');


	var rjsconfig = opts.requirejs;

	requirejs.config({
		baseUrl: process.cwd() + '/src',
		packages: rjsconfig.packages,
		nodeRequire: require
	});

	util.rjsconfig = rjsconfig;


	var doclets = []; //jsdoc output
	var cache = {}; //cache info for previous doclets
	var graph = {}; //object graph to be passed to templates

	var documentedNames;
	var undocumentedNames;
	var markdownDocumentedNames;


	return Deferreds.waterfall([

		function() {
			cache = getJsdocCache(files);

			doclets = [];
			cache.fresh.forEach(function(filePath) {
				grunt.verbose.write('\t');
				doclets = doclets.concat(JSON.parse(grunt.file.read(filePath)));
			});

			return [cache, doclets];
		},


		function() {
			grunt.log.writeln('');
			grunt.log.writeln('Running jsdoc on ' + cache.stale.length + ' files (' + cache.fresh.length + ' cached)...');

			var deferred = new Deferred();

			if (!cache.stale.length) {
				deferred.resolve();
				return deferred.promise();
			}

			grunt.verbose.writeln(cache.stale.join(' '));

			runJsdoc(cache.stale).then(function(result) {
				var out = result.out;
				//console.log(JSON.stringify(out, false, 4));
				doclets = doclets.concat(out);
				deferred.resolve({out: out});
			});

			return deferred.promise();
		},


		function(result) {
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();

			grunt.log.writeln('');
			grunt.log.writeln('Updating jsdoc caches for future runs...');

			cache.stale.forEach(function(filePath) {
				cache.index[filePath] = util.hashFile(filePath);
			});

			grunt.verbose.write('\t');
			grunt.file.write(constants.fileHashesPath, JSON.stringify(cache.index, false, 2), 'utf-8');

			if (result && result.out) {
				cacheJsdoc(result.out);
			}

			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();
		},


		function() {
			grunt.log.writeln('');
			grunt.log.writeln('Tracing AMD dependencies...');

			var deferred = new Deferred();
			traceDependencies(files).then(function(deps) {
				deferred.resolve(deps);
			});
			return deferred.promise();
		},


		function(deps) {
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();

			grunt.log.writeln('');
			grunt.log.writeln('Massaging jsdoc output...');

			//console.log(JSON.stringify(graph, false, 4));

			var result = massageJsdoc(doclets, deps);
			graph = result.graph;
			documentedNames = result.documented;
			undocumentedNames = result.undocumented;

			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();

			//console.log(JSON.stringify(graph, false, 4));


			grunt.log.writeln('');
			grunt.log.writeln('Mixing in markdown documentation...');
			markdownDocumentedNames = mixinMarkdown(graph);
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			//console.log(JSON.stringify(graph, false, 4));

			var readme = path.join(process.cwd(), opts.mixin, 'README.md');
			if (fs.existsSync(readme)) {
				grunt.log.writeln('');
				grunt.log.writeln('Parsing and linking ' + readme + '...');
				var readmeContent = grunt.file.read(readme).toString();
				readmeContent = transformLongNames(readmeContent, 'README.md');
				readmeContent = parseMarkdown(readmeContent);
				var readmeSave = constants.outdir + '/README.html';
				grunt.file.write(readmeSave, readmeContent, 'utf-8');
				grunt.log.ok(stopwatch.elapsed() + 'ms');
				stopwatch.reset();
			}


			grunt.log.writeln('');
			grunt.log.writeln('Transforming references to defined methods in descriptions into links...');
			util.getDescriptions(graph).forEach(function(obj) {
				obj.description = transformLongNames(obj.description, obj.longName);
			});
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Parsing and rendering markdown in descriptions...');
			util.getDescriptions(graph).forEach(function(obj) {
				obj.description = parseMarkdown(obj.description);
			});
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Mixing inherited methods into class definitions...');
			mixinInherited(graph);
			grunt.log.ok(stopwatch.elapsed() + 'ms');
			stopwatch.reset();


			grunt.log.writeln('');
			grunt.log.writeln('Rendering module definition files into ' + constants.outdir + '/classes...');
			_.each(graph, function(val, key) {
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
			_.each(graph, function(val, key) {
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

			var classList = _.clone(Object.keys(graph));
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


			printSummary(graph, documentedNames, undocumentedNames, markdownDocumentedNames);

		}

	]).then(function() {
		grunt.log.writeln('');
		grunt.log.writeln('Total Time: ' + totalStopwatch.elapsed() + 'ms');
	}).fail(function(err) {
		console.log('failed');
		console.error(err);
	});

};


module.exports = amddoc;
