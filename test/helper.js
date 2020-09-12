(function() {
	var helper = {};

	// Used in IE debugging
	helper.ppObject = function(obj) {
		var result = '\n{\n';

		for(var name in obj) {
			result += '\t' + name + ': ' + obj[name] + '\n'
		}

		console.log(result + '}');
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
