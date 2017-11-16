"use strict";
/**
 * @module predict_vector.js
 * Generation network. Loaded with TensorFire.
 * Slated for release 2.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

// local
// import { MPState } from './mp.js';
// const mp = require('./mp.js');

const GenerateModel = {

	/**
	 * Load model fron json dict files. 
	 */
	loadModel() {
		throw Error("Not implemented!")
	},

	/**
	 * Predicts the next stroke based off previous strokes. 
	 * Update sonce we get TensorFire working. 
	 * 
	 * For continous calling, we probably want to avoid repeatedly using ndpack. 
	 * 
	 * @param {mp.object} mpState 
	 * @returns newStroke 	- a stroke object containing a startX, startY, endX, endY, width and color.
	 */
	nextStroke(mpState) {
		throw Error("Not implemented!")
		// Procedure:
		// 	1. Unpack the current state
		// 	2. Get the current stroke
		// 	3. Predict new stroke using random values
		// 	4. Check if the indicies of that stroke are within the window
		// 		a. If not, retry with a new vector
		// 	5. return new vector indicies
	}
}

if (isNode) {
  module.exports = {
    GenerateModel,
  }
}
