(function() {
	var $fixture;

	QUnit.testStart(function() {
		$fixture = $('#qunit-fixture');
	});
	QUnit.testDone(function() {
		$('#container').remove();
	});

	module('Observe this');

	test('Attribute changed', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');

		$ul.observe('attributes', function(record) {
			equal(this, $ul[0]);
			equal(record.target, $ul[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-attr');

			start();
		});

		helper.$($ul).attr('data-attr', 'value');
	});
	test('Double match (all, restrictive) on attribute changed', function() {
		stop(2);
		expect(6);

		var $ul = $fixture.find('ul');
		var fn = function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-attr');

			start();
		};

		$ul
			.observe('attributes', fn)
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, fn);

		helper.$($ul).attr('data-attr', 'value');
	});
	test('Double match (restrictive, all) on attribute changed', function() {
		stop(2);
		expect(6);

		var $ul = $fixture.find('ul');
		var fn = function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-attr');

			start();
		};

		$ul
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, fn)
			.observe('attributes', fn);

		helper.$($ul).attr('data-attr', 'value');
	});
	test('Single match (all, restrictive) on attribute changed', function() {
		stop();
		expect(3);

		var $ul = $fixture.find('ul');
		var fn = function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-other');

			start();
		};

		$ul
			.observe('attributes', fn)
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, fn);

		helper.$($ul).attr('data-other', 'value');
	});
	test('Single match (restrictive, all) on attribute changed', function() {
		stop();
		expect(3);

		var $ul = $fixture.find('ul');
		var fn = function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-other');

			start();
		};

		$ul
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, fn)
			.observe('attributes', fn);

		helper.$($ul).attr('data-other', 'value');
	});
	test('Node added', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var li = document.createElement('li');

		$ul.observe('childlist', function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], li);

			start();
		});

		helper.$($ul).append(li);
	});
	test('Node removed', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');

		$ul.observe('childlist', function(record) {
			equal(this, record.target);
			equal(record.type, 'childList');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0], $li[0]);

			start();
		});

		helper.$($li).remove();
	});
	test('Content swapped', function() {
		stop();
		expect(6);

		var $header = $('#header');

		$header.observe('childlist subtree', function(record) {
			equal(this, $header[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0].data, 'value');
			equal(record.removedNodes.length, 1);
			ok(record.removedNodes[0].data, 'Header');

			start();
		});

		helper.$($header).content('value');
	});
	test('Character data changed', function() {
		stop();
		expect(4);

		var $header = $('#header');
		var text = $header[0].childNodes[0];

		$header.observe('characterdata subtree', function(record) {
			equal(this, $header[0]);
			equal(record.target, text);
			equal(record.type, 'characterData');
			equal(record.target, text);

			start();
		});

		text.nodeValue = 'value';
	});
	test('Subtree option', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $span = $ul.find('span');

		$ul.observe('childlist subtree', function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'childList');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0], $span[0]);

			start();
		});

		helper.$($span).remove();
	});
	test('Add text node', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var text = document.createTextNode('item');

		$ul.observe('childlist', function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], text);

			start();
		});

		helper.$($ul).append(text);
	});
	test('Add text node and element node', function() {
		stop();
		expect(8);

		var $ul = $fixture.find('ul');
		var nodes = [document.createTextNode('item'), document.createElement('li')];
		var i = 0;

		$ul.observe('childlist', function(record) {
			equal(this, $ul[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], nodes[i]);

			i++;
			start();
		});

		helper.$($ul).append(nodes[0]);
		helper.$($ul).append(nodes[1]);
	});

	module('Observe child');

	test('Child attibute changed', function() {
		stop();
		expect(3);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');

		$ul.observe('attributes', 'li:first', function(record) {
			equal(this, $li[0]);
			equal(record.type, 'attributes');
			equal(record.attributeName, 'data-attr');

			start();
		});

		helper.$($li).attr('data-attr', 'value');
	});
	test('Child node added', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var span = document.createElement('span');

		$ul.observe('childlist', 'li:first span', function(record) {
			equal(this, span);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], span);

			start();
		});

		helper.$($li).append(span);
	});
	test('Child node removed', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:last');
		var $span = $li.find('span');

		$ul.observe('childlist', 'li:last span', function(record) {
			equal(this, $li[0]);
			equal(record.type, 'childList');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0], $span[0]);

			start();
		});

		helper.$($span).remove();
	});
	test('Removed child node with no siblings', function() {
		stop();
		expect(4);

		var $span = $('#menu');
		var $a = $span.find('a');

		$span.observe('childlist', 'a', function(record) {
			equal(this, $span[0]);
			equal(record.type, 'childList');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0], $a[0]);

			start();
		});

		helper.$($a).remove();
	});
	test('Swapped content of child node', function() {
		stop();
		expect(6);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');

		$ul.observe('childlist', 'li', function(record) {
			equal(this, $li[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0].data, 'value');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0].data, 'Item 1');

			start();
		});

		helper.$($li).content('value');
	});
	test('Character data changed on child element', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var text = $li[0].childNodes[0];

		$ul.observe('characterData', 'li', function(record) {
			equal(this, $li[0]);
			equal(record.target, text);
			equal(record.type, 'characterData');
			equal(record.target, text);

			start();
		});

		text.nodeValue = 'value';
	});
	test('Add text node', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var text = document.createTextNode('item');

		$ul.observe('childlist', 'li', function(record) {
			equal(this, $li[0]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], text);

			start();
		});

		helper.$($li).append(text);
	});
	test('Add text node and element node', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');
		var text = document.createTextNode('item');
		var li = document.createElement('li');

		$ul.observe('childlist', 'li', function(record) {
			equal(this, li);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], li);

			start();
		});

		helper.$($ul).append(text); // Should not be called when appending text
		helper.$($ul).append(li);
	});
	test('Multiple element match on node added', function() {
		stop(2);
		expect(8);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var em = [document.createElement('em'), document.createElement('em')];
		var i = 0;

		$ul.observe('childlist', 'li em', function(record) {
			equal(this, em[i]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], em[i]);

			i++;
			start();
		});

		helper.$($li).append(em[0]);

		setTimeout(function() {
			helper.$($li).append(em[1]);
		}, 100);
	});
	test('Multiple element match on multiple insert', function() {
		stop(2);
		expect(8);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var em = [document.createElement('em'), document.createElement('em')];
		var i = 0;

		$ul.observe('childlist', 'li em', function(record) {
			equal(this, em[i]);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], em[i]);

			i++;
			start();
		});

		helper.$($li).append(em[0]);
		helper.$($li).append(em[1]);
	});

	module('Multiple observers');

	test('Child node added and attribute changed', function() {
		stop(2);
		expect(7);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var span = document.createElement('span');

		$ul
			.observe('childlist', 'li:first span', function(record) {
				equal(this, span);
				equal(record.type, 'childList');
				equal(record.addedNodes.length, 1);
				equal(record.addedNodes[0], span);

				start();
			})
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, 'li:first', function(record) {
				equal(this, $li[0]);
				equal(record.type, 'attributes');
				equal(record.attributeName, 'data-attr');

				start();
			});

		helper.$($li).append(span);
		helper.$($li).attr('data-attr', 'value');
	});
	test('Child node added and removed', function() {
		stop(2);
		expect(8);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');
		var span = document.createElement('span');
		var adding = true;

		$ul.observe('childlist', 'li:first span', function(record) {
			equal(record.type, 'childList');

			if(adding) {
				equal(this, span);
				equal(record.addedNodes.length, 1);
				equal(record.addedNodes[0], span);
			} else {
				equal(this, $li[0]);
				equal(record.removedNodes.length, 1);
				equal(record.removedNodes[0], span);
			}

			adding = false;
			start();
		});

		helper.$($li).append(span);

		setTimeout(function() {
			helper.$(span).remove();
		}, 100);
	});
	test('Nodes added and attribute changed', function() {
		stop(3);
		expect(10);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:last');
		var span = document.createElement('span');

		$ul
			.observe('attributes', function(record) {
				equal(this, $ul[0]);
				equal(record.type, 'attributes');
				equal(record.attributeName, 'data-other');

				start();
			})
			.observe('childlist', 'li:first span', function(record) {
				equal(this, span);
				equal(record.type, 'childList');
				equal(record.addedNodes.length, 1);
				equal(record.addedNodes[0], span);

				start();
			})
			.observe({ attributes: true, attributeFilter: ['data-attr'] }, 'li:last', function(record) {
				equal(this, $li[0]);
				equal(record.type, 'attributes');
				equal(record.attributeName, 'data-attr');

				start();
			});

		helper.$($ul).attr('data-other', 'value');
		helper.$('li:first', $ul).append(span);
		helper.$($li).attr('data-attr', 'value');
	});
	test('Multiple matches on add node', function() {
		stop(2);
		expect(8);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:first');

		var span = document.createElement('span');
		var a = document.createElement('a');
		span.appendChild(a);

		$ul
			.observe('childlist', 'li:first span', function(record) {
				equal(this, span);
				equal(record.type, 'childList');
				equal(record.addedNodes.length, 1);
				equal(record.addedNodes[0], span);

				start();
			})
			.observe('childlist', 'li:first span a', function(record) {
				equal(this, a);
				equal(record.type, 'childList');
				equal(record.addedNodes.length, 1);
				equal(record.addedNodes[0], span);

				start();
			});

		helper.$($li).append(span);
	});
	test('Multiple matches on remove node', function() {
		stop(2);
		expect(8);

		var $ul = $fixture.find('ul');
		var $li = $ul.find('li:last');

		$ul
			.observe('childlist', 'li', function(record) {
				equal(this, $ul[0]);
				equal(record.type, 'childList');
				equal(record.removedNodes.length, 1);
				equal(record.removedNodes[0], $li[0]);

				start();
			})
			.observe('childlist', 'li span', function(record) {
				equal(this, $ul[0]);
				equal(record.type, 'childList');
				equal(record.removedNodes.length, 1);
				equal(record.removedNodes[0], $li[0]);

				start();
			});

		helper.$($li).remove();
	});
	test('Match on deep insert', function() {
		stop();
		expect(4);

		var $ul = $fixture.find('ul');

		var div = document.createElement('div');
		var em = document.createElement('em');
		div.appendChild(em);

		$ul.observe('childlist', 'li span div em', function(record) {
			equal(this, em);
			equal(record.type, 'childList');
			equal(record.addedNodes.length, 1);
			equal(record.addedNodes[0], div);

			start();
		});

		helper.$('li:last span', $ul).append(div);
	});
	test('Match on deep removale', function() {
		stop();
		expect(4);

		var $container = $('#container');
		var $ul = $container.find('ul');

		$container.observe('childlist', 'div ul li .last-li', function(record) {
			equal(this, $('#content')[0]);
			equal(record.type, 'childList');
			equal(record.removedNodes.length, 1);
			equal(record.removedNodes[0], $ul[0]);

			start();
		});

		helper.$($ul).remove();
	});
}());
