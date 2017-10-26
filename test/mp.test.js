/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const mp = require('../docs/js/mp.js');


/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('mp', function() {
    it('should show current stroke is null', async function() {
        assert.isNull(mp.MPState.getCurrentStroke(), 'Current Stroke is null')
    });
});