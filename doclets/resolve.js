'use strict';


var forOwn = require('mout/object/forOwn');


//specialized longest common substring for jsdoc namepaths:
//rightmost (most-specific) part *must* match
var _longestCommonSubstring = function(first, second) {
	var max = 0;

	for (var i = 0; i < Math.min(first.length, second.length); i++) {
		if (first[first.length - i - 1] !== second[second.length - i - 1]) {
			break;
		}
		max++;
	}

	if (max) {
		return first.slice(-1 * max);
	}
	return [];
};


var resolve = function(doclets, namepath) {
	/*
	 *if (namepath.search(/deferreds\/Promise/) !== -1) {
	 *    console.log(namepath);
	 *}
	 */

	var longNames = {};

	var exactMatch;
	doclets.every(function(record) {
		longNames[record.longname] = record;
		if (record.longname === namepath) {
			exactMatch = record;
			return false;
		}
		return true;
	});

	if (exactMatch) {
		return exactMatch;
	}

	var matches = [];
	var max = 0;
	forOwn(longNames, function(record, longname) {
		//since we have an idea of namepath formatting, do lcs against groups
		//of characters rather than per-character (performance)
		var lcs = _longestCommonSubstring(longname.split(/[:\/~#\.]/), namepath.split(/[:\/~#\.]/));
		if (lcs.length) {
			max = Math.max(max, lcs.length);
			matches.push({
				record: record,
				lcs: lcs
			});
		}
	});

	matches = matches.sort(function(a, b) {
		return b.lcs.length - a.lcs.length;
	}).filter(function(result) {
		return result.lcs.length === max;
	});

	if (matches.length === 1) {
		return matches[0].record;
	}
};


module.exports = resolve;
