'use strict';


//just a helper for logging elapsed time
var Stopwatch = function() {
	this._startTime = (new Date()).getTime();
	this._stopTime = (new Date()).getTime();
	this._running = false;
};

Stopwatch.prototype.start = function() {
	this._startTime = (new Date()).getTime();
	this._running = true;
	return this;
};

Stopwatch.prototype.stop = function() {
	this._stopTime = (new Date()).getTime();
	this._running = false;
	return this;
};

Stopwatch.prototype.reset = function() {
	this._startTime = (new Date()).getTime();
	this._stopTime = (new Date()).getTime();
	return this;
};

Stopwatch.prototype.elapsed = function() {
	if (!this._running) {
		return this._stopTime - this._startTime;
	}
	var curTime = (new Date()).getTime();
	return (curTime - this._startTime);
};


module.exports = Stopwatch;
