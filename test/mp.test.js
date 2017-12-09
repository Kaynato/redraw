  /* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm
const chai = require('chai');

// local

// p5 unfortunately does not play kindly with npm testing.
const mp = require('../docs/js/mp.js');
const fs = require('fs');

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('Multipurpose Panel Unit Tests', function() {

    it('should show current stroke is null', function() {
        mp.clears();
        assert.isNull(mp.MPState.getCurrentStroke(), 'Current Stroke is null');
        assert.isNull(mp.MPState.getCurrentSize(), 'Current length of state is null');
    });

    it('should reject invalid set variables', function() {
        let strokeIndex = mp.MPState.strokeIndex;
        let dataIndex = mp.MPState.dataIndex;
        assert.isNull(mp.MPState.setStrokeIndex(-5));
        assert.isNull(mp.MPState.setDataIndex(-5));
        assert.equal(mp.MPState.strokeIndex, strokeIndex);
        assert.equal(mp.MPState.dataIndex, dataIndex);
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
        assert.equal(mp.p5_inst.getSize(), 1);
        assert.deepEqual(stroke, [0, 0, 5, 5, 1, [1, 1, 1]]);
    });

    it('should mirror strokes vertically through mirrorModeWithValue(1)', function() {
        // Vertical
        mp.mirrorModeWithValue(1);
        var stroke = mp.MPState.getCurrentStroke();
        assert.deepEqual(stroke, [640, 0, 637.5, 5, 1, [1, 1, 1]]);
    });

    it('should mirror strokes horizontally through mirrorModeWithValue(2)', function() {
        // Vertical
        mp.mirrorModeWithValue(2);
        var stroke = mp.MPState.getCurrentStroke();
        assert.deepEqual(stroke, [640, 480, 637.5, 477.5, 1, [1, 1, 1]]);
    });

    it('should mirror strokes through the origin with mirrorModeWithValue(3)', function() {
        // Vertical
        mp.mirrorModeWithValue(3);
        var stroke = mp.MPState.getCurrentStroke();
        assert.deepEqual(stroke, [320, 240, 318.75, 238.75, 1, [1, 1, 1]]);
    });

    it('should save the canvas state with saveImage()', function() {
        mp.saveImage();
        let savedImage = mp.MPState.savedImages[0];
        assert.deepEqual(savedImage, {
            strokes: [ [320, 240, 318.75, 238.75, 1, [1, 1, 1]] ],
            sizes: [1],
            strokeIndices: [0, 1]
        })
    })

    it('should clear state but preserve saved state if loading invalid saved image with loadImageWithValue(val)', function() {
        mp.loadImageWithValue(-1);
        let savedImage = mp.MPState.savedImages[0];
        assert.deepEqual(savedImage, {
            strokes: [ [320, 240, 318.75, 238.75, 1, [1, 1, 1]] ],
            sizes: [1],
            strokeIndices: [0, 1]
        });
        assert.equal(mp.MPState.strokeIndex, 0);
        assert.equal(mp.MPState.dataIndex, 0);
        assert.isNull(mp.MPState.getCurrentStroke());
    });

    it('should load saved images with loadImageWithValue(val)', function() {
        mp.loadImageWithValue(0);
        var stroke = mp.MPState.getCurrentStroke();
        assert.deepEqual(stroke, [320, 240, 318.75, 238.75, 1, [1, 1, 1]]);
    });

    it('should rotate strokes with rotate()', function() {
        mp.rotate();
        var stroke = mp.MPState.getCurrentStroke();
        assert.deepEqual(stroke, [320, 240, 318.75, 241.25, 1, [1, 1, 1]]);
    });

    it('should revert strokes through seekBackward()', function() {
        mp.p5_inst.setMouse(5, 5);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        assert.isTrue(mp.MPState.atEnd());
        mp.seekBackward();
        assert.isTrue(mp.MPState.strokeIndex < mp.MPState.dataIndex);
        assert.isFalse(mp.MPState.atEnd());
    });

    it('should rotate all strokes, including invisible strokes, with rotate()', function() {
        // but don't render them
        mp.seekBackward();
        mp.seekBackward();
        mp.rotate();
    })

    it('should return future strokes with seekForward()', function() {
        mp.seekForward();
        mp.seekForward();
        mp.seekForward();
        assert.isTrue(mp.MPState.atEnd());
        assert.equal(mp.MPState.strokeIndex, mp.MPState.dataIndex);
    });

    it('should duplicate lines with warholMode()', function() {
        let origCount = mp.MPState.state.length;
        assert.equal(origCount, 2); // 2
        mp.warholMode();
        assert.equal(mp.MPState.state.length, origCount * 15);
    });

    it('should render many segments and artifacts with jpMode()', function() {
        let origCount = mp.MPState.state.length;
        mp.jpMode();
        assert.isTrue(mp.MPState.state.length > 500);
    });

    it('should overwrite if adding new strokes from earlier in history', function() {
        mp.seekBackward();
        mp.seekBackward();
        assert.isTrue(mp.MPState.strokeIndex < mp.MPState.dataIndex);
        mp.p5_inst.setMouse(10, 10);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        assert.equal(mp.MPState.strokeIndex, mp.MPState.dataIndex);
    });

    // it('should save a nonempty canvas ()', function() {
    // Can we even figure out a way to do this?        
    // });

    it('should be able to clear the canvas with clears()', function () {
        mp.clears();
        assert.equal(mp.MPState.strokeIndex, 0);
        assert.equal(mp.MPState.dataIndex, 0);
        assert.isNull(mp.MPState.getCurrentStroke());
    });

    it('should draw a square with setShapeOption(0) and mousePressed()', function() {
        mp.MPState.setShapeOption(0);
        mp.p5_inst.setMouse(300, 300);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.state.length, oldCount + 4);
    })

    it('should draw a circle with setShapeOption(1) and mousePressed()', function() {
        mp.MPState.setShapeOption(1);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.state.length, oldCount + 29);
    });

    it('should draw a triangle with setShapeOption(2) and mousePressed()', function() {
        mp.MPState.setShapeOption(2);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.state.length, oldCount + 3);
    })

    it('should draw a rhombus with setShapeOption(3) and mousePressed()', function() {
        mp.MPState.setShapeOption(3);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.state.length, oldCount + 4);
    });

    it('should draw a star with setShapeOption(4) and mousePressed()', function() {
        mp.MPState.setShapeOption(4);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.state.length, oldCount + 5);
    });

    // Mimic svg builder option here
    it('should export correct SVG files with exportSVG()', function(done) {
        mp.MPState.setShapeOption(null);
        // Also make a dot to cover circle case for svg builder
        mp.p5_inst.mousePressed();
        mp.p5_inst.setMouse(300, 300);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.setMouse(300, 300);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        let svg = mp.exportSVG();

        fs.readFile("./test/assets/confirm.svg", function(err, data) {
            if(err) {
                return console.log(err);
            }
            assert.equal(svg, data);
            done();
        }); 
    });

    it('should delete vectors in eraser mode', function() {
        let oldCount = mp.MPState.state.length;
        // Whiteout erase!
        mp.MPState.setShapeOption(null);
        mp.MPState.setEraserMode(true);
        mp.p5_inst.mousePressed();
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        assert.equal(mp.MPState.state.length, oldCount + 1);
        mp.MPState.setEraserMode(false);
    });

    it('should set color mode with colorPicker()', function() {
        mp.MPState.setColorMode(false);
        mp.colorPicker();
        mp.colorPicker();
        assert.equal(mp.MPState.getRedDropperMode(), -1);
        assert.equal(mp.MPState.getGreenDropperMode(), -1);
        assert.equal(mp.MPState.getBlueDropperMode(), -1);
        assert.isFalse(mp.MPState.getColorMode());
        mp.MPState.setColorMode(false);
    });

    it('should set pick color with color picker', function() {
        mp.MPState.setColorMode(true);
        mp.p5_inst.mousePressed();
        assert.equal(mp.MPState.getRedDropperMode(), 1);
        assert.equal(mp.MPState.getGreenDropperMode(), 1);
        assert.equal(mp.MPState.getBlueDropperMode(), 1);
        mp.p5_inst.mouseDragged();
        mp.MPState.setColorMode(false);
    });

    it('should fill a shape when fillMode is on', function() {
        mp.MPState.setFillMode(true);
        let oldCount = mp.MPState.state.length;
        mp.p5_inst.mousePressed();
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        mp.MPState.setFillMode(false);
        // console.log(oldCount, mp.MPState.state.length);
    });


});
