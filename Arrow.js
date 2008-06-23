/*
 * Arrow Core {{{
 */
function Arrow(f) {
    if (f instanceof Arrow)
        return f;
    if (!(this instanceof Arrow))
        return new Arrow(f);

    if (f) {
        this.cpsFunction = function(x, k) { return k(f(x)) };
        this.name = f.name || this.name;
    }
}

Arrow.named = function(name) {
    return function() {
        var arrow = Arrow.apply(this, arguments);
        arrow.name = name;
        return arrow;
    }
}

Arrow.fromCPS = function(cpsFunction) {
    var arrow = new Arrow;
    arrow.cpsFunction = cpsFunction;
    return arrow;
}

Arrow.fromCPS.named = function(name) {
    return function() {
        var arrow = Arrow.fromCPS.apply(this, arguments);
        arrow.name = name;
        return arrow;
    }
};

Arrow.constant = function(x) {
    return Arrow.named('const ' + x)(function() { return x });
}

Arrow.Identity = Arrow(function(x) { return x });

Arrow.prototype.name = 'unnamed';

Arrow.prototype.call = function(x) {
    var result;
    this.callCPS(x, function(y) { result = y });
    return result;
}

Arrow.prototype.callCPS = function(x, k) {
    try {
        this.cpsFunction(x, k);
    } catch (e) {
        k(Arrow.Error(e));
    }
}

Arrow.prototype.toString = function() {
    return '[Arrow' + (this.name ? ' ' + this.name : '') + ']';
}
/*
 * }}}
 */

/*
 * Basic Arrow Operators {{{
 * TODO: Give them proper names
 */
// Compose arrows
//
// x -> y -> z
//
//  +---+ +---+
// -| f |-| g |->
//  +---+ +---+
//
Arrow.prototype['>>>'] = function(g) {
    var f = this, g = Arrow(g);
    var arrow = Arrow.fromCPS.named('(' + f.name + ') >>> (' + g.name + ')')(function(x, k) {
        f.callCPS(x, function(y) { g.callCPS(y, k) });
    });
    arrow.f = f;
    arrow.g = g;
    var cancellers = [];
    arrow.cancel = function() {
        if (f.cancel)
            f.cancel();
        if (g.cancel)
            g.cancel();
    }
    return arrow;
}

Arrow.prototype.next = Arrow.prototype['>>>'];

// Fork arrow
//
// x -> [y1, y2, ..]
//
//    +---+
//  +-| f |->
//  | +---+
// -+
//  | +---+
//  +-| g |->
//    +---+
//
Arrow.prototype['&&&'] = function(g) {
    var f = this, g = Arrow(g);

    var arrow = Arrow.fromCPS(function(x, k) {
        var arrows = this.arrows;
        var results = [];
        var count = arrows.length;
        for (var i = 0; i < arrows.length; i++) {
            with ({ i: i }) {
                arrows[i].callCPS(x, function(y) { results[i] = y; if (!--count) k(results) });
            }
        }
    });

    arrow.type = '&&&';
    arrow.arrows = Array.concat(f.type == '&&&' ? f.arrows : f, g.type == '&&&' ? g.arrows : g);

    return arrow;
}

// Combine arrows
//
// [x1, x2, ..] -> [y1, y2, ..]
//
//  +---+
// -| f |->
//  +---+
//  +---+
// -| g |->
//  +---+
//
Arrow.prototype['***'] = function(g) {
    var f = this, g = Arrow(g);

    var arrow = Arrow.fromCPS(function(x, k) {
        var arrows = this.arrows;
        var results = [];
        var count = arrows.length;
        for (var i = 0; i < arrows.length; i++) {
            with ({ i: i }) {
                arrows[i].callCPS(x[i], function(y) { results[i] = y; if (!--count) k(results) });
            }
        }
    });

    arrow.type = '***';
    arrow.arrows = Array.concat(f.type == '***' ? f.arrows : f, g.type == '***' ? g.arrows : g);

    return arrow;
}

Arrow.prototype.and = Arrow.prototype['***'];

// Choose arrow
//
//      +---+
//     -| f |-.
//      +---+  \
// -+           +-> (choose route by input value, route information remains)
//   \  +---+  /
//    `-| g |-'
//      +---+
Arrow.prototype['|||'] = function(g) {
    var f = this, g = Arrow(g);

    var arrow = Arrow.fromCPS(function(x, k) {
        var arrows = this.arrows;
        if (!(x instanceof Arrow.ValueIn)) {
            x = Arrow.ValueIn(0)(x);
        }
        arrows[x.index].callCPS(x.value, function(y) { k(Arrow.ValueIn(x.index)(y)) });
    });

    arrow.type = '|||';
    arrow.arrows = Array.concat(f.type == '|||' ? f.arrows : f, g.type == '|||' ? g.arrows : g);

    return arrow;
}

//
// Join arrows
//
//      +---+
//     -| f |-.
//      +---+  \
// -+           +-> (choose route by input value, discard route information)
//   \  +---+  /
//    `-| g |-'
//      +---+
Arrow.prototype['+++'] = function(g) {
    var f = this, g = Arrow(g);

    var arrow = Arrow.fromCPS(function(x, k) {
        var arrows = this.arrows;
        if (!(x instanceof Arrow.ValueIn)) {
            x = Arrow.ValueIn(0)(x);
        }
        arrows[x.index].callCPS(x.value, k);
    });

    arrow.type = '+++';
    arrow.arrows = Array.concat(f.type == '+++' ? f.arrows : f, g.type == '+++' ? g.arrows : g);

    return arrow;
}

Arrow.prototype.withErrorNext = function(f, g) {
    return this.next((f)['+++'](g));
}

// Choose arrow
//
//      +---+
//    .-| f |-
//   /  +---+
// -+           +-> (faster arrow is chosen)
//   \  +---+  /
//    `-| g |-'
//      +---+
Arrow.prototype['<+>'] = function(g) {
    var f = this, g = Arrow(g);

    var arrow = Arrow.fromCPS(function(x, k) {
        var called;
        var arrows = this.arrows;
        for (var i = 0; i < arrows.length; i++) {
            with ({ i: i }) {
                arrows[i].callCPS(x, function(y) { cancelBut(i); callCont(y) });
            }
        }
        function callCont(y) {
            if (!called)
                k(y);
            called = true;
        }
        function cancelBut(index) {
            for (var i = 0; i < arrows.length; i++) {
                if (i == index) continue;
                arrows[i].cancel && arrows[i].cancel();
            }
        }
    });

    arrow.type = '<+>';
    arrow.arrows = Array.concat(f.type == '<+>' ? f.arrows : f, g.type == '<+>' ? g.arrows : g);

    return arrow;
}

Arrow.prototype.or = Arrow.prototype['<+>'];
/*
 * }}}
 */

/*
 * Arrow.ValueIn {{{
 */
Arrow.ValueIn = function(index, value) {
    if (!(this instanceof Arrow.ValueIn)) {
        var constructor = Arrow.ValueIn.constructors[index];
        if (!constructor) {
            constructor = Arrow.ValueIn.constructors[index] = function(value) {
                if (!(this instanceof constructor))
                    return new constructor(value);
                this.index = index;
                this.value = value;
            };
            constructor.prototype = new Arrow.ValueIn;
        }
        if (arguments.length == 1) {
            return constructor;
        } else {
            return new constructor(value);
        }
    }
    this.index = index;
    this.value = value;
}

Arrow.ValueIn.constructors = [];

Arrow.ValueIn.prototype = new Arrow;
/*
 * }}}
 */

/*
 * Arrow.Error {{{
 */
Arrow.Error = Arrow.ValueIn(1);

Arrow.Error.prototype.toString = function() {
    return '[Arrow.Error ' + this.value + ']';
}
/*
 * }}}
 */

/*
 * Asynchronous Arrows {{{
 * TODO: Add Arrow.Async class
 */
Arrow.Delay = function(msec) {
    return Arrow.fromCPS.named('delay ' + msec + 'msec')(function(x, k) {
        this.setTimeoutID = setTimeout(function() { k(x) }, msec);
        this.cancel = function() { clearTimeout(this.setTimeoutID) };
    });
}

Arrow.Event = function(object, event) {
    return Arrow.fromCPS.named('event ' + object + ' ' + event)(function(x, k) {
        var stop = false;
        var listener = function(e) {
            if (stop) return;
            stop = true;
            k(e);
        };
        Arrow.Compat.addEventListener(object, event, listener, true);
        this.cancel = function() { this.stop = true };
    });
}

// TODO: Parameters for method, query
Arrow.XHR = function(url) {
    return Arrow.fromCPS.named('xhr ' + url)(function(x, k) {
        var stop = false;
        try {
            var xhr = Arrow.Compat.newXHR();
            xhr.onreadystatechange = function() {
                if (stop)
                    return;
                if (xhr.readyState == 4) {
                    if (/^2\d\d$/.exec(xhr.status)) {
                        k(xhr);
                    } else {
                        k(Arrow.Error(xhr));
                    }
                }
            };
            xhr.open('GET', url, true);
            xhr.send(null);
        } catch (e) {
            k(Arrow.Error(e));
        }
        this.cancel = function() { stop = true };
    });
}

Arrow.JSONP = function(url) {
    if (!('_count' in Arrow.JSONP))
        Arrow.JSONP._count = 0;

    return Arrow.fromCPS.named('JSONP ' + url)(function(x, k) {
        Arrow.JSONP['callback' + Arrow.JSONP._count] = k;
        var script = document.createElement('script');
        script.src = url + (url.indexOf('?') != -1 ? '&' : '?') + 'callback=Arrow.JSONP.callback' + Arrow.JSONP._count;
        script.type = 'text/javascript';
        document.getElementsByTagName('head')[0].appendChild(script);
        Arrow.JSONP._count++;
    });
}
/*
 * }}}
 */

/*
 * Browser Compatibility {{{
 */
Arrow.Compat = { };

Arrow.Compat.addEventListener = function(object, event, callback, capture) {
    if (object.addEventListener) {
        return object.addEventListener(event, callback, capture);
    } else {
        return object.attachEvent('on' + event, function() { callback(window.event) });
    }
}

Arrow.Compat.newXHR = function() {
    return new XMLHttpRequest;
}
/*
 * }}}
 */

/*
 * Special Operators {{{
 */
var _ = {
    valueOf: (function(i) {
        i = 0;
        return function() {
            return (i = ++i % 2) ? 2 : 3;
        }
    })()
}

Arrow.prototype[_>_] = Arrow.prototype['>>>'];
Arrow.prototype[_+_] = Arrow.prototype['+++'];
Arrow.prototype[_*_] = Arrow.prototype['***'];
Arrow.prototype[_|_] = Arrow.prototype['|||'];
Arrow.prototype[_&_] = Arrow.prototype['&&&'];
/*
 * }}}
 */
