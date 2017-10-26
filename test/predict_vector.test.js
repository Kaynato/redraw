/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const predict = require('../docs/js/predict_vector.js');


/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('predict', function() {
    it('should indicate current implmentation status of loadModel()', function() {
        assert.throws(predict.GenerateModel.loadModel, /Not implemented!/)
    });

    it('should indicate current implmentation status of nextStroke(ndpack)', function() {
        assert.throws(predict.GenerateModel.nextStroke, /Not implemented!/)
    });
})