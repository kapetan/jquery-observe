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
