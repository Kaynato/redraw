/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const decomposition = require('../docs/js/model_decomposition.js');


/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('decomposition', function() {
    it('should indicate current implmentation status of loadModel()', function() {
        assert.throws(decomposition.DecomposeModel.loadModel, /Not implemented!/)
    });

    it('should indicate current implmentation status of imageToTensor()', function() {
        assert.throws(decomposition.DecomposeModel.imageToTensor, /Not implemented!/)
    });

    it('should indicate current implmentation status of imageToStrokes()', function() {
        assert.throws(decomposition.DecomposeModel.imageToStrokes, /Not implemented!/)
    });
})