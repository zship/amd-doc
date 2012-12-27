'use strict';


var grunt = require('grunt/lib/grunt.js');
var jade = require('jade');
var constants = require('../constants.js');


var tpl;


var renderTaglist = function(graph, path, callback) {
	var jadeOpts = {filename: constants.jadedir + '/taglist.jade'};
	if (!tpl) {
		grunt.verbose.write('\t\t');
		tpl = grunt.file.read(jadeOpts.filename, 'utf-8');
	}
	var data = jade.compile(tpl, jadeOpts)({cl: graph, module: path});
	callback(graph, path, data);
};


module.exports = renderTaglist;
