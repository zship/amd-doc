'use strict';


var _ = require('underscore');
var Types = require('./Types.js');


var renderMenu = function(obj) {
	if (_.isString(obj)) {
		return '';
	}

	//console.log(obj);
	var html = '<ul>';
	_.every(Object.keys(obj).sort(), function(key) {
		var child = obj[key];

		if (_.isString(_.values(obj)[0])) {
			var type = Types.getType(child, 'rendering menu') || Types.defaultType(child);
			html += '<li>';
			html += '<a href="' + type.link + '">' + key + '</a>';
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
