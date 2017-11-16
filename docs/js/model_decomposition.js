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
		let temp = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
		// jsfeat.imgproc.grayscale(tensor, width, height, temp);
		
		let radius = 2;
		let diameter = 2 * (radius + 1);
		let sigma = 0;
		jsfeat.imgproc.gaussian_blur(tensor, temp, diameter, sigma);
		let low_thresh = 50;
		let high_thresh = 300;
		jsfeat.imgproc.canny(temp, temp, low_thresh, high_thresh);

		let coeff = height < width ? width : height;
		coeff *= 0.4;

		let res_rho = 1;
		let res_theta = (Math.PI / 540);
		let hough_thresh = coeff;
		var hough_out = jsfeat.imgproc.hough_transform(temp, res_rho, res_theta, hough_thresh)

		let strokes = [];

		for (var i = 0; i < hough_out.length; i++) {

		    let rho = hough_out[i][0];
		    let theta = hough_out[i][1];

		    let a = Math.cos(theta);
		    let b = Math.sin(theta);
		    const x0 = a * rho;
		    const y0 = b * rho;

		    strokes.push([Math.round(x0 - 640 * b),    // sx
		    			  Math.round(y0 + 640 * a),    // sy
		    			  Math.round(x0 + 640 * b),    // fx
		    			  Math.round(y0 - 640 * a)]); // fy

		}

		return strokes;

	},

	/*
		Convert image tensor to descriptive strokes. (Interim)
		Thanks to https://inspirit.github.io/jsfeat/
	*/
	interimModel(tensor) {
		// let temp_buf = new jsfeat.data_t
		const width = tensor.cols;
		const height = tensor.rows;
		let temp = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
		// jsfeat.imgproc.grayscale(tensor, width, height, temp);
		
		// Could iterate successively with different radii

		let radius = 2;
		let diameter = 2 * (radius + 1);
		let sigma = 0;
		jsfeat.imgproc.box_blur_gray(tensor, temp, diameter);

		let scharr = new jsfeat.matrix_t(width, height, jsfeat.S32C2_t);
		jsfeat.imgproc.scharr_derivatives(temp, scharr);

		return scharr;
	},

	render2(tensor) {
		// Debug only - render 2-channel tensor
		let cvs = document.getElementById('defaultCanvas0').getContext('2d');
		let target = cvs.getImageData(0, 0, tensor.cols, tensor.rows);

	    // render tensor back to canvas
	    const alpha = (0xff << 24);
	    let data_u32 = new Uint32Array(target.data.buffer);
	    let i = tensor.cols*tensor.rows;
	    let pix = 0;
	    let gx = 0;
	    let gy = 0;
        while(--i >= 0) {
            gx = Math.abs(tensor.data[ i<<1   ]>>2)&0xff;
            gy = Math.abs(tensor.data[(i<<1)+1]>>2)&0xff;
            pix = ((gx + gy)>>2)&0xff;
            data_u32[i] = (pix << 24) | (gx << 16) | (0 << 8) | gy;
        }

	    cvs.putImageData(target, 0, 0);
	},

	render(tensor) {
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
}


if (isNode) {
	module.exports = {
		DecomposeModel,
	}
}
