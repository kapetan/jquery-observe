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
					
					if(root.is(elements) || root.find(elements).length) {
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

			var result = fn.apply(this, args);

			if(result instanceof jQuery) {
				return ProxyJQuery(result.get());
			}

			return result;
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
