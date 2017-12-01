"use strict";
/**
 * @module model_decompostion.js
 * 
 * Redraw raster image with vector line segments of width and color.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

if (isNode) {
	var ndarray = require('ndarray');
	var ndops = require('ndarray-ops');
	var MaskUtils = require('./maskutils.js').MaskUtils;
	var ImageUtils = require('./imageutils.js');
	var ColorThief = require('../lib/color-thief-modified.js').ColorThief;
}

const CanvasWidth = 640;
const CanvasHeight = 480;

// DEBUG
// var OUTER = {
	// l: []
// };

const DecomposeModel = {

	// Tolerance for color error when looking for binary masks
	// Try higher values...? Might make a painterly feel.
	TOLERANCE: 0.05,

	// SSE for color fidelity ("correctness")
	FIDELITY: 0.04,

	// Score cutoff for ignoring components
	SCORE_CUTOFF_PERCENT: 0.005,

	// How many components to draw each step
	COMPONENTS_EACH_STEP: 5,

	// Max width allowable for estimation
	MAX_W: 21,

	// Percentage loss which is unacceptable for width (lower = more accurate)
	W_SENS: 0.20,

	// MUST BE INITIALIZED PER IMAGE.
	maskUtils: undefined,

	// max / min for median filter. greater maxfilt is the greater descent
	// in order of increasing detail from large inpainting
	MAX_FILT: 1,
	MIN_FILT: 1,

	// A color that either color thief ignores or we prohibit from the palette
	WHITE: [255, 255, 255],

	// When (image error %) < this, stop decomposition
	GOOD_ENOUGH_ERROR: 0.01,

	// Maximum iterations for decomposition
	MAX_ITERS: 20,

	// Multiple to decrease tolerance per iteration
	TOL_MUL: 0.95,

	/* Fix library access bug */
	colorThief: new ColorThief(),

	/**/
	mp: {MPState: undefined, p5_inst: undefined},

	/*
		Process image tensor into correct format.

		For some reason, ndimagetoarr transposes the image.
	*/
	imageToTensor(img) {
		const width = img.shape[1];
		const height = img.shape[0];
		const channels = img.shape[2];

		let tensorArr = new Uint8ClampedArray(img.data.length);
		let tensor = ndarray(tensorArr, [img.shape[1], img.shape[0], channels]);

		ndops.assign(tensor, img.transpose(1, 0));

		// Return immediately if no alpha channel
		if (channels < 4) {
			return tensor;
		}

		// If there is, use alpha blending to "blend with white"
		let x;
		let y;
		let ch;
		let alpha;
		let val;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				alpha = tensor.get(x, y, 3);
				alpha = Math.round(alpha / 255.0);
				for (ch = 0; ch < 3; ch++) {
					val = tensor.get(x, y, ch);
					val = (1 - alpha) * 255 + alpha * val;
					val = Math.round(val);
					tensor.set(x, y, ch, val);
				}
			}
		}

		return tensor;
	},

	/*
		Convert [W * H * C] image array into data url.

		arr (ndarray)
	*/
	toDataURL(arr) {
		let canvas = document.createElement('canvas');
		let context = canvas.getContext('2d');
		const width = arr.shape[0];
		const height = arr.shape[1];
		const channels = arr.shape[2];
		canvas.width = width;
		canvas.height = height;

		// TODO - what about image larger than canvas?

		let imgdata = context.getImageData(0, 0, canvas.width, canvas.height);
		let x;
		let y;
		let ch;
		let i = width * height * channels;
		for (x = width - 1; x >= 0; x--) {
			for (y = height - 1; y >= 0; y--) {
				for (ch = channels - 1; ch >= 0; ch--) {
					--i;
					imgdata.data[i] = arr.get(x, y, ch);
				}
			}
		}

		while(--i >= 0) {
			imgdata.data[i] = arr.data[i];
		}

		context.putImageData(imgdata, 0, 0);

		return canvas.toDataURL();
	},

	/*
		Determine largest connected component of the target color

		arr (ndarray) [H, W, C >= 3] image
		color (array(3)) RGB color to obtain components of
		maskUtil - maskutil object, which is needed for algorithms
		tol - tolerance for color mse
		addressed - mask of pixels already addressed
	*/
	scoreComponents(arr, color, maskUtil, tol, err, addressed) {
		let width = arr.shape[0];
		let height = arr.shape[1];
		// input channels = 3

		// All values in arr which have RGB MSE < Tolerance
		let mask = maskUtil.withinDiff(arr, color, tol);

		// Smooth things out
		maskUtil.fakeGaussianMut(mask);

		// Ignore parts already covered
		let x;
		let y;
		let val;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				val = addressed.get(x, y);
				if (val == 1) {
					mask.set(x, y, 0);
				}
			}
		}

		// This allocates a new array
		let blobs = maskUtil.labelComponents(mask);


		// const threshold = DecomposeModel.SCORE_CUTOFF_PERCENT * err;
		let components = [];
		let best5 = [0, 0, 0, 0, 0];
		let label;
		for (label = 1; label < blobs.labels; label++) {
			let score = blobs.scores[label];

			// Don't even bother if it's not big enough
			// if (score < threshold) {
			// 	continue;
			// }

			// Quick top-five selection
			let w;
			for (w = 0; w < best5.length; w++) {
				// If we are better
				if (score > best5[w]) {
					best5[w] = score;
					break;
				}
			}
			// Not better than any
			if (w == best5.length) {
				continue;
			}

			// Replaces ndops.eqs(component, blobs.arr, label);
			// If we allow labelComponents to generate arrays,
			// This allocation could be avoided
			let compArr = new Uint8ClampedArray(width * height);
			let component = ndarray(compArr, [width, height]);
			let i;
			for (i = width * height; i >= 0; i--) {
				if (blobs.arr.data[i] == label) {
					component.data[i] = 1;
				}
			}

			components.push({
				'score': score,
				'arr': component,
				'color': color
			});
		}

		return components;
	},

	simplifyPath(path) {
		let i;
		let prevX = path[0][0];
		let prevY = path[0][1];
		let x;
		let y;
		let removeIndices = [];
		let removeCounts = [];
		let removeCount = 0;
		let removeFrom = 1;
		for (i = 1; i < path.length; i++) {
			x = path[i][0];
			y = path[i][1];
			// The same, so remove
			if (x == prevX && y == prevY) {
				removeCount++;
			}
			// Different, so don't remove
			else {
				if (removeCount > 0) {
					removeCounts.push(removeCount);
					removeIndices.push(i);

					prevX = x;
					prevY = y;

					removeCount = 0;
					removeFrom = i + 1;
				}
			}
		}

		let j;
		for (j = 0; j < removeIndices.length; j++) {
			path.splice(removeIndices[j], removeCounts[j]);
		}

		return path;
	},

	/*
		RENDER THE PATH IN THE P5 CANVAS
		AND ADD IT TO THE MPSTATE.

		This allows us continuous play. I guess.
		It makes the wait more interesting. ...I guess.
	*/
	renderPath(path, color, width, scale, offX, offY) {

		width *= 2.0;
		const pathLength = path.length;
		if (pathLength < 2) {
			console.log("Attempted to render a path with length < 2! " +
						"Was this intentional?");
			return;
		}

		// Rest of the colorObj doesn't matter.
		const colorObj = {
			levels: [color[0], color[1], color[2], 255],
		};
		let i;
		let startX = path[0][1] * scale + offX;
		let startY = path[0][0] * scale + offY;
		let endX;
		let endY;
		let coord;
		let newStroke;
		for (i = 1; i < pathLength; i++) {
			endX = path[i][1] * scale + offX;
			endY = path[i][0] * scale + offY;

			newStroke = [startX, startY, endX, endY, width * scale,
						 color[0], color[1], color[2]];
			this.mp.MPState.addStroke(startX, startY, endX, endY, width * scale, colorObj);
			this.mp.p5_inst.drawStroke(newStroke, width * scale);

			startX = endX;
			startY = endY;
		}
		if (i == 1) {
			console.log('Something went wrong. Path drawing did not initiate.');
		}

	},

	/*
		Convert image array to descriptive strokes.

		arr (ndarray) contains channeled image information
	*/
	imageToStrokes(arr) {

		// Strokes are actually rendered by a function. Shhh.


		// Stack of unscored candidate components
		let candidatesUnscored = [];

		// Initialize a mask util object
		const width = arr.shape[0];
		const height = arr.shape[1];
		const maskUtil = new MaskUtils(width, height, DecomposeModel.MAX_W);

		// Compute ratio and offset
		let ratioX = CanvasWidth / width;
		let ratioY = CanvasHeight / height;
		var offsetX;
		var offsetY;
		const scale = Math.min(ratioX, ratioY);
		// If scaled by X
		if (ratioX <= ratioY) {
			offsetX = 0;	
			offsetY = CanvasHeight - (height * scale);
			offsetY /= 2.0;
		}
		else {
			offsetX = CanvasWidth - (width * scale);
			offsetX /= 2.0;
			offsetY = 0;
		}

		const componentSortingFunction = function(a, b) {
			return a.score - b.score;
		};

		// Stack of scored candidate components
		let candidates;
		let imagestate = arr;

		// Construct temp array for image
		let imgTemp = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
		let mockImg = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
		ndops.assigns(mockImg, 255);

		// Preserve target image
		let target = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
		ndops.assign(target, arr);

		// To fill with YCO
		let targetYco = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
		let mockImgYco = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);

		// Use to indicate finished components in image
		let doneMask = maskUtil.getArr(Uint8Array);

		// Use to indicate parts of image drawn correctly
		let errMask = maskUtil.getArr(Uint8Array);

		// Error threshold
		const totalPixels = width * height;
		const threshold = totalPixels * DecomposeModel.GOOD_ENOUGH_ERROR;
		let candidatesThisTime = 1000;
		let error = maskUtil.withoutDiffCount(imagestate,
										     DecomposeModel.WHITE,
										     DecomposeModel.FIDELITY);
		let iters = 0;

		// Component tolerance - increase per iteration
		let compoTol = DecomposeModel.TOLERANCE;

		// Width-loss sensitivity - sharpen per iteration
		let sens = DecomposeModel.W_SENS;

		let firstRun = true;

		while (error > threshold &&
			   candidatesThisTime > 1 &&
			   iters < DecomposeModel.MAX_ITERS) {

			// Sequentially decreasing median filter size to
			// Mimic monotonically decreasing attention to detail
			// TODO - k should start at 9 but median filter is broken for nontrivial case
			// (IGNORE TODO?) - Median filter takes too long anyway
			// 					and we might not need it
			let k = DecomposeModel.MAX_FILT;
			for (; k >= DecomposeModel.MIN_FILT; k -= 2) {

				candidates = [];

				// Run through median filter in YCoCg
				// ndops.assigns(imgTemp, 0);
				ImageUtils.convertColorSpace(imagestate, imagestate, 'YCoCg');
				ImageUtils.medianFilter(imgTemp, imagestate, k, 3);
				ImageUtils.convertColorSpace(imagestate, imgTemp, 'RGB');

				// Grab dominant colors
				// Evaluate components for dominant colors
				let palette = this.colorThief.getPalette(imagestate, 5, 8);

				let i;
				for (i = 0; i < palette.length; i++) {
					let color = palette[i];

					let scored = DecomposeModel.scoreComponents(imagestate,
																color,
																maskUtil,
																compoTol,
																error,
																doneMask);

					// Color score
					let j;
					for (j = 0; j < scored.length; j++) {
						candidates.push(scored[j]);
					}

				}

				candidates.sort(componentSortingFunction);
				candidatesThisTime = Math.min(candidates.length,
								DecomposeModel.COMPONENTS_EACH_STEP);

				let j;
				
				let compos = DecomposeModel.COMPONENTS_EACH_STEP;

				if (firstRun) {
					compos = 1;
				}
				
				// DEBUG
				// this.mp.p5_inst.createDiv("Next candidate step");

				const numToPop = Math.min(compos, candidates.length);
				for (i = 0; i < numToPop; i++) {
					let candidate = candidates.pop();
					
					// TODO - Check if this is even necessary
					let filled = maskUtil.fillHolesMut(candidate.arr);

					// Width, erosion (for polytrace), dilation (for subtraction)
					let widthObject = maskUtil.estimateWidth(filled, sens, DecomposeModel.MAX_W);

					// Cannibalize candidate.arr / orig for inner edges
					let innerEdges = candidate.arr;
					maskUtil.innerEdges(innerEdges, widthObject.erode);

					// Outer loop
					let outerPath = maskUtil.loopTrace(innerEdges);

					for (j = 0; j < outerPath.length; j++) {
						let simplePath = DecomposeModel.simplifyPath(outerPath[j]);
						DecomposeModel.renderPath(simplePath,
												  candidate.color,
												  widthObject.width,
												  scale, offsetX, offsetY);
					}

					// Mock-draw outer loop and grab thing or whatever
					let innerPath = maskUtil.fillInMut(widthObject.erode,
												innerEdges,
												widthObject.width);

					for (j = 0; j < innerPath.length; j++) {
						DecomposeModel.simplifyPath(innerPath[j]);
						DecomposeModel.renderPath(innerPath[j],
												  candidate.color,
												  widthObject.width,
												  scale, offsetX, offsetY);
					}

					// Push the dang index so the component goes entire.
					this.mp.MPState.newCheckpoint();

					// Mock-draw component
					// ImageUtils.mockDrawMut(imagestate,
										   // DecomposeModel.WHITE,
										   // widthObject.opened);
					ImageUtils.mockDrawMut(mockImg,
										   candidate.color,
										   widthObject.opened);

					// DEBUG
					// DecomposeModel.renderBinColor(widthObject.orig, candidate.color);

				}
				// END DRAW CANDIDATES

				firstRun = false;

			}
			// END FILTER LOOP

			// Decrease tolerance (desperation) per iteration
			compoTol *= DecomposeModel.TOL_MUL;
			sens *= 0.95;

			// Find out pixels we need to deal with
			ImageUtils.convertColorSpace(targetYco, target, 'YCoCg');
			ImageUtils.convertColorSpace(mockImgYco, mockImg, 'YCoCg');
			ImageUtils.sumSquaredExMask(errMask, targetYco, mockImgYco, DecomposeModel.FIDELITY);
			ndops.not(doneMask, errMask);

			// Write target to 
			ImageUtils.condAssign(imagestate, target, errMask, DecomposeModel.WHITE);

			error = ndops.sum(errMask);

			// DEBUG
			// p5_inst.createDiv('Error, Upcoming, Rendered');
			// DecomposeModel.renderBin(errMask);
			// DecomposeModel.render(imagestate);
			// DecomposeModel.render(mockImg);
			// console.log('Completed iteration', iters, 'of decomposition. Error:', error);

			iters++;
		}

		// console.log('Finished!');
		// if (error <= threshold) {
		// 	console.log('Error went beneath threshold:', error, "<=", threshold);
		// }
		// if (candidatesThisTime <= 1) {
		// 	console.log('Ran out of candidates');
		// }
		// if (iters >= DecomposeModel.MAX_ITERS) {
		// 	console.log('Exceeded maximum iterations');
		// }

	},

	// // debug only - convert 1-channel binary array to b/w color array
	// // multi: multiple to multiply instead of 255 (white) for greyscale
	// binToColor(arr, multi) {
	// 	let width = arr.shape[0];
	// 	let height = arr.shape[1];
	// 	let outputArr = new Uint8ClampedArray(width * height * 4);
	// 	let output = ndarray(outputArr, [width, height, 4]);

	// 	if (multi === undefined) {
	// 		multi = 255;
	// 	}

	// 	let x;
	// 	let y;
	// 	let ch;
	// 	let val;
	// 	for (x = 0; x < width; x++) {
	// 		for (y = 0; y < height; y++) {
	// 			val = arr.get(x, y) * multi;
	// 			for (ch = 0; ch < 3; ch++) {
	// 				output.set(x, y, ch, val);
	// 			}
	// 			output.set(x, y, 3, 255);
	// 		}
	// 	}

	// 	return output;
	// },

	// // debug only - convert 1-channel binary array to b/w color array
	// binToColorTransparent(arr, color) {
	// 	let width = arr.shape[0];
	// 	let height = arr.shape[1];
	// 	let outputArr = new Uint8ClampedArray(width * height * 4);
	// 	let output = ndarray(outputArr, [width, height, 4]);

	// 	let x;
	// 	let y;
	// 	let ch;
	// 	let val;
	// 	let pix;
	// 	for (x = 0; x < width; x++) {
	// 		for (y = 0; y < height; y++) {
	// 			val = arr.get(x, y);
	// 			if (val > 0) {
	// 				for (ch = 0; ch < 3; ch++) {
	// 					pix = color[ch];
	// 					output.set(x, y, ch, pix);
	// 				}
	// 				output.set(x, y, 3, 255);
	// 			}
	// 			else {
	// 				for (ch = 0; ch < 4; ch++) {
	// 					pix = color[ch];
	// 					output.set(x, y, ch, val);
	// 				}
	// 				output.set(x, y, 3, 0);
	// 			}
	// 		}
	// 	}

	// 	return output;
	// },

	// // Debug only - render ndarray
	// render(arr) {
	// 	let url = DecomposeModel.toDataURL(arr);
	// 	p5_inst.createImg(url);
	// },

	// // Debug only - render binary ndarray
	// renderBin(arr, multi) {
	// 	let arr3 = DecomposeModel.binToColor(arr, multi);
	// 	let url = DecomposeModel.toDataURL(arr3);
	// 	p5_inst.createImg(url);
	// },

	// // Debug only - render binary ndarray with color
	// renderBinColor(arr, color) {
	// 	let arr3 = DecomposeModel.binToColorTransparent(arr, color);
	// 	let url = DecomposeModel.toDataURL(arr3);
	// 	p5_inst.createImg(url);
	// }
}

module.exports = {
	DecomposeModel,
}

