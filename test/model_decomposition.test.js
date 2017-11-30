/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const decomposition = require('../docs/js/model_decomposition.js');

const ColorThief = require('colorthief');

const getPixels = require('get-pixels');

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;

describe('decomposition', function() {

	it('should correctly convert an image to strokes', function() {
		
		getPixels('./assets/square.png', function(err, img) {
			if (err) {
				alert("Bad image data!");
				throw Error("Unrecognized image data!");
			}

		let tensor = decomposition.DecomposeModel.imageToTensor(img);
		decomposition.DecomposeModel.imageToStrokes(tensor, img.elt);

		});

	});
})