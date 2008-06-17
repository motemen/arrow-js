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
    if (f.f && f.f instanceof Arrow.Duplicate) {
        f = f.g;
    }
    if (g.f && g.f instanceof Arrow.Duplicate) {
        g = g.g;
    }
    var parallelA = Arrow.Parallel(f, g);
    return (Arrow.Duplicate(parallelA.arrows.length))['>>>'](parallelA);
}

Arrow.prototype.forkNext = function() {
    return this.next((Arrow.Duplicate(arguments.length))['>>>'](Arrow.Parallel(Array.slice(arguments))));
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
    return Arrow.Parallel(f, g);
}

Arrow.prototype.and = Arrow.prototype['***'];

/*
 * Arrow.Duplicate {{{
 */
Arrow.Duplicate = function(n) {
    if (!(this instanceof Arrow.Duplicate))
        return new Arrow.Duplicate(n);

    this.name = 'duplicate ' + n;
    this.cpsFunction = function(x, k) {
        var xs = [];
        for (var i = 0; i < n; i++) {
            xs.push(x);
        }
        k(xs);
    };
}

Arrow.Duplicate.prototype = new Arrow;
/*
 * }}}
 */

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
    return Arrow.fromCPS.named('(' + f.name + ') ||| (' + g.name + ')')(function(x, k) {
        if (x instanceof Arrow.Error) {
            g.callCPS(x.value, function(y) { k(Arrow.Error(y)) });
        } else {
            f.callCPS(x, k);
        }
    });
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
    return Arrow.fromCPS.named('(' + f.name + ') +++ (' + g.name + ')')(function(x, k) {
        if (x instanceof Arrow.Error) {
            g.callCPS(x.value, function(y) { k(y) });
        } else {
            f.callCPS(x, k);
        }
    });
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
    return Arrow.fromCPS.named('(' + f.name + ') <+> (' + g.name + ')')(function(x, k) {
        var called;
        function callCont(y) {
            if (!called)
                k(y);
            called = true;
        }
        f.callCPS(x, function(y) { g.cancel && g.cancel(); callCont(y) });
        g.callCPS(x, function(y) { f.cancel && f.cancel(); callCont(y) });
    });
}

Arrow.prototype.or = Arrow.prototype['<+>'];
/*
 * }}}
 */


/*
 * Arrow.Parallel {{{
 */
Arrow.Parallel = function(/* f, g, ... */) {
    var arrows = [];
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] instanceof Array) {
            arrows = arrows.concat(arguments[i]);
        } else if (arguments[i] instanceof Arrow.Parallel) {
            arrows = arrows.concat(arguments[i].arrows);
        } else {
            arrows.push(arguments[i]);
        }
    }
    if (!(this instanceof Arrow.Parallel)) {
        return new Arrow.Parallel(arrows);
    }
    this.arrows = arrows;
    this.name = 'paralell ' + arrows;
}

Arrow.Parallel.prototype = new Arrow;

Arrow.Parallel.prototype.callCPS = function(xs, k) {
    var fs = this.arrows;
    var results = [];
    var count = fs.length;
    for (var i = 0; i < fs.length; i++) {
        with ({ i: i }) {
            fs[i].callCPS(xs[i], function(y) { results[i] = y; if (!--count) k(results) });
        }
    }
}
/*
 * }}}
 */

/*
 * Arrow.Error {{{
 */
Arrow.Error = function(e) {
    if (!(this instanceof Arrow.Error))
        return new Arrow.Error(e);
    this.value = e;
}

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
