"use strict";
/**
 * @module model_decompostion.js
 * Decomposition network. Loaded with TensorFire.
 * Neural network currently held off due to ongoing training and TensorFire wrangling.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

const DecomposeModel = {

	/*
		Load model from json dict files.
	*/
	loadModel() {
		// Interim model.
		// console.log('Decomposition model loaded.');
		throw new Error("Not implemented!");
	},

	/*
		Convert image into a tensor.
	*/
	imageToTensor(imageElement) {
		throw new Error("Not implemented!");
	},

	/*
		Convert image tensor to descriptive strokes.
	*/
	imageToStrokes(tensor) {
		throw new Error("Not implemented!");
	},

	/*
		Convert image tensor to descriptive strokes. (Interim)
		Thanks to https://inspirit.github.io/jsfeat/
	*/
	interimModel(tensor) {
		throw new Error("Not implemented!");
	},

	render2(tensor) {
		throw new Error("Not implemented!");
	},

	render(tensor) {
		throw new Error("Not implemented!");
	}
}


if (isNode) {
	module.exports = {
		DecomposeModel,
	}
}
