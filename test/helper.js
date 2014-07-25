(function() {
	var loadJs = function(src, callback) {
		var xhr = new XMLHttpRequest();
		var called = false;
		var finish = function(err, result) {
			if(called) return;

			called = true;
			callback(err, result);
		};

		xhr.onload = function() {
			finish(null, xhr.responseText);
		};

		xhr.onerror = function() {
			finish(new Error('Script load failed'));
		};

		setTimeout(function() {
			finish(new Error('Request timed out'));
		}, 5000);

		xhr.open('GET', src, true);
		xhr.send(null);
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

		var ready = src.length;
		var result = [];
		var error;

		src.forEach(function(path, i) {
			loadJs(path, function(err, source) {
				if(error) return;
				if(err) {
					error = true;
					return callback(err);
				}

				result[i] = source;

				if(!--ready) {
					result.forEach(function(source) {
						eval(source);
					});

					setTimeout(function() {
						if(callback) callback();
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
