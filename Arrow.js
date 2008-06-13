// Sync
function Arrow(f) {
    if (f instanceof Arrow) {
        return f;
    }
    if (!(this instanceof Arrow)) {
        return new Arrow(f);
    }
    this.cps = function(x, k) {
        return k(f(x));
    };
}

Arrow.Constant = function(value) {
    return Arrow(function() {
        return value;
    });
};

Arrow.Identity = Arrow(function(x) {
    return x;
});

Arrow.prototype.next = function(g) {
    var f = this.cps;
    var g = g instanceof Arrow ? g.cps : function(x, k) { k(g(x)) };
    var arrow = new Arrow;
    arrow.cps = function(x, k) {
        f(x, function(y) { g(y, k) });
    };
    return arrow;
};

Arrow.prototype.call = function(x) {
    var result;
    this.cps(x, function(y) { result = y });
    return result;
};
