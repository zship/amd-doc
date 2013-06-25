'use strict';


var compact = require('mout/array/compact');
var forOwn = require('mout/object/forOwn');
var values = require('mout/object/values');
var deepClone = require('mout/lang/deepClone');


var withResolvedAugments = function(doclets) {
	var classList = doclets.filter(function(record) {
		return record.kind === 'class';
	});

	var longNames = {};
	var shortToLong = {};
	classList.forEach(function(record) {
		longNames[record.longname] = true;
		shortToLong[record.name] = record.longname;
	});

	classList.forEach(function(record) {
		if (!record.augments) {
			return;
		}
		record.augments = record.augments.map(function(superclassName) {
			if (longNames[superclassName]) {
				return superclassName;
			}
			if (shortToLong[superclassName]) {
				return shortToLong[superclassName];
			}
			return superclassName;
			//throw new Error(superclassName + ' declared as a superclass of ' + record.longname + ', but does not exist.');
		});
	});

	return doclets;
};


var _merge = function(seqs) {
	var result = [];

	while (true) {

		var nonemptyseqs = seqs.filter(function(seq) {
			return seq && seq.length;
		});

		if (!nonemptyseqs.length) {
			return result;
		}

		var candidate;

		//find merge candidates among seq heads
		nonemptyseqs.every(function(seq) {
			candidate = seq[0];

			//if the candidate is in the tail of any other seqs
			var notHead = nonemptyseqs.filter(function(seq) {
				var tail = seq.slice(1);
				return tail.indexOf(candidate) !== -1;
			}).length > 0;

			//reject candidate
			if (notHead) {
				candidate = null;
				return true; //continue
			}

			return false; //break
		});

		if (!candidate) {
			throw new Error('Inconsistent heirarchy');
		}

		result.push(candidate);

		//remove candidate
		seqs = nonemptyseqs.map(function(seq) {
			if (seq[0] === candidate) {
				return seq.slice(1);
			}
			return seq;
		});

	}
};


//C3 Method Resolution Order (see http://www.python.org/download/releases/2.3/mro/)
var _c3mro = function(constructor){
	var bases = constructor._meta.bases.slice(0);

	var seqs =
		[[constructor]]
		.concat(bases.map(function(base) {
			return _c3mro(base);
		}))
		.concat([bases.slice(0)]);

	//the linearization of C is the sum of C plus the merge of the
	//linearizations of the parents and the list of the parents.
	return _merge(seqs);
};


var withLinearizedHeirarchy = function(doclets) {
	//a simplied class graph containing only inheritance info
	var graph = {};

	//start by just defining placeholders for each class
	doclets.forEach(function(record) {
		if (record.kind !== 'class') {
			return;
		}

		graph[record.longname] = {
			name: record.longname,
			augments: record.augments || [],
			_meta: {
				bases: []
			}
		};
	});

	//add inheritance info
	forOwn(graph, function(clazz) {
		if (clazz.augments) {
			clazz._meta.bases = compact(
				clazz.augments.map(function(superclassName) {
					if (graph[superclassName]) {
						return graph[superclassName];
					}
				})
			);
		}
	});

	var _depth = function(base, depth) {
		depth = depth || 0;
		depth++;

		if (!base) {
			return;
		}

		var maxDepth = 0;
		base._meta.bases.forEach(function(child) {
			maxDepth = Math.max(maxDepth, _depth(child, depth));
		});
		return maxDepth;
	};

	//console.log(JSON.stringify(graph, false, 4));

	//sort by number of superclasses
	var sorted = values(graph).sort(function(a, b) {
		return _depth(a) - _depth(b);
	}).map(function(obj) {
		return obj.name;
	});

	//console.log(JSON.stringify(graph, false, 4));

	//expand bases out to full hierarchy/linearize
	sorted.forEach(function(className) {
		if (graph[className]._meta.bases.length) {
			graph[className]._meta.bases = _c3mro(graph[className]);
			//first entry is the class itself. remove.
			graph[className]._meta.bases.shift();
		}
	});

	//console.log(JSON.stringify(graph, false, 4));

	forOwn(graph, function(obj, className) {
		var doclet = doclets.filter(function(record) {
			return record.longname === className && record.kind === 'class';
		})[0];
		doclet.heirarchy = [];
		obj._meta.bases.forEach(function(base) {
			doclet.heirarchy.push(base.name);
		});
	});

	return doclets;
};


var withMultipleInheritance = function(doclets) {
	doclets = withResolvedAugments(doclets);

	//convert "augments" doclets into linearized inheritance heirarchy
	doclets = withLinearizedHeirarchy(doclets);

	//remove any existing inherited doclets
	doclets = doclets.filter(function(record) {
		return !record.inherited;
	});

	var inheritedDoclets = [];

	//sort classes by number of superclasses, and override subclasses' methods
	//in-order
	doclets.filter(function(record) {
		return record.kind === 'class';
	}).sort(function(a, b) {
		return a.heirarchy.length - b.heirarchy.length;
	}).forEach(function(clazz) {
		var className = clazz.longname;

		//order from highest ancestor -> self
		var bases = clazz.heirarchy.reverse();

		var ownProps = {};
		doclets.forEach(function(record) {
			if (record.memberof === className) {
				ownProps[record.name] = record;
			}
		});

		bases.forEach(function(superclassName) {
			doclets.filter(function(record) {
				return record.memberof === superclassName;
			}).forEach(function(record) {

				//inherited (not defined on clazz)
				if (!ownProps[record.name]) {
					if (record.access && record.access === 'private') {
						return;
					}

					var inherited = deepClone(record);
					inherited.memberof = className;
					inherited.longname = inherited.longname.replace(superclassName, className);
					inherited.inherits = record.longname;
					inherited.inherited = true;
					inheritedDoclets.push(inherited);
				}
				//overridden
				else {
					ownProps[record.name].overrides = record.longname;
					ownProps[record.name].overridden = true;
				}

			});
		});

	});

	return doclets.concat(inheritedDoclets);

};


module.exports = withMultipleInheritance;
