(function($) {
	$.Observe = {};
}(jQuery));

(function($, ns) {
	var get = function(origin, target) {
		if(!target) {
			target = origin;
			origin = window.document;
		}

		var result = [];

		$(target).each(function() {
			var selector = [];
			var prev = $(this);

			for(var current = prev.parent(); current.length && !prev.is(origin); current = current.parent()) {
				var tag = prev.get(0).tagName.toLowerCase();

				selector.push(tag + ':eq(' + current.children(tag).index(prev) + ')');

				prev = current;
			}

			if(!current.length && !prev.is(origin)) {
				return;
			}

			result.push('> ' + selector.reverse().join(' > '));
		});

		return result.join(', ');
	};

	var capture = function(origin, target) {
		if(!target) {
			target = origin;
			origin = window.document;
		}

		var result = [];

		$(target).each(function() {
			var textIndex = -1;
			var realTarget = this;

			if(this instanceof Text) {
				realTarget = this.parentNode;
				var children = realTarget.childNodes;

				for(var i = 0; i < children.length; i++) {
					if(children[i] === this) {
						textIndex = i;
						break;
					}
				}
			}

			var path = get(origin, realTarget);
			var same = $(origin).is(realTarget);

			result.push(function(origin) {
				var target = same ? origin : $(origin).find(path);
				return textIndex === -1 ? target : target.contents()[textIndex];
			});
		});

		return function(origin) {
			origin = origin || window.document;

			return result.reduce(function(acc, fn) {
				return acc.add(fn(origin));
			}, $([]));
		};
	};

	ns.path = {
		get: get,
		capture: capture
	};
}(jQuery, jQuery.Observe));

(function($, ns) {
	var Branch = function(root) {
		this.original = $(root);
		this.root = this.original.clone(false, true);
	};

	Branch.prototype.find = function(selector) {
		var path = ns.path.capture(this.original, selector);
		return path(this.root);
	};

	ns.Branch = Branch;
}(jQuery, jQuery.Observe));

(function($, ns) {
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
			var recordTarget = record.target instanceof Text ?
				$(record.target).parent() : $(record.target);

			if(!options.subtree && recordTarget.get(0) !== this.target.get(0)) {
				return EMPTY;
			}

			switch(type) {
			case 'attributes':
				if(!this._matchAttributeFilter(record)) {
					break;
				}
			case 'characterData':
				return this.target;
			case 'childList':
				if((record.addedNodes && record.addedNodes.length && options.added) ||
					(record.removedNodes && record.removedNodes.length && options.removed)) {

					return this.target;
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
		var branch = new ns.Branch(this.target);
		var nodes = Array.prototype.slice.call(record.removedNodes).map(function(node) {
			return node.cloneNode(true);
		});

		if(record.previousSibling) {
			branch.find(record.previousSibling).after(nodes);
		} else if(record.nextSibling) {
			branch.find(record.nextSibling).before(nodes);
		} else {
			branch.find(record.target).empty().append(nodes);
		}

		return this._matchSelector(branch.root, nodes).length ? $(record.target) : EMPTY;
	};
	Pattern.prototype._matchSelector = function(origin, element) {
		var match = origin.find(this.selector);
		element = Array.prototype.slice.call(element);

		match = match.filter(function() {
			var self = this;

			return element.some(function(node) {
				if(node instanceof Text) return node.parentNode === self;
				else return node === self || $(node).has(self).length;
			});
		});

		return match;
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
					self.patterns.forEach(function(pattern) {
						var match = pattern.match(record);

						if(match.length) {
							match.each(function() {
								pattern.handler.call(this, record);
							});
						}
					});
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

	var DOMEventObserver = function(target) {
		this.patterns = [];

		this._paused = false;
		this._target = target;
		this._events = {};
		this._handler = this._handler.bind(this);
	};
	DOMEventObserver.prototype.NS = '.jQueryObserve';
	DOMEventObserver.prototype.observe = function(options, selector, handler) {
		var pattern = new Pattern(this._target, options, selector, handler);
		var target = $(this._target);

		if(pattern.options.childList) {
			this._addEvent('DOMNodeInserted');
			this._addEvent('DOMNodeRemoved');
		}
		if(pattern.options.attributes) {
			this._addEvent('DOMAttrModified');
		}
		if(pattern.options.characterData) {
			this._addEvent('DOMCharacerDataModified');
		}

		this.patterns.push(pattern);
	};
	DOMEventObserver.prototype.disconnect = function(options, selector, handler) {
		var target = $(this._target);
		var self = this;

		this.patterns.filter(function(pattern) {
			return pattern.is(options, selector, handler);
		}).forEach(function(pattern) {
			var index = self.patterns.indexOf(pattern);

			self.patterns.splice(index, 1);
		});

		var eventsInUse = this.patterns.reduce(function(acc, pattern) {
			if(pattern.options.childList) {
				acc.DOMNodeInserted = true;
				acc.DOMNodeRemoved = true;
			}
			if(pattern.options.attributes) {
				acc.DOMAttrModified = true;
			}
			if(pattern.options.characterData) {
				acc.DOMCharacerDataModified = true;
			}

			return acc;
		}, {});

		Object.keys(this._events).forEach(function(type) {
			if(eventsInUse[type]) {
				return;
			}

			delete self._events[type];

			target.off(type + self.NS, self._handler);
		});
	};
	DOMEventObserver.prototype.disconnectAll = function() {
		var target = $(this._target);

		for(var name in this._events) {
			target.off(name + this.NS, this._handler);
		}

		this._events = {};
		this.patterns = [];
	};
	DOMEventObserver.prototype.pause = function() {
		this._paused = true;
	};
	DOMEventObserver.prototype.resume = function() {
		this._paused = false;
	};
	DOMEventObserver.prototype._handler = function(e) {
		if(this._paused) {
			return;
		}

		var record = {
			type: null,
			target: null,
			addedNodes: null,
			removedNodes: null,
			previousSibling: null,
			nextSibling: null,
			attributeName: null,
			attributeNamespace: null,
			oldValue: null
		};

		switch(e.type) {
		case 'DOMAttrModified':
			record.type = 'attributes';
			record.target = e.target;
			record.attributeName = e.attrName;
			record.oldValue = e.prevValue;

			break;
		case 'DOMCharacerDataModified':
			record.type = 'characterData';
			record.target = $(e.target).parent().get(0);
			record.attributeName = e.attrName;
			record.oldValue = e.prevValue;

			break;
		case 'DOMNodeInserted':
			record.type = 'childList';
			record.target = e.relatedNode;
			record.addedNodes = [e.target];
			record.removedNodes = [];

			break;
		case 'DOMNodeRemoved':
			record.type = 'childList';
			record.target = e.relatedNode;
			record.addedNodes = [];
			record.removedNodes = [e.target];

			break;
		}

		for(var i = 0; i < this.patterns.length; i++) {
			var pattern = this.patterns[i];
			var match = pattern.match(record);

			if(match.length) {
				match.each(function() {
					pattern.handler.call(this, record);
				});
			}
		}
	};
	DOMEventObserver.prototype._addEvent = function(type) {
		if(!this._events[type]) {
			$(this._target).on(type + this.NS, this._handler);
			this._events[type] = true;
		}
	};

	ns.Pattern = Pattern;
	ns.MutationObserver = Observer;
	ns.DOMEventObserver = DOMEventObserver;

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
				if(MutationObserver) {
					observer = new Observer(this);
				} else {
					observer = new DOMEventObserver(this);
				}

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
}(jQuery, jQuery.Observe));
