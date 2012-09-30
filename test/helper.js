(function() {
	var helper = function(elem) {
		helperProxy._elem = elem;
		return helperProxy;
	}; 
	helper.remove = function(elem, fn) {
		this._run(function() { $(elem).remove() }, fn);
	};
	helper.add = function(elem, html, fn) {
		this._run(function() { $(elem).append(html) }, fn);
	};
	helper.content = function(elem, html, fn) {
		this._run(function() { $(elem).text(html) }, fn);
	};
	helper.text = function(elem, text, fn) {
		this._run(function() {
			elem = $(elem).get(0);

			if(elem instanceof Text) {
				elem.nodeValue = text;
				return;
			} 

			elem = $(elem);
			var contents = elem.contents();
			var candidate;

			for(var i = 0; i < contents.length; i++) {
				var node = contents[i];

				if(node instanceof Text) {
					candidate = node;

					if(node.nodeValue.trim()) {
						node.nodeValue = text;
						return;	
					}
				}
			}

			if(candidate) {
				candidate.nodeValue = text;
			}
		}, fn);
	};
	helper.attr = function(elem, name, value, fn) {
		this._run(function() { $(elem).attr(name, value) }, fn);
	};
	// Used in IE debugging
	helper.ppObject = function(obj) {
		var result = '\n{\n';

		for(var name in obj) {
			result += '\t' + name + ': ' + obj[name] + '\n'
		}

		console.log(result + '}');
	};
	helper.loadJs = function(src, callback) {
		if(!Array.isArray(src)) {
			src = [src];
		}

		var self = this;
		var ready = src.length;
		var error;


		src.forEach(function(path) {
			self._loadJs(path, function(err) {
				error = error || err;

				if(!--ready) {
					setTimeout(function() {
						(callback || function() {})(error);
					}, 10);
				}
			});
		});
	};
	helper._loadJs = function(src, callback) {
		var script = document.createElement('script');
		var done;

		var finish = function(err) {
			if(done) {
				return;
			}

			done = true;
			script.onreadystatechange = script.error = script.onload = null;

			callback(err);
		};

		script.onreadystatechange = script.onload = function() {
			var state = script.readyState;

			if(!state || state in { loaded: 1, complete: 1, uninitialized: 1 }) {
				finish();
			}
		};
		script.onerror = function() {
			finish(new Error('Script load failed'));
		};

		setTimeout(function() {
			finish(new Error('Request timed out'));
		}, 5000);

		script.async = true;
		script.type = 'text/javascript';
		script.src = src;

		var first = document.getElementsByTagName('script')[0];

		first.parentNode.insertBefore(script, first);
	};
	helper._run = function(fn, callback) {
		setTimeout(function() { fn(); (callback || function() {})(); }, 10);
	};

	var helperProxy = {};

	['remove', 'add', 'text', 'content', 'attr'].forEach(function(name) {
		helperProxy[name] = function() {
			var args = Array.prototype.slice.call(arguments);

			args.splice(0, 0, this._elem);
			helper[name].apply(helper, args);
		};
	});

	window.helper = helper;
}());
