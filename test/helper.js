(function() {
	var loadJs = function(src, callback) {
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

	var helper = {};

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
			loadJs(path, function(err) {
				error = error || err;

				if(!--ready) {
					setTimeout(function() {
						(callback || function() {})(error);
					}, 10);
				}
			});
		});
	};

	helper.$ = function(selector, context) {
		var elem = $(selector, context).get(0);
		var that = {};

		that.attr = function(name, value) {
			elem.setAttribute(name, value);
		};
		that.append = function(html) {
			elem.appendChild(html);
		};
		that.remove = function() {
			if(elem.parentNode) elem.parentNode.removeChild(elem);
		};
		that.content = function(text) {
			elem.textContent = text;
		};

		return that;
	};

	window.helper = helper;
}());
