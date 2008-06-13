function Arrow(f) {
    if (f instanceof Arrow) {
        return f;
    }
    if (!(this instanceof Arrow)) {
        return new Arrow(f);
    }
    this.func = f;
}

Arrow.Constant = function(value) {
    return Arrow(function() {
        return value;
    });
};

Arrow.prototype.call = function() {
    return this.func.apply(this, arguments);
};

Arrow.prototype.apply = function(args) {
    return this.func.apply(this, args);
};

Arrow.prototype.next = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function() {
        return g.call(f.apply(arguments));
    });
};

Arrow.prototype.and = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function() {
        return [
            f.apply(arguments),
            g.apply(arguments)
        ];
    });
};

Arrow.prototype.pair = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function(a) {
        if (a) {
            var a1 = a[0];
            var a2 = a[1];
        }
        return [
            f.call(a1),
            g.call(a2)
        ];
    });
};
