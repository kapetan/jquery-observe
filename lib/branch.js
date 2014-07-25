(function($, ns) {
	var Branch = function(root) {
		this.original = $(root);
		this.root = this.original.clone(false, true);
	};

	Branch.prototype.find = function(selector) {
		var path = ns.path.capture(this.original, selector);
		return path(this.root);
	};

	ns.Branch = Branch;
}(jQuery, jQuery.Observe));
