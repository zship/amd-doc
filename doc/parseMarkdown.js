'use strict';


var md = require('marked');
var hljs = require('highlight.js');


md.setOptions({
	gfm: true,
	pedantic: false,
	sanitize: false,
	highlight: function(code, lang) {
		if (lang === 'js' || !lang) {
			lang = 'javascript';
		}
		return hljs.highlight(lang, code).value;
	}
});


var parseMarkdown = function(str) {
	return md.parse(str);
};


module.exports = parseMarkdown;
