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

Arrow.prototype.apply = function(obj, args) {
    return this.func.apply(obj, args);
};

Arrow.prototype.next = function(g) {
    var f = this.func;
    return Arrow(function() {
        return Arrow(g).call(f.apply(this, arguments));
    });
};

Arrow.prototype.and = function(g) {
    var f = this.func;
    return Arrow(function() {
        return [
            f.apply(this, arguments),
            Arrow(g).apply(this, arguments)
        ];
    });
};
