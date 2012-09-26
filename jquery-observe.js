// File -- ./lib/jquery-path.js
(function($) {
	$.fn.path = function(target) {
		var result = [];
		var hasTarget = !!target;

		target = $(target || window.document);

		this.each(function() {
			var selector = [];
			var prev = $(this);

			for(var current = prev.parent(); current.length && !prev.is(target); current = current.parent()) {
				var tag = prev.get(0).tagName.toLowerCase();

				selector.push(tag + ':eq(' + current.children(tag).index(prev) + ')');

				prev = current;
			}

			if(hasTarget && !current.length && !prev.is(target)) {
				return;
			}

			result.push(selector.reverse().join(' > '));
		});

		return result.join(', ');
	};
	
	$.fn.capturePath = function(target) {
		var start = this;
		var isText = this.get(0) instanceof Text;
		var index;

		if(isText) {
			start = this.parent();

			var contents = start.contents();

			for(index = 0; index < contents.length; index++) {
				if(contents[index] === this[0]) {
					break;
				}
			}
		}

		var path = start.path(target);

		return function(origin) {
			if(!origin) {
				if(this instanceof jQuery || this.nodeType) {
					origin = this;
				} else {
					origin = document;
				}
			}

			var match = $(origin).find(path);

			if(!isText) {
				return match;
			}

			return $(match.contents()[index]);
		};
	};
	$.fn.yieldPath = function(path) {
		return (typeof path === 'function') ? path(this) : this.find(path);
	};
}(jQuery));

// File -- ./lib/jquery-branch.js
(function($) {
	if(!$.sub) {
		// Taken from jQuery deprecated module
		// https://github.com/jquery/jquery/blob/master/src/deprecated.js
		jQuery.sub = function() {
			function jQuerySub( selector, context ) {
				return new jQuerySub.fn.init( selector, context );
			}
			jQuery.extend( true, jQuerySub, this );
			jQuerySub.superclass = this;
			jQuerySub.fn = jQuerySub.prototype = this();
			jQuerySub.fn.constructor = jQuerySub;
			jQuerySub.sub = this.sub;
			jQuerySub.fn.init = function init( selector, context ) {
				if ( context && context instanceof jQuery && !(context instanceof jQuerySub) ) {
					context = jQuerySub( context );
				}

				return jQuery.fn.init.call( this, selector, context, rootjQuerySub );
			};
			jQuerySub.fn.init.prototype = jQuerySub.fn;
			var rootjQuerySub = jQuerySub(document);
			return jQuerySub;
		};
	}

	var ProxyJQuery = $.sub();

	['find', 'has', 'not', 'filter', 'is', 'closest', 'index', 'add', 'addBack'].forEach(function(name) {
		var fn = ProxyJQuery.fn[name];

		ProxyJQuery.fn[name] = function() {
			var args = [];
			var root;

			for(var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];

				if(arg && (arg.nodeType || arg instanceof jQuery)) {
					var elements = $(arg);

					root = root || this.root();
					
					if(root.find(elements).length) {
						args.push(arg);
						continue;
					}

					var mapped = [];

					for(var i = 0; i < elements.length; i++) {
						var e = $(elements[i]);
						var path = e.capturePath(root.data('branch'));

						mapped = mapped.concat(root.yieldPath(path).get());
					}

					arg = $(mapped);
				}

				args.push(arg);
			}

			return ProxyJQuery(fn.apply(this, args).get());
		};
	});

	$.fn.root = function() {
		var roots = this.map(function() {
			var current = $(this);
			var prev;

			while(current.length) {
				prev = current;
				current = current.parent();
			}

			return prev.get(0);
		}).get();

		return $($.unique(roots));
	};
	$.fn.branch = function(withDataAndEvents, deepWithDataAndEvents) {
		withDataAndEvents = withDataAndEvents === undefined ? false : withDataAndEvents;
		deepWithDataAndEvents = deepWithDataAndEvents === undefined ? false : deepWithDataAndEvents;

		return ProxyJQuery(this.clone(withDataAndEvents, deepWithDataAndEvents)
								.data('branch', this)
								.get());
	};
}(jQuery));

// File -- ./index.js
(function($) {
	var toObject = function(array, fn) {
		var result = {};

		array.forEach(function(name) {
			var pair = fn(name);

			if(pair) {
				result[pair[0]] = pair[1];
			}
		});

		return result;
	};

	var OBSERVER_OPTIONS = toObject([
		'childList',
		'attributes',
		'characterData',
		'subtree',
		'attributeOldValue',
		'characterDataOldValue',
		'attributeFilter'
	], function(name) { 
		return [name.toLowerCase(), name];
	});
	var ALL = toObject(Object.keys(OBSERVER_OPTIONS), function(name) {
		if(name !== 'attributefilter') {
			return [OBSERVER_OPTIONS[name], true];
		}
	});
	var EXTENDED_OPTIONS = toObject([
		'added',
		'removed'
	], function(name) {
		return [name.toLowerCase(), name];
	});

	var EMPTY = $([]);

	var parseOptions = function(options) {
		if(typeof options === 'object') {
			return options;
		}

		options = options.split(/\s+/);

		var result = {};

		options.forEach(function(opt) {
			opt = opt.toLowerCase();

			if(!OBSERVER_OPTIONS[opt] && !EXTENDED_OPTIONS[opt]) {
				throw new Error('Unknown option ' + opt);
			}

			result[OBSERVER_OPTIONS[opt] || EXTENDED_OPTIONS[opt]] = true;
		});

		return result;
	};
	var mapTextNodes = function(collection) {
		return Array.prototype.slice.call(collection).map(function(node) {
			if(node instanceof Text) {
				return $(node).parent().get(0);
			}

			return node;
		});
	};

	var objectToString = function(obj) {
		return '[' + Object.keys(obj).sort().reduce(function(acc, key) {
			var valueStr = (obj[key] && typeof obj[key] === 'object') ? objectToString(obj[key]) : obj[key];

			return acc + '[' + JSON.stringify(key) + ':' + valueStr + ']';
		}, '') + ']';
	};

	var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	
	var Pattern = function(target, options, selector, handler) {
		this._originalOptions = $.extend({}, options);
		options = $.extend({}, options);

		this.attributeFilter = options.attributeFilter;

		delete options.attributeFilter;

		if(selector) {
			options.subtree = true;
		}
		if(options.childList) {
			options.added = true;
			options.removed = true;
		}
		if(options.added || options.removed) {
			options.childList = true;
		}

		this.target = $(target);
		this.options = options;
		this.selector = selector;
		this.handler = handler;
	};
	Pattern.prototype.is = function(options, selector, handler) {
		return objectToString(this._originalOptions) === objectToString(options) &&
			this.selector === selector &&
			this.handler === handler;
	};
	Pattern.prototype.match = function(record) {
		var self = this;
		var options = this.options;
		var type = record.type;

		if(!this.options[type]) {
			return EMPTY;
		}

		if(this.selector) {
			switch(type) {
			case 'attributes':
				if(!this._matchAttributeFilter(record)) {
					break;
				}
			case 'characterData':
				return this._matchAttributesAndCharacterData(record);
			case 'childList':
				if(record.addedNodes && record.addedNodes.length && options.added) {
					var result = this._matchAddedNodes(record);

					if(result.length) {
						return result;
					}
				}
				if(record.removedNodes && record.removedNodes.length && options.removed) {
					return this._matchRemovedNodes(record);
				}
			}
		} else {
			switch(type) {
			case 'attributes':
				if(!this._matchAttributeFilter(record)) {
					break;
				}
			case 'characterData':
				if(!options.subtree && record.target !== this.target.get(0)) {
					break;
				}

				return $(record.target);
			case 'childList':
				if(!options.subtree && record.target !== this.target.get(0)) {
					break;
				}

				if((record.addedNodes && record.addedNodes.length && options.added) ||
					(record.removedNodes && record.removedNodes.length && options.removed)) {

					return $(record.target);
				}
			}
		}

		return EMPTY;
	};
	Pattern.prototype._matchAttributesAndCharacterData = function(record) {
		return this._matchSelector(this.target, [record.target]);
	};
	Pattern.prototype._matchAddedNodes = function(record) {
		return this._matchSelector(this.target, record.addedNodes);
	};
	Pattern.prototype._matchRemovedNodes = function(record) {
		var branch = this.target.branch();
		var nodes = Array.prototype.slice.call(record.removedNodes);

		if(record.previousSibling) {
			branch.find(record.previousSibling).after(nodes);
		} else if(record.nextSibling) {
			branch.find(record.nextSibling).before(nodes);
		} else {
			branch.find(record.target).empty().append(nodes);
		}

		return this._matchSelector(branch, nodes).length ? $(record.target) : EMPTY;
	};
	Pattern.prototype._matchSelector = function(origin, element) {
		var match = origin.find(this.selector);
		element = $(mapTextNodes(element));

		match = match.filter(function() {
			return element.is(this) || element.has(this).length;
		});

		return match.length ? match : EMPTY;
	};
	Pattern.prototype._matchAttributeFilter = function(record) {
		if(this.attributeFilter && this.attributeFilter.length) {
			return this.attributeFilter.indexOf(record.attributeName) >= 0;
		}

		return true;
	};

	var Observer = function(target) {
		this.patterns = [];

		this._target = target;
		this._observer = null;
	};
	Observer.prototype.observe = function(options, selector, handler) {
		var self = this;

		if(!this._observer) {
			this._observer = new MutationObserver(function(records) {
				records.forEach(function(record) {
					for(var i = 0; i < self.patterns.length; i++) {
						var pattern = self.patterns[i];
						var match = pattern.match(record);
						
						if(match.length) {
							match.each(function() {
								pattern.handler.call(this, record);
							});
						}					
					}
				});
			});
		} else {
			this._observer.disconnect();
		}

		this.patterns.push(new Pattern(this._target, options, selector, handler));
		this._observer.observe(this._target, this._collapseOptions());
	};
	Observer.prototype.disconnect = function(options, selector, handler) {
		var self = this;

		if(this._observer) {
			this.patterns.filter(function(pattern) {
				return pattern.is(options, selector, handler);
			}).forEach(function(pattern) {
				var index = self.patterns.indexOf(pattern);

				self.patterns.splice(index, 1);
			});

			if(!this.patterns.length) {
				this._observer.disconnect();
			}
		}
	};
	Observer.prototype.disconnectAll = function() {
		if(this._observer) {
			this.patterns = [];
			this._observer.disconnect();
		}
	};
	Observer.prototype.pause = function() {
		if(this._observer) {
			this._observer.disconnect();
		}
	};
	Observer.prototype.resume = function() {
		if(this._observer) {
			this._observer.observe(this._target, this._collapseOptions());
		}
	};
	Observer.prototype._collapseOptions = function() {
		var result = {};

		this.patterns.forEach(function(pattern) {
			var restrictiveFilter = result.attributes && result.attributeFilter;

			if((restrictiveFilter || !result.attributes) && pattern.attributeFilter) {
				var attributeFilter = (result.attributeFilter || []).concat(pattern.attributeFilter);
				var existing = {};
				var unique = [];

				attributeFilter.forEach(function(attr) {
					if(!existing[attr]) {
						unique.push(attr);
						existing[attr] = 1;
					}
				});

				result.attributeFilter = unique;
			} else if(restrictiveFilter && pattern.options.attributes && !pattern.attributeFilter) {
				delete result.attributeFilter;
			}

			$.extend(result, pattern.options);
		});

		Object.keys(EXTENDED_OPTIONS).forEach(function(name) {
			delete result[EXTENDED_OPTIONS[name]];
		});

		return result;
	};

	$.fn.observe = function(options, selector, handler) {
		if(!selector) {
			handler = options;
			options = ALL;
		} else if(!handler) {
			handler = selector;
			selector = null;
		}

		return this.each(function() {
			var self = $(this);
			var observer = self.data('observer');

			if(!observer) {
				observer = new Observer(this);
				self.data('observer', observer);
			}

			options = parseOptions(options);

			observer.observe(options, selector, handler);
		});
	};
	$.fn.disconnect = function(options, selector, handler) {
		if(!options) {
			// No arguments
		}
		else if(!selector) {
			handler = options;
			options = ALL;
		} else if(!handler) {
			handler = selector;
			selector = null;
		}

		return this.each(function() {
			var self = $(this);
			var observer = self.data('observer');

			if(!observer) {
				return;
			}

			if(!options) {
				observer.disconnectAll();
				self.removeData('observer');

				return;
			}

			options = parseOptions(options);

			observer.disconnect(options, selector, handler);
		});
	};
}(jQuery));
