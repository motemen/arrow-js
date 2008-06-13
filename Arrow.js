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

Arrow.prototype.call = function(x) {
    return this.func(x);
};

Arrow.prototype.apply = function(x) {
    return this.func.apply(this, x);
};

Arrow.prototype.next = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function(x) {
        return g.call(f.call(x));
    });
};

Arrow.prototype.and = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function(x) {
        return [
            f.call(x),
            g.call(x)
        ];
    });
};

Arrow.prototype.para = function(g) {
    var f = this, g = Arrow(g);
    return Arrow(function(x) {
        if (x) {
            var x0 = x[0], x1 = x[1];
        }
        return [
            f.call(x0),
            g.call(x1)
        ];
    });
};
