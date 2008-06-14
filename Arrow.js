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

Arrow.prototype.name = '(no name)';

Arrow.prototype.call = function(x) {
    var result;
    this.callCPS(x, function(y) { result = y });
    return result;
}

Arrow.prototype.callCPS = function(x, k) {
    this.cpsFunction(x, k);
}

Arrow.prototype.toString = function() {
    return '[Arrow' + (this.name ? ' ' + this.name : '') + ']';
}

Arrow.prototype['>>>'] = function(g) {
    var f = this, g = Arrow(g);
    return Arrow.fromCPS.named(f.name + ' >>> ' + g.name)(function(x, k) {
        f.callCPS(x, function(y) { g.callCPS(y, k) });
    });
}

Arrow.prototype.next = Arrow.prototype['>>>'];

Arrow.prototype['&&&'] = function(g) {
    var f = this, g = Arrow(g);
    return Arrow.fromCPS.named(f.name + ' &&& ' + g.name)(function(x, k) {
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

Arrow.prototype['***'] = function(g) {
    var f = this, g = Arrow(g);
    return Arrow.fromCPS.named(f.name + ' *** ' + g.name)(function(x, k) {
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

Arrow.Delay = function(msec) {
    return Arrow.fromCPS(function(x, k) {
        setTimeout(function() { k(x) }, msec);
    });
}

Arrow.Event = function(object, event) {
    return Arrow.fromCPS(function(x, k) {
        var listener = function(e) {
            object.removeEventListener(event, listener, true);
            k(e);
        };
        object.addEventListener(event, listener, true);
    });
}
