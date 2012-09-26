# jQuery Observe

A jQuery plugin which simplifies the use of the new [DOM Mutation Observer][w3_mo] interface introduced in newer browsers.

# Compatibility

At this point the Mutations Observer API is only available in newer versions of Google Chrome and Mozillza Firefox.

# Usage

The observe interface `$.fn.observe()` is somewhat similar to the jQuery event api using the `$.fn.on()` method.

```javascript
$('#content')
	.observe('attributes', function(record) {
		// Observe attribute changes on #content
	})
	.observe('childlist subtree', function(record) {
		// Observe changes in the subtree
	})
	.observe({ attributes: true, attributeFilter: ['class'] }, function(record) {
		// Observe changes in attribute class on #content
	});
```
The callback function gets passed the [MutationRecord][w3_mr] instance matching the query.

The first argument can either be a string or an object containing the options which are passed to `MutaionObserver.observe()` method. See the [w3 documentation][w3_mo] for Mutation Observer for more information on the available options.

All the above observers are collapsed into a single Mutation Observer object using #content as target.

The real power comes when using a selector to filter the elements.

```javascript
$('#content')
	.observe('childlist', 'ul li:first', function(record) {
		// Observe if elements matching '#content ul li:first' have been added or removed
	})
	.observe('attributes', '.section p:visible', function(record) {
		// Observe if elements matching '#content .section p:visible' have been added or removed
	})
```

In the above callback functions `this` referes to the matched DOM element. This also means that the callback is called for every matched element (similar to `$.fn.on()` method).

Using the above defined observers with the following HTML:

```html
	<div id='content'>
		<ul>
			<li><span></span></li>
		</ul>
		<span class='section'><p class='hello'>Hello</p></span>
	</div>
```

*	Running `$('#content ul').append('<li></li>') // added as last element` will **not** trigger the first observer neither will `$('#content ul li:first').append('<span></span>')`, since the observe selector only matches nodes that either have been added or removed.

*	Running `$('#content ul').prepend('<li></li>')` will trigger the first observer, since a *li* element was inserted as the first child. And `this` will reference to the newly inserted node.

*	Running `$('#content ul li:first').remove()` also triggers the first observer. In this case `this` will reference to the parent of the removed element (the *ul* element).

*	Running `$('#content ul li:first span').remove()` will **not** trigger the first observer.

* 	Running `$('#content span p').addClass('myClass')` triggers the second observer.

Note that the changes to the DOM don't have to be performed using jQuery. The last example can also be run using plain javascript `document.getElementsByClassName('hello')[0].className += ' myClass'`.

### Extended options

There are two custom Mutation Observer options which can be used together with the other options. These are *added* and *removed*. Which only trigger an observer if either a node has been added or removed.

```javascript
	$('#content')
		.observe('added', 'li:first', function(record) {
			// Only called if a node matching '#content li:first' has been added
		})
		.observe('removed', 'li:first', function(record) {
			// Only called if a node matching '#content li:first' has been removed
		});
```

Using the options `'added removed'` is equivalent to `'childlist'`.

### Removing observers

Use the `$.fn.disconnect()` method to remove an observer. The arguments must match the arguments given to the `$.fn.observe()` method. Or call the disconnect method without arguments to remove all observers. The underlying Mutation Observer is disabled when there are no observers listening for changes.

# Issues

There are some problems getting the characterData option to work in Chrome (may be because of bug [#134322][chrome_bug]).

[w3_mo]: http://dvcs.w3.org/hg/domcore/raw-file/tip/Overview.html#mutation-observers "Mutation Observer"
[w3_mr]: http://dvcs.w3.org/hg/domcore/raw-file/tip/Overview.html#mutationrecord "Mutaion Record"
[chrome_bug]: http://code.google.com/p/chromium/issues/detail?id=134322 "Chrome bug #134322"
