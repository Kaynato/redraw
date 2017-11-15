"use strict";
/**
 * @module predict_vector.js
 * Generation network. Loaded with TensorFire.
 * Slated for release 2.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

// local
// const mp = require('./mp.js');


const GenerateModel = {

	/*
		Load model from json dict files.
	*/
	loadModel() {
		throw Error("Not implemented!")
	},

	/*
		Should return a stroke-descriptive ndarray. 
		Update once we get TensorFire working.

		For continuous calling, we probably want to avoid
		repeatedly using ndpack.
	*/
	nextStroke(mpState) {
		// Procedure:
		// 	1. Unpack the current state
		// 	2. Get the current stroke
		// 	3. Predict new stroke using random values
		// 	4. Check if the indicies of that stroke are within the window
		// 		a. If not, retry with a new vector
		// 	5. return new vector indicies

		// state = mpState;
		// state = ndpack(mpState);
		// if (mp.MPState.inBounds()) {
		// 	let newStroke = 
		// }
		// let newStroke = 
		throw Error("Not implemented!")
	}

}

if (isNode) {
	module.exports = {
		GenerateModel,
	}
}
