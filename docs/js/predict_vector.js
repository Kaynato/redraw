/**
 * @module predict_vector.js
 * Generation network. Loaded with TensorFire.
 * Slated for release 2.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

GenerateModel = {

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
		// state = ndpack(mpState);
		throw Error("Not implemented!")
	}

}

if (isNode) {
	module.exports = {
		GenerateModel,
	}
}
