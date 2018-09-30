/**
 * Inspire.js
 * https://inspirejs.org
 * MIT Licensed
 * Copyright (C) 2010-2018 Lea Verou, http://lea.verou.me
 */

(async function(body, html){

// Cache <title> element, we may need it for slides that don"t have titles
var documentTitle = document.title + "";

// Cache current <script> src, we will need it for loading plugins
var scriptSrc = document.currentScript ? document.currentScript.src : undefined;

if (!window.Bliss) {
	// Load Bliss if not loaded
	console.log("Bliss not loaded. Loading remotely from blissfuljs.com");

	let bliss = document.createElement("script");
	bliss.src = "https://blissfuljs.com/bliss.shy.min.js";
	document.head.appendChild(bliss);

	await new Promise(resolve => bliss.onload = resolve);
}

var $ = Bliss, $$ = $.$;

var _ = class Inspire {
	constructor() {
		var me = this;

		// Current slide
		this.index = 0;

		// Current .delayed item in the slide
		this.item = 0;

		_.hooks.run("init-start");

		// Create slide indicator
		this.indicator = $.create({
			id: "indicator",
			inside: body
		});

		// Add on screen navigation
		var onscreen = $.create("nav", {
			id: "onscreen-nav",
			className: "hidden",
			inside: body,
			contents: [
				{
					tag: "button",
					className: "onscreen-nav prev",
					textContent: "◂",
					type: "button",
					events: {
						click: evt => me.previous()
					}
				},
				{
					tag: "button",
					className: "onscreen-nav next",
					textContent: "Next ▸",
					type: "button",
					events: {
						click: evt => me.next()
					}
				}
			]
		});

		// Get the slide elements into an array
		this.slides = $$(".slide", body);
		this.indicator.style.setProperty("--total", this.slides.length);

		// Order of the slides
		this.order = [];

		for (var i=0; i<this.slides.length; i++) {
			var slide = this.slides[i]; // to speed up references

			// Asign ids to slides that don"t have one
			if (!slide.id) {
				slide.id = "slide" + (i+1);
			}

		// Set data-title attribute to the title of the slide
		var title = slide.title || slide.getAttribute("data-title");

		if (title) {
			slide.removeAttribute("title");
		}
		else {
			// no title attribute, fetch title from heading(s)
			var heading = $("h1, h2, h3, h4, h5, h6", slide);

			if (heading && heading.textContent.trim()) {
				title = heading.textContent;
			}
		}

		if (title) {
			slide.setAttribute("data-title", title);
		}

		slide.setAttribute("data-index", i);
			var imp = slide.getAttribute("data-import"),
				imported = imp? this.getSlideById(imp) : null;

			this.order.push(imported? +imported.getAttribute("data-index") : i);

			// [data-steps] can be used to define steps (applied through the data-step
			// property), used in CSS to go through multiple states for an element
			var stepped = $$("[data-steps]", slide);

			if (slide.hasAttribute("data-steps")) {
				stepped.push(slide);
			}

			stepped.forEach(function(element) {
				var steps = +element.getAttribute("data-steps");
				element.removeAttribute("data-step");

				for (var i=0; i<steps; i++) {
					var dummy = document.createElement("span");
					dummy.style.display = "none";
					dummy.className = "delayed dummy";
					dummy.dummyFor = element;
					dummy.dummyIndex = i+1;

					if (element === slide) {
						slide.appendChild(dummy);
					}
					else {
						element.parentNode.insertBefore(dummy, element);
					}
				}
			});
		}

		$.bind(window, {
			// Adjust the font-size when the window is resized
			"load resize": evt => this.adjustFontSize(),
			/**
				Keyboard navigation
				Ctrl+G : Go to slide...
				(Shift instead of Ctrl works too)
			*/
			"keyup": evt => {
				if ((evt.ctrlKey || evt.shiftKey) && !evt.altKey && !/^(?:input|textarea)$/i.test(document.activeElement.nodeName)) {
					var letter = evt.key.toUpperCase();

					if (letter === "G") {
						var slide = prompt("Which slide?");
						me.goto(+slide? slide - 1 : slide);
					}
					else {
						_.hooks.run("keyup", {evt, letter, context: this});
					}
				}
			},
			/**
				Keyboard navigation
				Home : First slide
				End : Last slide
				Space/Up/Right arrow : Next item/slide
				Ctrl + Space/Up/Right arrow : Next slide
				Down/Left arrow : Previous item/slide
				Ctrl + Down/Left arrow : Previous slide
				(Shift instead of Ctrl works too)
			*/
			"keydown": evt => {
				if (evt.target === body || evt.target === body.parentNode || evt.altKey) {
					if (evt.keyCode >= 32 && evt.keyCode <= 40) {
						evt.preventDefault();
					}

					switch (evt.key) {
						case "PageUp":
							this.previous();
							break;
						case "PageDown":
							this.next();
							break;
						case "End":
							this.end();
							break;
						case "Home":
							this.start();
							break;
						case "ArrowLeft": // <-
						case "ArrowUp":
							this.previous(evt.ctrlKey || evt.shiftKey);
							break;
						case " ": // space
						case "ArrowRight": // ->
						case "ArrowDown":
							this.next(evt.ctrlKey || evt.shiftKey);
							break;
					}
				}
			}
		});

		addEventListener("hashchange", this);

		_.hooks.run("init-before-first-goto", this);

		// If there"s already a hash, update current slide number
		this.goto(location.hash.substr(1) || 0);

		_.hooks.run("init-end", this);
	}

	handleEvent(evt) {
		this.goto(location.hash.substr(1) || 0);
	}

	start() {
		this.goto(0);
	}

	end() {
		this.goto(this.slides.length - 1);
	}

	/**
		@param hard {Boolean} Whether to advance to the next slide (true) or
			just the next step (which could very well be showing a list item)
	 */
	next(hard) {
		if (!hard && this.items.length) {
			this.nextItem();
		}
		else {
			this.goto(this.index + 1);

			this.item = 0;

			// Mark all items as not displayed, if there are any
			for (var i=0; i<this.items.length; i++) {
				var classes = this.items[i].classList;
				if (classes) {
					classes.remove("displayed");
					classes.remove("current");
				}
			}
		}
	}

	nextItem() {
		if (this.item < this.items.length) {
			this.gotoItem(++this.item);
		}
		else {
			this.item = 0;
			this.next(true);
		}
	}

	previous(hard) {
		if (!hard && this.item > 0) {
			this.previousItem();
		}
		else {
			this.goto(this.index - 1);

			this.item = this.items.length;

			// Mark all items as displayed, if there are any
			if (this.items.length) {
				for (var i=0; i<this.items.length; i++) {
					if (this.items[i].classList) {
						this.items[i].classList.add("displayed");
					}
				}

				// Mark the last one as current
				var lastItem = this.items[this.items.length - 1];

				lastItem.classList.remove("displayed");
				lastItem.classList.add("current");
			}
		}
	}

	previousItem() {
		this.gotoItem(--this.item);
	}

	getSlideById(id) {
		return $(".slide#" + id);
	}

	/**
		Go to an aribtary slide
		@param which {String|Integer} Which slide (identifier or slide number)
	*/
	goto(which) {
		var slide;
		var prev = this.slide;

		// We have to remove it to prevent multiple calls to goto messing up
		// our current item (and there"s no point either, so we save on performance)
		window.removeEventListener("hashchange", this);

		var id;

		if (which + "" === which) { // Argument is a slide id
			slide = this.getSlideById(which);

			if (slide) {
				this.slide = this.index = +slide.getAttribute("data-index");

				location.hash = ""; // See https://twitter.com/LeaVerou/status/1046114577648422912
				location.hash = which;
			}
			else if (/^slide(\d+)$/.test(which)) { // No slide found with that id. Perhaps it's in the slideN format?
				which = which.slice(5) - 1;
			}
			else {
				// No slide found
			}
		}

		if (which + 0 === which && which in this.slides) {
			// Argument is a valid slide number
			this.index = which;
			this.slide = this.order[which];

			slide = this.currentSlide;

			location.hash = "#" + slide.id;
		}

		if (prev !== this.slide) { // Slide actually changed, perform any other tasks needed
			document.title = slide.getAttribute("data-title") || documentTitle;

			var env = {slide, prevSlide: this.slides[prev], which, context: this};
			_.hooks.run("slidechange", env);

			this.adjustFontSize();

			$("#onscreen-nav").classList.toggle("hidden", !slide.matches(".onscreen-nav"));

			this.indicator.textContent = this.index + 1;

			// Update items collection
			this.items = $$(".delayed, .delayed-children > *", this.currentSlide);
			_.stableSort(this.items, function(a, b) {
				return (a.getAttribute("data-index") || 0) - (b.getAttribute("data-index") || 0);
			});
			this.item = 0;

			// Update next/previous
			var previousPrevious = this.slides.previous;
			var previousNext = this.slides.next;

			this.slides.previous = this.slides[this.order[this.index - 1]];
			this.slides.next = this.slides[this.order[this.index + 1]];

			this.slides.previous && this.slides.previous.classList.add("previous");
			this.slides.next && this.slides.next.classList.add("next");

			if (previousPrevious && previousPrevious != this.slides.previous) {
				previousPrevious.classList.remove("previous");
			}

			if (previousNext && previousNext != this.slides.next) {
				previousNext.classList.remove("next");
			}

			requestAnimationFrame(() => {
				slide.dispatchEvent(new CustomEvent("slidechange", {
					"bubbles": true
				}));
				_.hooks.run("slidechange-async", env);
			});
		}

		// If you attach the listener immediately again then it will catch the event
		// We have to do it asynchronously
		requestAnimationFrame(() => addEventListener("hashchange", this));
	}

	gotoItem(which) {
		this.item = which;

		var items = this.items, classes;

		for (var i=items.length; i-- > 0;) {
			classes = this.items[i].classList;

			classes.remove("current");
			classes.remove("displayed");

			if (classes.contains("dummy") && items[i].dummyFor) {
				items[i].dummyFor.removeAttribute("data-step");
			}
		}

		for (var i=this.item - 1; i-- > 0;) {
			items[i].classList.add("displayed");
		}

		if (this.item > 0) { // this.item can be zero, at which point no items are current
			var item = items[this.item - 1];

			item.classList.add("current");

			// support for nested lists
			for (var i = this.item - 1, cur = items[i], j; i > 0; i--) {
			  j = items[i - 1];
			  if (j.contains(cur)) {
				j.classList.remove("displayed");
				j.classList.add("current");
			  }
			}

			if (item.classList.contains("dummy") && item.dummyFor) {
				item.dummyFor.setAttribute("data-step", item.dummyIndex);
			}
		}

		_.hooks.run("gotoitem-end", {which, context: this});
	}

	adjustFontSize() {
		// Cache long lookup chains, for performance
		var scrollRoot = html.scrollHeight? html : body;
		var slide = this.currentSlide;

		// Clear previous styles
		html.style.fontSize = "";

		if (body.matches(".show-thumbnails") || slide.matches(".dont-resize")) {
			return;
		}

		for (
			var percent = 100;
			(scrollRoot.scrollHeight > innerHeight || scrollRoot.scrollWidth > innerWidth) && percent >= 35;
			percent-=5
		) {
			html.style.fontSize = percent + "%";
		}

		// Individual slide

		if (slide.clientHeight && slide.clientWidth) {
			// Strange FF bug: scrollHeight doesn"t work properly with overflow:hidden
			var previousStyle = slide.getAttribute("style");
			slide.style.overflow = "auto";

			for (
				;
				(slide.scrollHeight > slide.clientHeight || slide.scrollWidth > slide.clientWidth) && percent >= 35;
				percent--
			) {
				html.style.fontSize = percent + "%";
			}

			slide.setAttribute("style", previousStyle);
		}

		if (percent <= 35) {
			// Something probably went wrong, so just give up altogether
			html.style.fontSize = "";
		}
	}

	// Get current slide as an element
	get currentSlide() {
		return this.slides[this.slide];
	}

	static getSlide(element) {
		return element.closest(".slide");
	}

	// http://ichuan.net/post/52/stable-sort-of-javascript-array/
	static stableSort(arr, fn) {
		if (!fn) {
			return arr.sort();
		}

		var newArr = arr.map((i, j) => {
			return {i, j};
		});

		return newArr.sort((a, b) => {
			var result = fn(a.i, b.i);
			return result === 0? a.j - b.j : result;
		}).map(i => i.i);
	}

	static load(url, base = location.href) {
		url = new URL(url, base);

		if (/\.css$/.test(url.pathname)) {
			// CSS file
			return new Promise((resolve, reject) => {
				$.create("link", {
					"href": url,
					"rel": "stylesheet",
					"inside": document.head,
					"onload": resolve,
					"onerror": reject
				});
			});
		}

		// JS file
		return $.include(url);
	}

	static loadPlugin(id) {
		_.load(`plugins/${id}/plugin.css`, scriptSrc).catch(e => e);
		return _.load(`plugins/${id}/plugin.js`, scriptSrc).then(() => _.pluginsLoaded.push(id));
	}

	static init() {
		var dependencies = [];

		for (let id in _.plugins) {
			if ($(_.plugins[id])) {
				dependencies.push(_.loadPlugin(id));
			}
		}

		Promise.all(dependencies).then(() => {
			console.log("Inspire.js plugins loaded:", _.pluginsLoaded.length? _.pluginsLoaded.join(", ") : "none");
			window.inspire = new _();
		});
	}
};

// Static properties
Object.assign(_, {
	// Plugin ids and selectors
	// If selector matches anything, plugin is loaded
	plugins: {
		timer: "[data-duration]",
		presenter: ".presenter-notes",
		slidescript: "slide-script",
		slidestyle: "style[data-slide]",
		overview: "body:not(.no-overview)",
		iframe: ".slide[data-src], .iframe.slide"
	},

	pluginsLoaded: [],

	hooks: new $.Hooks()
});

$.ready().then(_.init);

window.Inspire = _;

})(document.body, document.documentElement);