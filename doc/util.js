'use strict';


var crypto = require('crypto');
var path = require('path');
var grunt = require('grunt/lib/grunt.js');
var amd = require('grunt-lib-amd');
var _ = require('underscore');


var util = {

	rjsconfig: null,

	getProp: function(/*Array*/parts, /*Boolean*/create, /*Object*/context){
		var p, i = 0, dojoGlobal = this;
		if(!context){
			if(!parts.length){
				return dojoGlobal;
			}else{
				p = parts[i++];
				context = context || (p in dojoGlobal ? dojoGlobal[p] : (create ? dojoGlobal[p] = {} : undefined));
			}
		}
		while(context && (p = parts[i++])){
			context = (p in context ? context[p] : (create ? context[p] = {} : undefined));
		}
		return context; // mixed
	},


	setObject: function(name, value, context){
		var parts = name.split("."), p = parts.pop(), obj = util.getProp(parts, true, context);
		return obj && p ? (obj[p] = value) : undefined; // Object
	},


	getObject: function(name, create, context){
		return util.getProp(name.split("."), create, context); // Object
	},


	moduleFullName: function(declaredName, filePath) {
		var srcDirectory = path.resolve(process.cwd() + '/' + util.rjsconfig.baseUrl);
		var moduleDirectory = path.resolve(process.cwd() + '/' + _.initial(filePath.split('/')).join('/'));

		declaredName = declaredName.replace(/\.js/, '');
		var absolutePath;

		//directory-relative path
		if (declaredName.search(/^\.\.\//g) !== -1 || declaredName.search(/^\.\//) !== -1) {
			absolutePath = path.resolve(moduleDirectory + '/' + declaredName + '.js');
			return absolutePath.replace(srcDirectory + '/', '').replace('.js', '');
		}

		absolutePath = path.resolve(srcDirectory + '/' + declaredName + '.js');
		return absolutePath.replace(srcDirectory + '/', '').replace('.js', '');
	},


	fileToModuleName: function(filePath) {
		return amd.fileToModuleName(filePath, util.rjsconfig);
	},


	hashFile: function(file) {
		return crypto.createHash('md5').update(grunt.file.read(file)).digest('hex');
	},


	//returns an Array of Objects inside `obj` which contain a 'description' key
	getDescriptions: function(obj) {
		var ret = [];

		if (!_.isObject(obj)) {
			return ret;
		}

		_.each(obj, function(child, key) {
			if (key === 'description') {
				ret.push(obj);
			}
			ret = ret.concat(util.getDescriptions(child));
		});

		return ret;
	}

};


module.exports = util;
