/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const mp = require('../docs/js/mp.js');
const predict = require('../docs/js/predict_vector.js');
// Pass in predictor.
mp.MPState.predictor = predict.GenerateModel;

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

// Slated for next release. Keep as is for now.
describe('predict', function() {
    // it('should indicate current implementation status of loadModel()', function() {
        // assert.throws(predict.GenerateModel.loadModel, /Not implemented!/)
    // });

    // TODO - there definitely exist more things we can test here
    it('Should return some stroke even for an empty MP state', function() {
        mp.p5_inst.setup();
        var nextStroke = predict.GenerateModel.nextStroke(mp.MPState);
        assert.isNotNull(nextStroke);
    });

    it('Should return some stroke for a nonempty MP state', function() {
        // mp.p5_inst.setMouse(5, 5);
        // mp.p5_inst.mouseDragged();
        // var nextStroke = predict.GenerateModel.nextStroke(mp.MPState);
        // assert.isNotNull(nextStroke);
    });

    it('Should change the amount of strokes in the MP after generation', function() {
        mp.MPState.setGenerating(true);
        const strokesI = mp.MPState.getVisibleStrokes();
        mp.togglePlay();
        mp.p5_inst.setMouse(5, 5);
        mp.p5_inst.mouseDragged();
        mp.p5_inst.mouseReleased();
        const strokesF = mp.MPState.getVisibleSizes();
        assert.notEqual(strokesF.length, strokesI.length, 'not equal');
    });
})