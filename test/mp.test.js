  /* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm
const chai = require('chai');

// local

// p5 unfortunately does not play kindly with npm testing.
const mp = require('../docs/js/mp.js');

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('Multipurpose Panel Unit Tests', function() {
    it('should show current stroke is null', function() {
        assert.isNull(mp.MPState.getCurrentStroke(), 'Current Stroke is null')
    });

    it('should contain canvas and slider after setup', function() {
    	mp.p5_inst.setup();
    	assert.isNotNull(mp.p5_inst.canvas);
    	assert.isNotNull(mp.p5_inst.slider);
    });

    it('should fail to register out-of-bounds mouse clicks', function() {
    	// bypass interface to directly test functions. unfortunate reality.
    	assert.isFalse(mp.MPState.inBounds(-1, 5, 5, 5));
    	assert.isFalse(mp.MPState.inBounds(0, 5, 641, 5));
    	assert.isFalse(mp.MPState.inBounds(0, 5, 5, 481));
    	assert.isTrue(mp.MPState.inBounds(0, 5, 5, 5));
    });

    it('should register and store strokes in its state', function() {
    	// Simulate fake mouse movement - it's the best we can do
    	mp.p5_inst.setMouse(5, 5);
    	mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        var stroke = mp.MPState.getCurrentStroke();
        assert.isNotNull(stroke);
        assert.equal(mp.MPState.strokeIndex, 1);
        assert.deepEqual(stroke, [0, 0, 5, 5, 1, [1, 1, 1]]);
    });

    it('should revert strokes through seekBackward()', function() {
        mp.p5_inst.setMouse(5, 5);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        mp.seekBackward();
        assert.isTrue(mp.MPState.strokeIndex < mp.MPState.dataIndex);
    });

    it('should return future strokes with seekForward()', function() {
        mp.seekForward();
        assert.equal(mp.MPState.strokeIndex, mp.MPState.dataIndex);
    });

    it('should be able to clear the canvas with clears()', function () {
        mp.clears();
        assert.equal(mp.MPState.strokeIndex, 0);
        assert.equal(mp.MPState.dataIndex, 0);
        assert.isNull(mp.MPState.getCurrentStroke());
    });

});
