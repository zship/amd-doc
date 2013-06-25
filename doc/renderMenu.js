'use strict';


var _ = require('underscore');


var renderMenu = function(obj) {
	if (_.isString(obj)) {
		return '';
	}

	//console.log(obj);
	var html = '<ul>';
	Object.keys(obj).sort().every(function(key) {
		var child = obj[key];

		if (_.isString(_.values(obj)[0])) {
			html += '<li>';
			html += '<a href="#/module:' + child + '">' + key + '</a>';
			return true;
		}
		else {
			html += '<li><span class="section-header">' + key + '</span>';
		}

		html += renderMenu(child);
		html += '</li>';

		return true;
	});
	html += '</ul>';
	return html;
};


module.exports = renderMenu;
