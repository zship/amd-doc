'use strict';


var path = require('path');


var constants = {
	outdir: '',
	cachedir: '',
	mixindir: '',
	rjs: path.resolve(__dirname + '/lib/r.js'),
	fileHashesPath: '',
	jsdocExe: path.normalize(__dirname + '/node_modules/jsdoc/jsdoc'),
	jadedir: path.resolve(__dirname + '/tpl')
};


module.exports = constants;
