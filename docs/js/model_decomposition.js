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
		console.log('Decomposition model loaded.');
		// throw new Error("Not implemented!");
	},

	/*
		Convert image into a tensor.
	*/
	imageToTensor(imageElement) {
		let cvs = document.getElementById('defaultCanvas0').getContext('2d');
		let data = cvs.getImageData(0, 0, imageElement.width, imageElement.height);

		// Something is broken about this.
		// let buf = new jsfeat.data_t(data.length / 2, data.data)
		// return new jsfeat.matrix_t(imageElement.width,
									// imageElement.height,
									// jsfeat.U8C3_t, buf);

		// For now, we just sub in the grayscale matrix.
		let buf = new jsfeat.matrix_t(imageElement.width, imageElement.height, jsfeat.U8C1_t);
		jsfeat.imgproc.grayscale(data.data, imageElement.width, imageElement.height, buf);
		return buf;
	},

	/*
		Convert image tensor to descriptive strokes.
	*/
	imageToStrokes(tensor) {
		// let temp_buf = new jsfeat.data_t
		const width = tensor.cols;
		const height = tensor.rows;
		// let temp = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);

		// jsfeat.imgproc.grayscale(tensor, width, height, temp);
		
		// let radius = 2;
		// let diameter = 2 * (radius + 1);
		// let sigma = 0;
		// jsfeat.imgproc.gaussian_blur(temp, temp, diameter, sigma);

		return temp;

	},

}

function render(tensor) {
	// Debug only
	let cvs = document.getElementById('defaultCanvas0').getContext('2d');
	let target = cvs.getImageData(0, 0, tensor.cols, tensor.rows);

    // render tensor back to canvas
    const alpha = (0xff << 24);
    let data_u32 = new Uint32Array(target.data.buffer);
    let i = tensor.cols*tensor.rows;
    let pix = 0;
    while(--i >= 0) {
        pix = tensor.data[i];
        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
    }

    cvs.putImageData(target, 0, 0);
}

if (isNode) {
	module.exports = {
		DecomposeModel,
	}
}
