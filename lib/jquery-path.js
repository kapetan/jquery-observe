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
