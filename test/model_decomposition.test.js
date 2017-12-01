/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const mp = require('../docs/js/mp.js');
const decomposition = require('../docs/js/model_decomposition.js');

// Bind for test
decomposition.DecomposeModel.mp = mp;

const getPixels = require('get-pixels');

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('Decomposition Model Unit Tests', function() {

	// First, prepare the mp
	mp.p5_inst.setup();
	mp.clears();
	
	it('should correctly convert an image to strokes', function(done) {
		
		getPixels('./test/assets/square.png', function(err, img) {
			assert.isNull(err);

			let tensor = decomposition.DecomposeModel.imageToTensor(img);
			decomposition.DecomposeModel.imageToStrokes(tensor);
			done();

		});

	});

});
