module.exports = (function() {
	
/**
 * almond 0.2.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (defined.hasOwnProperty(depName) ||
                           waiting.hasOwnProperty(depName) ||
                           defining.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

define("../../tasks/dist/lib/almond", function(){});

define('isDeferred',[],function() {

	var isDeferred = function(obj) {
		return obj && obj.promise;
	};

	return isDeferred;

});

define('forceNew',[],function() {

	var forceNew = function(ctor, args, displayName) {
		//create object with correct prototype using a do-nothing constructor
		var xtor;
		//override constructor name given in common debuggers
		if (displayName) {
			xtor = eval('1&&function ' + displayName + '(){}');
		}
		else {
			xtor = function() {};
		}
		xtor.prototype = ctor.prototype;

		var instance = new xtor();
		xtor.prototype = null;

		ctor.apply(instance, args);
		return instance;
	};


	return forceNew;

});

define('amd-utils/lang/kindOf',[],function () {

    var _rKind = /^\[object (.*)\]$/,
        _toString = Object.prototype.toString,
        UNDEF;

    /**
     * Gets the "kind" of value. (e.g. "String", "Number", etc)
     * @version 0.1.0 (2011/10/31)
     */
    function kindOf(val) {
        if (val === null) {
            return 'Null';
        } else if (val === UNDEF) {
            return 'Undefined';
        } else {
            return _rKind.exec( _toString.call(val) )[1];
        }
    }
    return kindOf;
});

define('amd-utils/lang/isKind',['./kindOf'], function (kindOf) {
    /**
     * Check if value is from a specific "kind".
     * @version 0.1.0 (2011/10/31)
     */
    function isKind(val, kind){
        return kindOf(val) === kind;
    }
    return isKind;
});

define('amd-utils/lang/isArray',['./isKind'], function (isKind) {
    /**
     * @version 0.2.0 (2011/12/06)
     */
    var isArray = Array.isArray || function (val) {
        return isKind(val, 'Array');
    };
    return isArray;
});

define('Promise',[],function() {

	/**
	 * @class
	 * @param {Deferred} deferred
	 */
	var Promise = function(deferred) {
		this._deferred = deferred;
	};


	Promise.prototype = {

		/**
		 * @return {Deferred.State}
		 */
		state: function() {
			return this._deferred._state;
		},

		/**
		 * @param {Function} doneCallback
		 * @param {Function} [failCallback]
		 * @param {Function} [progressCallback]
		 * @return this
		 */
		then: function() {
			this._deferred.then.apply(this._deferred, arguments);
			return this;
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		done: function() {
			this._deferred.done.apply(this._deferred, arguments);
			return this;
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		fail: function() {
			this._deferred.fail.apply(this._deferred, arguments);
			return this;
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		always: function() {
			this._deferred.always.apply(this._deferred, arguments);
			return this;
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		progress: function() {
			this._deferred.progress.apply(this._deferred, arguments);
			return this;
		}

	};


	return Promise;

});

define('Deferred',['require','./forceNew','amd-utils/lang/isArray','./Promise'],function(require) {

	var forceNew = require('./forceNew');
	var isArray = require('amd-utils/lang/isArray');
	var Promise = require('./Promise');


	//apply each callback in `callbacks` with `args`
	var _execute = function(callbacks, args) {
		if (!callbacks) {
			return;
		}

		if (!isArray(callbacks)) {
			callbacks = [callbacks];
		}

		for (var i = 0; i < callbacks.length; i++) {
			callbacks[i].apply(null, args);
		}
	};


	/**
	 * @class
	 */
	var Deferred = function() {
		if (!(this instanceof Deferred)) {
			return forceNew(Deferred, arguments, 'Deferred');
		}

		this._state = Deferred.State.PENDING;
		this._callbacks = {
			done: [],
			fail: [],
			progress: []
		};
		this._closingArguments = [];
		this._promise = new Promise(this);
	};


	Deferred.prototype = {

		/**
		 * @return {Promise}
		 */
		promise: function() {
			return this._promise;
		},


		/**
		 * @return {Deferred.State}
		 */
		state: function() {
			return this._state;
		},


		/**
		 * @param {...*} args
		 * @return this
		 */
		resolve: function() {
			if (this._state !== Deferred.State.PENDING) { //already resolved/rejected
				return this;
			}

			this._state = Deferred.State.RESOLVED;
			_execute(this._callbacks.done, arguments);
			this._closingArguments = arguments;
			return this;
		},


		/**
		 * @param {...*} args
		 * @return this
		 */
		reject: function() {
			if (this._state !== Deferred.State.PENDING) { //already resolved/rejected
				return this;
			}

			this._state = Deferred.State.REJECTED;
			_execute(this._callbacks.fail, arguments);
			this._closingArguments = arguments;
			return this;
		},


		/**
		 * @return this
		 */
		notify: function() {
			if (this._state !== Deferred.State.PENDING) { //already resolved/rejected
				return this;
			}

			_execute(this._callbacks.progress, arguments);
			return this;
		},


		/**
		 * @param {Function} doneCallback
		 * @param {Function} [failCallback]
		 * @param {Function} [progressCallback]
		 * @return this
		 */
		then: function(doneCallback, failCallback, progressCallback) {
			if (this._state === Deferred.State.RESOLVED) {
				_execute(doneCallback, this._closingArguments);
				return this;
			}

			if (this._state === Deferred.State.REJECTED) {
				_execute(failCallback, this._closingArguments);
				return this;
			}

			if (doneCallback) {
				this._callbacks.done.push(doneCallback);
			}

			if (failCallback) {
				this._callbacks.fail.push(failCallback);
			}

			if (progressCallback) {
				this._callbacks.progress.push(progressCallback);
			}

			return this;
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		done: function(callback) {
			return this.then(callback);
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		fail: function(callback) {
			return this.then(undefined, callback);
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		always: function(callback) {
			return this.then(callback, callback);
		},


		/**
		 * @param {Function} callback
		 * @return this
		 */
		progress: function(callback) {
			return this.then(undefined, undefined, callback);
		}

	};


	/**
	 * @enum {String}
	 * @const
	 */
	Deferred.State = {
		PENDING: "pending",
		RESOLVED: "resolved",
		REJECTED: "rejected"
	};


	return Deferred;

});

define('amd-utils/lang/isObject',['./isKind'], function (isKind) {
    /**
     * @version 0.1.0 (2011/10/31)
     */
    function isObject(val) {
        return isKind(val, 'Object');
    }
    return isObject;
});

define('amd-utils/object/hasOwn',[],function () {

    /**
     * Safer Object.hasOwnProperty
     * @version 0.1.0 (2012/01/19)
     */
     function hasOwn(obj, prop){
         return Object.prototype.hasOwnProperty.call(obj, prop);
     }

     return hasOwn;

});

define('amd-utils/object/forIn',[],function () {

    var _hasDontEnumBug,
        _dontEnums;

    function checkDontEnum(){
        _dontEnums = [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ];

        _hasDontEnumBug = true;

        for (var key in {'toString': null}) {
            _hasDontEnumBug = false;
        }
    }

    /**
     * Similar to Array/forEach but works over object properties and fixes Don't
     * Enum bug on IE.
     * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
     * @version 0.2.0 (2012/10/30)
     */
    function forIn(obj, fn, thisObj){
        var key, i = 0;
        // no need to check if argument is a real object that way we can use
        // it for arrays, functions, date, etc.

        //post-pone check till needed
        if (_hasDontEnumBug == null) checkDontEnum();

        for (key in obj) {
            if (exec(fn, obj, key, thisObj) === false) {
                break;
            }
        }

        if (_hasDontEnumBug) {
            while (key = _dontEnums[i++]) {
                // since we aren't using hasOwn check we need to make sure the
                // property was overwritten
                if (obj[key] !== Object.prototype[key]) {
                    if (exec(fn, obj, key, thisObj) === false) {
                        break;
                    }
                }
            }
        }
    }

    function exec(fn, obj, key, thisObj){
        return fn.call(thisObj, obj[key], key, obj);
    }

    return forIn;

});

define('amd-utils/object/forOwn',['./hasOwn', './forIn'], function (hasOwn, forIn) {

    /**
     * Similar to Array/forEach but works over object properties and fixes Don't
     * Enum bug on IE.
     * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
     * @version 0.4.0 (2012/10/30)
     */
    function forOwn(obj, fn, thisObj){
        forIn(obj, function(val, key){
            if (hasOwn(obj, key)) {
                return fn.call(thisObj, obj[key], key, obj);
            }
        });
    }

    return forOwn;

});

define('amd-utils/object/values',['./forOwn'], function (forOwn) {

    /**
     * Get object values
     * @version 0.2.0 (2011/12/17)
     */
    function values(obj) {
        var vals = [];
        forOwn(obj, function(val, key){
            vals.push(val);
        });
        return vals;
    }

    return values;

});

define('amd-utils/array/forEach',[],function () {

    /**
     * Array forEach
     * @version 0.7.0 (2012/10/30)
     */
    function forEach(arr, callback, thisObj) {
        if (arr == null) {
            return;
        }
        var i = -1,
            n = arr.length >>> 0;
        while (++i < n) {
            // we iterate over sparse items since there is no way to make it
            // work properly on IE 7-8. see #64
            if ( callback.call(thisObj, arr[i], i, arr) === false ) {
                break;
            }
        }
    }

    return forEach;

});

define('amd-utils/array/map',['./forEach'], function (forEach) {

    /**
     * Array map
     * @version 0.5.0 (2012/11/19)
     */
    function map(arr, callback, thisObj) {
        var results = [];
        if (arr == null){
            return results;
        }
        forEach(arr, function (val, i, arr) {
            results[i] = callback.call(thisObj, val, i, arr);
        });
        return results;
    }

     return map;
});

define('amd-utils/collection/map',['../lang/isObject', '../object/values', '../array/map'], function (isObject, values, arrMap) {

    /**
     * Map collection values, returns Array.
     * @version 0.2.0 (2012/11/19)
     */
    function map(list, callback, thisObj) {
        // list.length to check array-like object, if not array-like
        // we simply map all the object values
        if( isObject(list) && list.length == null ){
            list = values(list);
        }
        return arrMap(list, function (val, key, list) {
            return callback.call(thisObj, val, key, list);
        });
    }

    return map;

});

define('amd-utils/collection/make_',[],function(){

    /**
     * internal method used to create other collection modules.
     * @version 0.2.0 (2012/10/30)
     */
    function makeCollectionMethod(arrMethod, objMethod, defaultReturn) {
        return function(){
            var args = Array.prototype.slice.call(arguments);
            if (args[0] == null) {
                return defaultReturn;
            }
            // array-like is treated as array
            return (typeof args[0].length === 'number')? arrMethod.apply(null, args) : objMethod.apply(null, args);
        };
    }

    return makeCollectionMethod;

});

define('amd-utils/collection/forEach',['./make_', '../array/forEach', '../object/forOwn'], function (make, arrForEach, objForEach) {

    /**
     * @version 0.1.1 (2012/10/30)
     */
    return make(arrForEach, objForEach);

});

define('amd-utils/object/size',['./forOwn'], function (forOwn) {

    /**
     * Get object size
     * @version 0.1.1 (2012/01/28)
     */
    function size(obj) {
        var count = 0;
        forOwn(obj, function(){
            count++;
        });
        return count;
    }

    return size;

});

define('amd-utils/collection/size',['../lang/isArray', '../object/size'], function (isArray, objSize) {

    /**
     * Get collection size
     * @version 0.2.0 (2012/11/16)
     */
    function size(list) {
        if (!list) {
            return 0;
        }
        if (isArray(list)) {
            return list.length;
        }
        return objSize(list);
    }

    return size;

});

define('amd-utils/lang/isFunction',['./isKind'], function (isKind) {
    /**
     * @version 0.1.0 (2011/10/31)
     */
    function isFunction(val) {
        return isKind(val, 'Function');
    }
    return isFunction;
});

define('isPromise',[],function() {

	var isPromise = function(obj) {
		return obj && typeof obj.then === 'function';
	};


	return isPromise;

});

define('anyToDeferred',['require','./Deferred','amd-utils/lang/isFunction','./isDeferred','./isPromise'],function(require) {

	var Deferred = require('./Deferred');
	var isFunction = require('amd-utils/lang/isFunction');
	var isDeferred = require('./isDeferred');
	var isPromise = require('./isPromise');


	var anyToDeferred = function(obj) {
		//any arguments after obj will be passed to obj(), if obj is a function
		var args = Array.prototype.slice.call(arguments, 1);
		if (isDeferred(obj) || isPromise(obj)) {
			return obj;
		}
		else if (isFunction(obj)) {
			var result = obj.apply(obj, args);
			if (isDeferred(obj) || isPromise(result)) {
				return result;
			}
			return Deferred().resolve(result).promise();
		}
		else {
			return Deferred().resolve(obj).promise();
		}
	};


	return anyToDeferred;

});

define('forEach',['require','./Deferred','amd-utils/collection/forEach','amd-utils/collection/size','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var each = require('amd-utils/collection/forEach');
	var size = require('amd-utils/collection/size');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Invoke `iterator` once for each function in `list`
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var forEach = function(list, iterator) {

		var superDeferred = new Deferred();

		if (!size(list)) {
			superDeferred.resolve();
			return superDeferred.promise();
		}

		var completed = 0;
		each(list, function(item, key) {
			anyToDeferred(iterator(item, key, list))
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function() {
					completed++;
					if (completed === size(list)) {
						superDeferred.resolve();
					}
				});
		});

		return superDeferred.promise();

	};


	return forEach;

});

define('map',['require','./Deferred','amd-utils/collection/map','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var cmap = require('amd-utils/collection/map');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	var map = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = cmap(list, function (val, i) {
			return {index: i, value: val};
		});

		forEach(list, function(item) {
			return anyToDeferred(iterator(item.value, item.index, list))
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function(transformed) {
					results[item.index] = transformed;
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return map;

});

define('find',['require','./Deferred','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Returns the first value in `list` matching the `iterator` truth test
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var find = function(list, iterator) {

		var superDeferred = new Deferred();

		forEach(list, function(item, i) {
			return anyToDeferred(iterator(item, i, list))
				.done(function(result) {
					if (result) {
						superDeferred.resolve(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(undefined);
		});

		return superDeferred.promise();

	};


	return find;

});

define('amd-utils/object/keys',['./forOwn'], function (forOwn) {

    /**
     * Get object keys
     * @version 0.3.0 (2011/12/17)
     */
     var keys = Object.keys || function (obj) {
            var keys = [];
            forOwn(obj, function(val, key){
                keys.push(key);
            });
            return keys;
        };

    return keys;

});

define('forEachSeries',['require','./Deferred','amd-utils/lang/isArray','amd-utils/collection/size','amd-utils/object/keys','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var isArray = require('amd-utils/lang/isArray');
	var size = require('amd-utils/collection/size');
	var objectKeys = require('amd-utils/object/keys');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Version of forEach which is guaranteed to execute passed functions in
	 * order.
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var forEachSeries = function(list, iterator) {

		var superDeferred = new Deferred();

		if (!size(list)) {
			superDeferred.resolve();
			return superDeferred.promise();
		}

		var completed = 0;
		var keys;
		if (!isArray(list)) {
			keys = objectKeys(list);
		}

		var iterate = function() {
			var item;
			var key;

			if (isArray(list)) {
				key = completed;
				item = list[key];
			}
			else {
				key = keys[completed];
				item = list[key];
			}

			anyToDeferred(iterator(item, key))
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function() {
					completed += 1;
					if (completed === size(list)) {
						superDeferred.resolve();
					}
					else {
						iterate();
					}
				});
		};
		iterate();

		return superDeferred.promise();

	};


	return forEachSeries;

});

define('reduce',['require','./Deferred','./forEachSeries','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var forEachSeries = require('./forEachSeries');
	var anyToDeferred = require('./anyToDeferred');


	var reduce = function(list, iterator, memo) {

		var superDeferred = new Deferred();

		forEachSeries(list, function(item, key) {
			return anyToDeferred(iterator(memo, item, key, list))
				.done(function(result) {
					memo = result;
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(memo);
		});

		return superDeferred.promise();

	};


	return reduce;

});

define('amd-utils/collection/pluck',['./map'], function (map) {

    /**
     * Extract a list of property values.
     * @version 0.1.0 (2012/11/13)
     */
    function pluck(list, key) {
        return map(list, function(value) {
            return value[key];
        });
    }

    return pluck;

});

define('reduceRight',['require','./reduce','amd-utils/collection/map','amd-utils/collection/pluck'],function(require) {

	var reduce = require('./reduce');
	var map = require('amd-utils/collection/map');
	var pluck = require('amd-utils/collection/pluck');


	var reduceRight = function(list, iterator, memo) {
		var reversed = map(list, function(val, i) {
			return {index: i, value: val};
		}).reverse();
		reversed = pluck(reversed, 'value');
		return reduce(reversed, iterator, memo);
	};


	return reduceRight;

});

define('every',['require','./Deferred','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Returns `true` if all values in `list` pass `iterator` truth test
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var every = function(list, iterator) {

		var superDeferred = new Deferred();

		forEach(list, function(item, i, list) {
			return anyToDeferred(iterator(item, i, list))
				.done(function(result) {
					if (result !== true) {
						superDeferred.resolve(false);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(true);
		});

		return superDeferred.promise();

	};


	return every;

});

define('filter',['require','./Deferred','amd-utils/collection/map','amd-utils/collection/pluck','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var map = require('amd-utils/collection/map');
	var pluck = require('amd-utils/collection/pluck');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Returns an array of all values in `list` which pass `iterator` truth
	 * test
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var filter = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = map(list, function(val, i) {
			return {
				index: i,
				value: val
			};
		});

		forEach(list, function(item) {
			return anyToDeferred(iterator(item.value, item.index, list))
				.done(function(result) {
					if (result === true) {
						results.push(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			results = results.sort(function(a, b) {
				return a.index - b.index;
			});
			results = pluck(results, 'value');
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return filter;

});

define('filterSeries',['require','./Deferred','amd-utils/collection/map','amd-utils/collection/pluck','./forEachSeries','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var map = require('amd-utils/collection/map');
	var pluck = require('amd-utils/collection/pluck');
	var forEachSeries = require('./forEachSeries');
	var anyToDeferred = require('./anyToDeferred');


	/**
	 * Version of filter which is guaranteed to process items in order
	 * @param {Array|Object} list
	 * @param {Function} iterator
	 * @return {Promise}
	 */
	var filterSeries = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = map(list, function(val, i) {
			return {index: i, value: val};
		});

		forEachSeries(list, function(item) {
			return anyToDeferred(iterator(item.value, item.index, list))
				.done(function(result) {
					if (result === true) {
						results.push(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			results = results.sort(function(a, b) {
				return a.index - b.index;
			});
			results = pluck(results, 'value');
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return filterSeries;

});

define('findSeries',['require','./Deferred','./forEachSeries','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var forEachSeries = require('./forEachSeries');
	var anyToDeferred = require('./anyToDeferred');


	var find = function(list, iterator) {

		var superDeferred = new Deferred();

		forEachSeries(list, function(item, i) {
			return anyToDeferred(iterator(item, i, list))
				.done(function(result) {
					if (result) {
						superDeferred.resolve(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(undefined);
		});

		return superDeferred.promise();

	};


	return find;

});

define('mapSeries',['require','./Deferred','amd-utils/collection/map','./forEachSeries','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var cmap = require('amd-utils/collection/map');
	var forEachSeries = require('./forEachSeries');
	var anyToDeferred = require('./anyToDeferred');


	var mapSeries = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = cmap(list, function (val, i) {
			return {index: i, value: val};
		});

		forEachSeries(list, function(item) {
			return anyToDeferred(iterator(item.value, item.index, list))
				.fail(function(err) {
					results[item.index] = err;
				})
				.done(function(transformed) {
					results[item.index] = transformed;
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return mapSeries;

});

define('amd-utils/lang/toArray',['./kindOf'], function (kindOf) {

    var _win = this;

    /**
     * Convert array-like object into array
     * @version 0.3.1 (2012/08/30)
     */
    function toArray(val){
        var ret = [],
            kind = kindOf(val),
            n;

        if (val != null) {
            if ( val.length == null || kind === 'String' || kind === 'Function' || kind === 'RegExp' || val === _win ) {
                //string, regexp, function have .length but user probably just want
                //to wrap value into an array..
                ret[ret.length] = val;
            } else {
                //window returns true on isObject in IE7 and may have length
                //property. `typeof NodeList` returns `function` on Safari so
                //we can't use it (#58)
                n = val.length;
                while (n--) {
                    ret[n] = val[n];
                }
            }
        }
        return ret;
    }
    return toArray;
});

define('parallel',['require','./Deferred','amd-utils/lang/isArray','amd-utils/lang/toArray','./anyToDeferred','./forEach','./map'],function(require) {

	var Deferred = require('./Deferred');
	var isArray = require('amd-utils/lang/isArray');
	var toArray = require('amd-utils/lang/toArray');
	var anyToDeferred = require('./anyToDeferred');
	var forEach = require('./forEach');
	var map = require('./map');


	var parallel = function(tasks) {

		var superDeferred = new Deferred();

		if (arguments.length > 1) {
			tasks = toArray(arguments);
		}

		if (isArray(tasks)) {
			map(tasks, function(task) {
				return anyToDeferred(task);
			}).fail(function() {
				superDeferred.reject.apply(superDeferred, arguments);
			}).done(function(results) {
				superDeferred.resolve(results);
			});
		}
		else {
			var results = {};
			forEach(tasks, function(task, key) {
				var deferred = anyToDeferred(task);
				return deferred.done(function(result) {
					results[key] = result;
				});
			}).fail(function() {
				superDeferred.reject.apply(superDeferred, arguments);
			}).done(function() {
				superDeferred.resolve(results);
			});
		}

		return superDeferred.promise();

	};


	return parallel;

});

define('reject',['require','./Deferred','amd-utils/collection/map','amd-utils/collection/pluck','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var map = require('amd-utils/collection/map');
	var pluck = require('amd-utils/collection/pluck');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	var reject = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = map(list, function(val, i) {
			return {index: i, value: val};
		});

		forEach(list, function(item) {
			return anyToDeferred(iterator(item.value, item.index, list))
				.done(function(result) {
					if (!result) {
						results.push(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			results = results.sort(function(a, b) {
				return a.index - b.index;
			});
			results = pluck(results, 'value');
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return reject;

});

define('rejectSeries',['require','./Deferred','amd-utils/collection/map','amd-utils/collection/pluck','./forEachSeries','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var map = require('amd-utils/collection/map');
	var pluck = require('amd-utils/collection/pluck');
	var forEachSeries = require('./forEachSeries');
	var anyToDeferred = require('./anyToDeferred');


	var rejectSeries = function(list, iterator) {

		var superDeferred = new Deferred();
		var results = [];

		list = map(list, function(val, i) {
			return {index: i, value: val};
		});

		forEachSeries(list, function (item) {
			return anyToDeferred(iterator(item.value, item.index))
				.done(function(result) {
					if (!result) {
						results.push(item);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			results = results.sort(function(a, b) {
				return a.index - b.index;
			});
			results = pluck(results, 'value');
			superDeferred.resolve(results);
		});

		return superDeferred.promise();

	};


	return rejectSeries;

});

define('series',['require','./Deferred','amd-utils/lang/isArray','amd-utils/lang/toArray','./anyToDeferred','./forEachSeries','./mapSeries'],function(require) {

	var Deferred = require('./Deferred');
	var isArray = require('amd-utils/lang/isArray');
	var toArray = require('amd-utils/lang/toArray');
	var anyToDeferred = require('./anyToDeferred');
	var forEachSeries = require('./forEachSeries');
	var mapSeries = require('./mapSeries');


	var series = function(tasks) {

		var superDeferred = new Deferred();

		if (arguments.length > 1) {
			tasks = toArray(arguments);
		}

		if (isArray(tasks)) {
			mapSeries(tasks, function(task) {
				return anyToDeferred(task);
			}).fail(function() {
				superDeferred.reject();
			}).done(function(results) {
				superDeferred.resolve(results);
			});
		}
		else {
			var results = {};
			forEachSeries(tasks, function(task, key) {
				var deferred = anyToDeferred(task);
				return deferred.done(function(result) {
					results[key] = result;
				});
			}).fail(function() {
				superDeferred.reject();
			}).done(function() {
				superDeferred.resolve(results);
			});
		}

		return superDeferred.promise();

	};


	return series;

});

define('some',['require','./Deferred','./forEach','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var forEach = require('./forEach');
	var anyToDeferred = require('./anyToDeferred');


	var some = function(list, iterator) {

		var superDeferred = new Deferred();

		forEach(list, function(item, i) {
			return anyToDeferred(iterator(item, i, list))
				.done(function(result) {
					if (result) {
						superDeferred.resolve(true);
					}
				});
		}).fail(function() {
			superDeferred.reject.apply(superDeferred, arguments);
		}).done(function() {
			superDeferred.resolve(false);
		});

		return superDeferred.promise();

	};


	return some;

});

define('until',['require','./Deferred','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var anyToDeferred = require('./anyToDeferred');


	var until = function(test, iterator) {

		var superDeferred = new Deferred();

		var runTest = function(test, iterator) {
			anyToDeferred(test())
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function(result) {
					if (result) {
						superDeferred.resolve();
					}
					else {
						runIterator(test, iterator);
					}
				});
		};

		var runIterator = function(test, iterator) {
			anyToDeferred(iterator())
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function() {
					runTest(test, iterator);
				});
		};

		runTest(test, iterator);

		return superDeferred.promise();

	};


	return until;

});

define('waterfall',['require','./Deferred','amd-utils/lang/isArray','amd-utils/lang/toArray','./anyToDeferred','amd-utils/object/keys','amd-utils/collection/size'],function(require) {

	var Deferred = require('./Deferred');
	var isArray = require('amd-utils/lang/isArray');
	var toArray = require('amd-utils/lang/toArray');
	var anyToDeferred = require('./anyToDeferred');
	var objkeys = require('amd-utils/object/keys');
	var size = require('amd-utils/collection/size');


	var waterfall = function(tasks) {

		var superDeferred = new Deferred();

		if (arguments.length > 1) {
			tasks = toArray(arguments);
		}

		if (!size(tasks)) {
			superDeferred.reject();
			return superDeferred;
		}

		var completed = 0;
		var keys;
		if (!isArray(tasks)) {
			keys = objkeys(tasks);
		}

		var iterate = function() {
			var args = toArray(arguments);
			var task;
			var key;

			if (isArray(tasks)) {
				key = completed;
				task = tasks[key];
			}
			else {
				key = keys[completed];
				task = tasks[key];
			}

			args.unshift(task);

			anyToDeferred.apply(this, args)
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function() {
					completed += 1;
					if (completed === size(tasks)) {
						superDeferred.resolve.apply(superDeferred, arguments);
					}
					else {
						iterate.apply(superDeferred, arguments);
					}
				});
		};

		iterate();

		return superDeferred.promise();

	};


	return waterfall;

});

define('whilst',['require','./Deferred','./anyToDeferred'],function(require) {

	var Deferred = require('./Deferred');
	var anyToDeferred = require('./anyToDeferred');


	var whilst = function(test, iterator) {

		var superDeferred = new Deferred();

		var runTest = function(test, iterator) {
			anyToDeferred(test())
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function(result) {
					if (result) {
						runIterator(test, iterator);
					}
					else {
						superDeferred.resolve();
					}
				});
		};

		var runIterator = function(test, iterator) {
			anyToDeferred(iterator())
				.fail(function() {
					superDeferred.reject.apply(superDeferred, arguments);
				})
				.done(function() {
					runTest(test, iterator);
				});
		};

		runTest(test, iterator);

		return superDeferred.promise();

	};


	return whilst;

});

define('Deferreds',['require','./anyToDeferred','./every','./filter','./filterSeries','./find','./findSeries','./forceNew','./forEach','./forEachSeries','./isDeferred','./isPromise','./map','./mapSeries','./parallel','./reduce','./reduceRight','./reject','./rejectSeries','./series','./some','./until','./waterfall','./whilst'],function(require) {

	/** @namespace */
	var Deferreds = {
		'anyToDeferred': require('./anyToDeferred'),
		'every': require('./every'),
		'filter': require('./filter'),
		'filterSeries': require('./filterSeries'),
		'find': require('./find'),
		'findSeries': require('./findSeries'),
		'forceNew': require('./forceNew'),
		'forEach': require('./forEach'),
		'forEachSeries': require('./forEachSeries'),
		'isDeferred': require('./isDeferred'),
		'isPromise': require('./isPromise'),
		'map': require('./map'),
		'mapSeries': require('./mapSeries'),
		'parallel': require('./parallel'),
		'reduce': require('./reduce'),
		'reduceRight': require('./reduceRight'),
		'reject': require('./reject'),
		'rejectSeries': require('./rejectSeries'),
		'series': require('./series'),
		'some': require('./some'),
		'until': require('./until'),
		'waterfall': require('./waterfall'),
		'whilst': require('./whilst')
	};


	return Deferreds;

});


/*
-----------------------------------------
Global definitions for a built project
-----------------------------------------
*/

return {
	"../../tasks/dist/lib/almond": require("../../tasks/dist/lib/almond"),
	"isDeferred": require("isDeferred"),
	"forceNew": require("forceNew"),
	"amd-utils/lang/kindOf": require("amd-utils/lang/kindOf"),
	"amd-utils/lang/isKind": require("amd-utils/lang/isKind"),
	"amd-utils/lang/isArray": require("amd-utils/lang/isArray"),
	"Promise": require("Promise"),
	"Deferred": require("Deferred"),
	"amd-utils/lang/isObject": require("amd-utils/lang/isObject"),
	"amd-utils/object/hasOwn": require("amd-utils/object/hasOwn"),
	"amd-utils/object/forIn": require("amd-utils/object/forIn"),
	"amd-utils/object/forOwn": require("amd-utils/object/forOwn"),
	"amd-utils/object/values": require("amd-utils/object/values"),
	"amd-utils/array/forEach": require("amd-utils/array/forEach"),
	"amd-utils/array/map": require("amd-utils/array/map"),
	"amd-utils/collection/map": require("amd-utils/collection/map"),
	"amd-utils/collection/make_": require("amd-utils/collection/make_"),
	"amd-utils/collection/forEach": require("amd-utils/collection/forEach"),
	"amd-utils/object/size": require("amd-utils/object/size"),
	"amd-utils/collection/size": require("amd-utils/collection/size"),
	"amd-utils/lang/isFunction": require("amd-utils/lang/isFunction"),
	"isPromise": require("isPromise"),
	"anyToDeferred": require("anyToDeferred"),
	"forEach": require("forEach"),
	"map": require("map"),
	"find": require("find"),
	"amd-utils/object/keys": require("amd-utils/object/keys"),
	"forEachSeries": require("forEachSeries"),
	"reduce": require("reduce"),
	"amd-utils/collection/pluck": require("amd-utils/collection/pluck"),
	"reduceRight": require("reduceRight"),
	"every": require("every"),
	"filter": require("filter"),
	"filterSeries": require("filterSeries"),
	"findSeries": require("findSeries"),
	"mapSeries": require("mapSeries"),
	"amd-utils/lang/toArray": require("amd-utils/lang/toArray"),
	"parallel": require("parallel"),
	"reject": require("reject"),
	"rejectSeries": require("rejectSeries"),
	"series": require("series"),
	"some": require("some"),
	"until": require("until"),
	"waterfall": require("waterfall"),
	"whilst": require("whilst"),
	"Deferreds": require("Deferreds")
};


})();