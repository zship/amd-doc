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


var _renderMarkdown = function(str) {
	return md.parse(str);
};


var withRenderedMarkdown = function(doclets) {
	return doclets.map(function(record) {
		if (record.description) {
			record.description = _renderMarkdown(record.description);
		}
		return record;
	});
};


module.exports = withRenderedMarkdown;
