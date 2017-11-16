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
    	var stroke = mp.MPState.getCurrentStroke();
    	assert.isNotNull(stroke);
    	assert.equal(mp.MPState.strokeIndex, 1);
    	assert.deepEqual(stroke, [0, 0, 5, 5, 1, [0, 0, 0]]);
    });

    it('should revert strokes through seekBackward()', function() {
    	mp.p5_inst.setMouse(5, 5);
    	mp.p5_inst.mouseDragged();
    	mp.seekBackward();
    	assert.isTrue(mp.MPState.strokeIndex < mp.MPState.dataIndex);
    });

    it('should return future strokes with seekForward()', function() {
    	mp.seekForward();
    	assert.equal(mp.MPState.strokeIndex, mp.MPState.dataIndex);
    });

    it('should have a different number of vectors', function() {
      mp.MPState.setGenerating(true);
      const strokesI = mp.MPState.getVisibleStrokes();
      mp.togglePlay();
      mp.p5_inst.setMouse(5, 5);
      mp.p5_inst.mouseDragged();
      const strokesF = mp.MPState.getVisibleSizes();
      assert.notEqual(strokesF.length, strokesI.length, 'not equal');
    });
    // There is no way to test further p5 interaction, especially the parts having
    //    to do with file interaction, complex user behavior and interactivity.
    // ...which means automating unit testing for that is not feasible.
});
