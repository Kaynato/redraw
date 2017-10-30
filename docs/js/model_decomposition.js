/**
 * @module model_decompostion.js
 * Decomposition network. Loaded with TensorFire.
 * Neural network currently held off due to ongoing training and TensorFire wrangling.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

DecomposeModel = {

	/*
		Load model from json dict files.
	*/
	loadModel() {
		throw new Error("Not implemented!");
	},

	/*
		Convert image into a tensor.
	*/
	imageToTensor(image) {
		throw new Error("Not implemented!");
	},

	/*
		Convert image tensor to descriptive strokes.
	*/
	imageToStrokes(imageTensor) {
		throw new Error("Not implemented!");
	},

}

if (isNode) {
	module.exports = {
		DecomposeModel,
	}
}
