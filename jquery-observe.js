(function() {
	var OBSERVER_OPTIONS = [
		'childList',
		'attributes',
		'characterData',
		'subtree',
		'attributeOldValue',
		'characterDataOldValue',
		'attributeFilter'
	].reduce(function(acc, name) {
		acc[name.toLowerCase()] = name;

		return acc;
	}, {});
	var ALL = Object.keys(OBSERVER_OPTIONS).reduce(function(acc, name) {
		if(name !== 'attributefilter') {
			acc[OBSERVER_OPTIONS[name]] = true;
		}

		return acc;
	}, {});

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
		var type = record.type;

		if(!this.options[type]) {
			return false;
		}

		if(this.selector) {
			var nodes = [];
			var concat = function(nodeList) {
				nodes = nodes.concat(Array.prototype.slice.call(nodeList));
			};

			if(type === 'attributes' || type === 'characterData') {
				nodes.push(record.target);
			}
			if(record.addedNodes && record.addedNodes.length) {
				concat(record.addedNodes);
			} 
			if(record.removedNodes && record.removedNodes.length) {
				var cloned = this.target.clone(false, false);
				var targetPath = $(record.target).path(this.target);
				var targetCloned = cloned.find(targetPath);

				for(var i = 0; i < record.removedNodes.length; i++) {
					var node = $(record.removedNodes[i]).clone(false, false);

					if(node instanceof Text) {


						continue;
					}
					else if(record.previousSibling) {
						var previousSiblingCloned;

						if(record.previousSibling instanceof Text) {
							var contents = $(record.target).contents();
							var j;

							for(j = 0; j < contents.length; j++) {
								if(contents[j] === record.previousSibling) {
									break;
								}
							}

							previousSiblingCloned = $(targetCloned.contents()[j]);
						} else {
							var previousSiblingPath = $(record.previousSibling).path(record.target);
							previousSiblingCloned = targetCloned.find(previousSiblingPath);
						}

						previousSiblingCloned.after(node);
					} else if(record.nextSibling) {
						var nextSiblingCloned;

						if(record.nextSibling instanceof Text) {
							var contents = $(record.target).contents();
							var j;

							for(j = contents.length - 1; j >= 0; j--) {
								if(contents[j] === record.nextSibling) {
									break;
								}
							}

							nextSiblingCloned = $(targetCloned.contents()[j]);
						} else {
							var nextSiblingPath = $(record.nextSibling).path(record.target);
							nextSiblingCloned = targetCloned.find(nextSiblingPath);
						}

						nextSiblingCloned.before(node);
					} else {
						targetCloned.append(node);
					}
				}

				/*if(!cloned.find(this.selector).closest(targetCloned).length) {
					return false;
				}*/
			}

			nodes = nodes.map(function(node) {
				if(node instanceof Text) {
					return $(node).parent();
				}

				return node;
			});

			console.log('match.nodes', nodes);

			if(!nodes.some(function(node) {
				return self.target.find(self.selector).index(node) >= 0;
			})) {
				return false;
			}
		}

		if(this.attributeFilter && type === 'attributes') {
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

						console.log('observe.pattern', pattern, record);
						
						if(pattern.match(record)) {
							pattern.handler(record);
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

		console.log('_collapseOptions', result);

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

			console.log('$.fn.observe', options, selector, typeof handler);

			observer.observe(options, selector, handler);
		});
	};
}(jQuery));
