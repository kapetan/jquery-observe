(function($) {
	var init = $.fn.init;
	
	var ProxyJQuery = $.sub();

	['find', 'has', 'not', 'filter', 'is', 'closest', 'index', 'add', 'addBack'].forEach(function(name) {
		var fn = ProxyJQuery.fn[name];

		ProxyJQuery.fn[name] = function() {
			var args = [];
			var root = this.root();
			var originalRoot = root.data('branch');

			for(var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];

				if(arg && (arg.nodeType || arg instanceof jQuery)) {
					var elements = $(arg);
					var mapped = [];

					for(var i = 0; i < elements.length; i++) {
						var e = $(elements[i]);
						var path = e.capturePath(originalRoot);

						mapped = mapped.concat(path(root).get());
					}

					arg = $(mapped);
				}

				args.push(arg);
			}

			return ProxyJQuery(fn.apply(this, args).get());
		};
	});

	//var ProxyJQuery = function(elem) {
		//return $(elem);
	//	this.add(elem);
	//};
	//ProxyJQuery.prototype = new $();
	//ProxyJQuery.prototype.constructor = $;
	//ProxyJQuery.prototype = $.fn;

	window.ProxyJQuery = ProxyJQuery;

	/*$.fn.init = function(selector, context, rootjQuery) {
		if((selector.nodeType || selector instanceof jQuery) && context) {
			var root = $(context).root();
			var branch = true;

			for(var i = 0; i < root.length; i++) {
				branch = branch && $(root[i]).data('branch');
			}

			if(branch) {
				
			}
		}

		return new init(selector, context, rootjQuery);
	};*/

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

	$.fn.branch = function() {
		/*return this.map(function() {
			var cloned = $(this).clone(false, false);

			cloned.data('branch', this);

			return ProxyJQuery(cloned.get());
		}).get();*/

		return ProxyJQuery(this.clone(false, false).data('branch', this).get());
	};
}(jQuery));
