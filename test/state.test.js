/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const state = require('../src/static/js/state.js');


/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('state', function() {
	it('should show current state value is zero', async function() {
        expect(currentState()).to.be.a(0);
    });
    
    it('should show increment state value is one', async function() {
        expect(increment()).to.be.a(1);
    });
    
    it('should show decrement state value is zero', async function() {
        expect(decrement()).to.be.a(0);
    });
    
    it('should show that the decrement state value doesn\'t become negative', async function() {
        expect(decrement()).to.be.a(0);
	});
});
