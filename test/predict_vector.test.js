/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const predict = require('../docs/js/predict_vector.js');


/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

// Slated for next release. Keep as is for now.
describe('predict', function() {
    it('should indicate current implementation status of loadModel()', function() {
        assert.throws(predict.GenerateModel.loadModel, /Not implemented!/)
    });

    it('should indicate current implementation status of nextStroke(ndpack)', function() {
        assert.throws(predict.GenerateModel.nextStroke, /Not implemented!/)
    });
})