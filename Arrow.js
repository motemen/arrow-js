function Arrow(cpsFunction) {
    if (!(this instanceof Arrow)) {
        return new Arrow(cpsFunction);
    }
    this.cpsFunction = cpsFunction;
}

Arrow.pure = function(f) {
    return Arrow(function(x, k) {
        return k(f(x));
    });
}

Arrow.constant = function(value) {
    return Arrow.pure(function() {
        return value;
    });
}

Arrow.prototype.next = function(g) {
    if (typeof g == 'function')
        g = Arrow.pure(g);
    var f = this.cpsFunction, g = g.cpsFunction;
    return Arrow(function(x, k) {
        f(x, function(y) { g(y, k) });
    });
}

Arrow.prototype.call = function(x) {
    var result;
    this.cpsFunction(x, function(y) { result = y });
    return result;
}

Arrow.Delay = function(msec) {
    return Arrow(function(x, k) {
        setTimeout(function() { k(x) }, msec);
    });
}

Arrow.Event = function(object, event) {
    return Arrow(function(x, k) {
        var listener = function(e) {
            object.removeEventListener(event, listener, true);
            k(e);
        };
        object.addEventListener(event, listener, true);
    });
}
