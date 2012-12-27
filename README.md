amd-doc
=======

amd-doc is a JavaScript documentation generator for AMD-based projects.  It
post-processes the JSON output of jsdoc3, using RequireJS configuration and AMD
conventions to infer more information.


Installation
-------------

```
npm install amd-doc
```


Usage
-----

The main functionality of amd-doc is exposed through the `compile` function. It
returns a [Deferred object](http://api.jquery.com/category/deferred-object/)
and accepts an `opts` argument which can contain these properties (example from
[deferreds.js](https://github.com/zship/deferreds.js)):

```js
var amddoc = require('amd-doc');

amddoc.compile({
	//globbing-supported String or Array of Strings with process-relative
	//files to process for documentation
	include: 'src/deferreds/**/*.js',

	//directory to output generated HTML (default = 'doc/out')
	out: 'doc/out',

	//directory to store jsdoc cache (default = 'doc/cache')
	cache: 'doc/cache',

	//directory to look for markdown mixins (default = 'doc/mixin')
	mixin: 'doc/mixin',

	//github URL where source is available. the file path and line number of
	//each documented variable will be added to this to make source links.
	repoview: 'https://github.com/zship/deferreds.js/blob/develop/',

	//Array of Type (see tasks/doc/Types.js) objects to transform into links
	//when used as parameter types, return types, or description namepaths
	types: (function() {
		var types = [];

		//make all built-in types link to their MDN pages
		['Number', 'String', 'Object', 'Function', 'Array', 'RegExp', 'Boolean'].forEach(function(val) {
			types.push({
				name: val,
				link: 'https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/' + val
			});
		});

		types.push({
			name: 'Any',
			link: 'https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects'
		});

		types.push({
			name: 'void',
			link: 'https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/undefined'
		});

		types.push({
			name: 'Element',
			link: 'https://developer.mozilla.org/en-US/docs/DOM/element'
		});

		types.push({
			name: 'jQuery',
			link: 'http://api.jquery.com/jQuery/'
		});

		types.push({
			name: 'require',
			link: 'http://requirejs.org/'
		});

		types.push({
			//any name matching this RegExp (with name.search()) will be given
			//the following link
			regexp: /amd-utils\/.*/,
			link: 'http://millermedeiros.github.com/amd-utils/'
		});

		return types;
	})(),

	//requirejs configuration object
	//more: https://github.com/jrburke/r.js/blob/master/build/example.build.js
	//amd-doc uses `basePath`, `paths`, and `packages` (all optional) to
	//transform file names to AMD module names.
	requirejs: {
		baseUrl: 'src/deferreds',
		optimize: 'none',
		packages: [
			{ name: 'amd-utils', location: '../lib/amd-utils' }
		],
	}
});
```


What it does
------------

### Inferred information

* **Class names**
	* Convention: one class per file - names the class after the last part of
	  the module name (e.g. 'joss/geometry/Rect' -> 'Rect')
	* When using `@lends`, any name may be specified and it will be replaced by
	  the last part of the module name (i.e. `/** @lends __.prototype */` will
	  apply its properties to the only class defined in the file, regardless of
	  the existence of a variable `__`)
* **Namespace names**
	* Convention: one namespace per file - names the namespace after the last
	  part of the module name
	* `@namespace` may be used by itself (with no name to assign to the
	  namespace)
* **Dependencies**
	* AMD dependencies of each file are included in the output

### Other Additions

* Cache jsdoc output
	* jsdoc3 is very comprehensive, but suffers from poor performance.  amd-doc
	  tries to compensate by maintaining a per-file cache, with freshness
	  determined by hashing each source file's contents and comparing on each
	  run.
* Type system
	* Every declared class will, on declaration, have a Type object associated
	  with it (see tasks/doc/Types.js). These Types contain both long names
	  (full module names) and short names (last part of the module name) and
	  are used to match against AMD dependencies, parameters, return types, and
	  namepaths in descriptions.
	* External types like {String} and {Object} can be specified in the
	  configuration object, to present links in the output. (e.g. {String} can
	  become
	  [String](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String),
	  linking to [MDN](https://developer.mozilla.org/en-US/)'s String
	  reference)
* Mixing-in markdown documentation from external files
	* Markdown files can be specified in a directory structure mirroring your
	  source, one per source file. Any `h2`s (`##`) in the file will be matched
	  against variable names in your source, and content under the `h2` will
	  replace the description for that variable
* Converting jsdoc namepaths or Type names to links within descriptions
	* Specify namepaths between braces `{}`, and if there is a matching
	  documented variable, the namepath will be converted to a link.
	* `{joss/geometry/Rect#moveTop}` becomes [Rect.moveTop](link_to_Rect_moveTop)
	* `{Rect#moveTop}` also becomes [Rect.moveTop](link_to_Rect_moveTop), if
	  the short-name "Rect" is not declared more than once
	* `{joss/geometry/Rect}` becomes [Rect](Rect). (it's a Type name, not a
	  jsdoc namepath)
* Multiple inheritance
	* Using the [C3 Method Resolution
	  Order algorithm](http://www.python.org/download/releases/2.3/mro/), the full
	  inheritance heirarchy of classes which `@extend` multiple Classes is
	  computed.
* Unstyled HTML output
	* Module definition for each module
		* `code` and `pre` blocks will be processed by
		  [highlight-js](http://softwaremaniacs.org/soft/highlight/en/)
	* Taglist for each module
		* taglists and module definitions are rendered from
		  [jade](https://github.com/visionmedia/jade) templates (see tasks/tpl)
	* Hierarchical menu linking to every module
* Summary information
	* List of all declared and external Types, both long names and short names
	* List of ambiguous short names (e.g. `joss/geometry/Rect` and
	  `joss/display/Rect` are unique modules, but the last part (the
	  short-name) of both is `Rect`)
	* List of undeclared Types (used in parameters, return types, or
	  description namepaths but never declared)
	* Percentage of documented variables with markdown descriptions
	* Percentage of documented variables with non-empty descriptions
	* (Guess) list of direct members of documented classes which have no jsdoc
	  annotations, but probably should (because they're direct members)


amd-doc was created as the documentation generator for the
[joss](https://github.com/zship/joss) framework.
