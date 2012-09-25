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
		return [name.toLowerCase(), name] 
	});
	var ALL = toObject(Object.keys(OBSERVER_OPTIONS), function(name) {
		if(name !== 'attributefilter') {
			return [OBSERVER_OPTIONS[name], true];
		}
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

			if(!OBSERVER_OPTIONS[opt]) {
				throw new Error('Unknown option ' + opt);
			}

			result[OBSERVER_OPTIONS[opt]] = true;
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

	var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	
	var Pattern = function(target, options, selector, handler) {
		this.attributeFilter = options.attributeFilter;

		delete options.attributeFilter;

		if(selector) {
			options.subtree = true;
		}

		this.target = $(target);
		this.options = options;
		this.selector = selector;
		this.handler = handler;
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
					return EMPTY;
				}
			case 'characterData':
				return this._matchAttributesAndCharacterData(record);
			case 'childList':
				if(record.addedNodes && record.addedNodes.length) {
					return this._matchAddedNodes(record);
				}
				if(record.removedNodes && record.removedNodes.length) {
					return this._matchRemovedNodes(record);
				}
			}
		} else {
			switch(type) {
			case 'attributes':
				if(!this._matchAttributeFilter(record)) {
					return EMPTY;
				}
			case 'characterData':
			case 'childList':
				if(!options.subtree && record.target !== this.target.get(0)) {
					return EMPTY;
				}

				return $(record.target);
			}
		}
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

		return match.closest(element).length ? match : EMPTY;
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
	Observer.prototype.disconnect = function() {
		if(this._observer) {
			this._observer.disconnect();
		}
	};
	Observer.prototype.reconnect = function() {
		if(this._observer) {
			this._observer.observe(this._target, this._collapseOptions());
		}
	};
	Observer.prototype._collapseOptions = function() {
		var result = {};

		this.patterns.forEach(function(pattern) {
			var restrictiveFiler = result.attributes && result.attributeFilter;

			$.extend(result, pattern.options);

			if(restrictiveFiler && pattern.attributeFilter) {
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
			}
		});

		return result;
	};

	$.fn.observe = function(options, selector, handler) {
		return this.each(function() {
			var self = $(this);
			var observer = self.data('observer');

			if(!observer) {
				observer = new Observer(this);
				self.data('observer', observer);
			}

			if(!selector) {
				handler = options;
				options = ALL;
			} else if(!handler) {
				handler = selector;
				selector = null;
			}

			options = parseOptions(options);

			observer.observe(options, selector, handler);
		});
	};
}(jQuery));
