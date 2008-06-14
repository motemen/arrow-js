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
    return Arrow.fromCPS.named('(' + f.name + ') >>> (' + g.name + ')')(function(x, k) {
        f.callCPS(x, function(y) { g.callCPS(y, k) });
    });
}

Arrow.prototype.next = Arrow.prototype['>>>'];

// Fork arrow
//
// x -> [y1, y2]
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
    return Arrow.fromCPS.named('(' + f.name + ') &&& (' + g.name + ')')(function(x, k) {
        var results = { };
        function callCont() {
            if ('f' in results && 'g' in results) {
                k([results.f, results.g]);
            }
        }
        f.callCPS(x, function(y) { results.f = y; callCont() });
        g.callCPS(x, function(y) { results.g = y; callCont() });
    });
}

Arrow.prototype.forkNext = function(f, g) {
    return this.next((f)['&&&'](g));
}

// Combine arrows
//
// [x1, x2] -> [y1, y2]
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
    return Arrow.fromCPS.named('(' + f.name + ') *** (' + g.name + ')')(function(x, k) {
        if (typeof x == 'undefined') {
            x = [];
        }
        var results = { };
        function callCont() {
            if ('f' in results && 'g' in results) {
                k([results.f, results.g]);
            }
        }
        f.callCPS(x[0], function(y) { results.f = y; callCont() });
        g.callCPS(x[1], function(y) { results.g = y; callCont() });
    });
}

Arrow.prototype.and = Arrow.prototype['***'];

// Join arrows
//
// [x1, x2] -> y
//
//  +---+
// -| f |-+
//  +---+ |
//        +->
//  +---+ |
// -| g |-+
//  +---+
//
Arrow.prototype['|||'] = function(g) {
    var f = this, g = Arrow(g);
    return Arrow.fromCPS.named('(' + f.name + ') ||| (' + g.name + ')')(function(x, k) {
        if (typeof x == 'undefined') {
            x = [];
        }
        if (x instanceof Arrow.Error) {
            g.callCPS(x, k);
        }
        if (x[0] && !(x[0] instanceof Arrow.Error)) {
            f.callCPS(x[0], k);
        } else if (x[1]) {
            g.callCPS(x[1], k);
        }
    });
}

Arrow.prototype.joinNext = function(f, g) {
    return this.next((f)['|||'](g));
}

// Choose arrow
//
// x -> y
//
//   +---+
// +-| f |-+
// | +---+ |
//-+       +->
// | +---+ |
// +-| g |-+
//   +---+
//
Arrow.prototype['+++'] = function(g) {
    var f = this, g = Arrow(g);
    return Arrow.fromCPS.named(f.name + ' +++ ' + g.name)(function(x, k) {
        function callCont(y) {
            if (y instanceof Arrow.Error)
                return;
            k(y);
            callCont = function() { };
        }
        f.callCPS(x, callCont);
        g.callCPS(x, callCont);
    });
}

Arrow.prototype.or = Arrow.prototype['+++'];
/*
 * }}}
 */

/*
 * Arrow.Error {{{
 */
Arrow.Error = function(e) {
    if (!(this instanceof Arrow.Error))
        return new Arrow.Error(e);
    this.error = e;
}

Arrow.Error.prototype.toString = function() {
    return '[Arrow.Error ' + this.error + ']';
}
/*
 * }}}
 */

/*
 * Asynchronous Arrows {{{
 */
Arrow.Delay = function(msec) {
    return Arrow.fromCPS.named('delay ' + msec + 'msec')(function(x, k) {
        setTimeout(function() { k(x) }, msec);
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
    });
}

// TODO: method, query
Arrow.XHR = function(url) {
    return Arrow.fromCPS.named('xhr ' + url)(function(x, k) {
        try {
            var xhr = Arrow.Compat.newXHR();
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    if (/^2\d\d$/.exec(xhr.status)) {
                        k([xhr, undefined]);
                    } else {
                        k([undefined, Arrow.Error(xhr)]);
                    }
                }
            };
            xhr.open('GET', url, true);
            xhr.send(null);
        } catch (e) {
            k([undefined, e]);
        }
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
 * Browser Compatibles {{{
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
