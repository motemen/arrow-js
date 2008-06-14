function Arrow(f) {
    if (f instanceof Arrow) {
        return f;
    }
    if (!(this instanceof Arrow)) {
        return new Arrow(f);
    }
    if (f) {
        this.cpsFunction = function(x, k) { return k(f(x)) };
    }
}

Arrow.fromCPS = function(cpsFunction) {
    var arrow = new Arrow;
    arrow.cpsFunction = cpsFunction;
    return arrow;
}

Arrow.constant = function(value) {
    return Arrow(function() {
        return value;
    });
}

Arrow.prototype.next = function(g) {
    var f = this.cpsFunction, g = Arrow(g).cpsFunction;
    return Arrow.fromCPS(function(x, k) {
        f(x, function(y) { g(y, k) });
    });
}

Arrow.prototype.call = function(x) {
    var result;
    this.cpsFunction(x, function(y) { result = y });
    return result;
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
