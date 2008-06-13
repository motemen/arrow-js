function Arrow(f) {
    if (f instanceof Arrow) {
        return f;
    }
    if (!(this instanceof Arrow)) {
        return new Arrow(f);
    }
    this.func = f;
}

Arrow.prototype.next = function(g) {
    var f = this.func;
    return Arrow(function() {
        return Arrow(g).call(f.apply(this, arguments));
    });
};

Arrow.prototype.call = function() {
    return this.func.apply(this, arguments);
};
