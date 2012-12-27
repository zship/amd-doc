'use strict';


var grunt = require('grunt/lib/grunt.js');
var jade = require('jade');
var constants = require('../constants.js');


var tpl;


var renderModule = function(graph, path, config, callback) {
	var jadeOpts = {filename: constants.jadedir + '/class.jade'};
	if (!tpl) {
		grunt.verbose.write('\t\t');
		tpl = grunt.file.read(jadeOpts.filename, 'utf-8');
	}
	try {
		var data = jade.compile(tpl, jadeOpts)({cl: graph, module: path, config: config});
		callback(graph, path, data);
	}
	catch(e) {
		grunt.log.writeln('');
		grunt.log.error('Failed rendering ' + path);
		console.error(e.message);
		console.error(e.stack);
		//console.log(JSON.stringify(graph, false, 4));
		grunt.log.writeln('');
	}
};


module.exports = renderModule;
