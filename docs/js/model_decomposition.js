"use strict";
/**
 * @module model_decompostion.js
 * Decomposition network. Loaded with TensorFire.
 * Neural network currently held off due to ongoing training and TensorFire wrangling.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

// DEBUG
var OUTER = {
	l: []
};

const Morphology = {
	// Mutating operation
	dilate(target, arr, radius) {
		dt(arr, 2);
		ndops.leqs(target, arr, radius);
	},

	// Mutating operation
	erosion(target, arr, radius) {
		ndops.not(target, arr);
		Morphology.dilate(target, target, radius);
		ndops.noteq(target);
	}
}

const Kernels = {
	// 5 by 5 sobel kernel
	SOBEL_5_X: (function() {
		const arr = [1,  2, 0,  -2,  -1,
					 4,  8, 0,  -8,  -4,
					 6, 12, 0, -12,  -6,
					 4,  8, 0,  -8,  -4,
					 1,  2, 0,  -2,  -1];
		const typedArr = new Int8Array(arr);
		let ker = ndarray(typedArr, [5, 5]);
		ker = ker.transpose(1, 0);
		return ker;
	})(),

	SOBEL_5_Y: (function() {
		const arr = [-1, -4,  -6, -4, -1,
					 -2, -8, -12, -8, -2,
					  0,  0,   0,  0,  0,
					  2,  8,  12,  8,  2,
					  1,  4,   6,  4,  1];
		const typedArr = new Int8Array(arr);
		let ker = ndarray(typedArr, [5, 5]);
		ker = ker.transpose(1, 0);
		return ker;
	})()
}

const DecomposeModel = {

	// Tolerance for color error when looking for binary masks
	TOLERANCE: 0.01,

	// Score cutoff for ignoring components
	SCORE_CUTOFF_PERCENT: 0.02,

	// How many components to draw each step
	COMPONENTS_EACH_STEP: 5,

	// Max width allowable for estimation
	MAX_W: 21,

	// Percentage loss which is unacceptable (lower = more accurate)
	W_SENS: 0.04,

	// For smoothing in lieu of median filter
	CLOSING_RADIUS: 5,

	// Harris corner detector free variable
	HARRIS_VAR: 0.08,

	/*
		Convert image into a tensor.
		Uses a temporary canvas to store data.
	*/
	imageToTensor(img) {
		let canvas = document.createElement('canvas');
		let context = canvas.getContext('2d');
		canvas.width = img.width || img.naturalWidth;
		canvas.height = img.height || img.naturalHeight;
		context.drawImage(img.elt, 0, 0);
		let imgdata = context.getImageData(0, 0, img.width, img.height);

		const width = imgdata.width;
		const height = imgdata.height;
		let channels = imgdata.data.length / (imgdata.width * imgdata.height);

		let tensor = ndarray(imgdata.data, [imgdata.width, imgdata.height, channels]);

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
		Convert from RGB color space into YCoCg color space or vice versa.
		In-place operation.
		Could use WebGL to speed up in future.

		arr (ndarray): Image data to convert
		destColorSpace(string): 'RGB' or 'YCoCg' describing destination color space.
		outputArr (ndarray, optional): If present, write to this array
	*/
	convertColorSpace(arr, destColorSpace, outputArr) {
		var output;
		// Allocate output array
		if (outputArr === undefined) {
			output = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
			output.data.fill(255);
		}
		else {
			output = outputArr;
		}

		const width = arr.shape[0];
		const height = arr.shape[1];
		let x = 0;
		let y = 0;

		let r = 0;
		let g = 0;
		let b = 0;

		let co = 0;
		let tmp = 0;
		let cg = 0;
		let luma = 0;
		
		// Necessary duplication of inner loop for optimization
		// One check on the outside vs checks at each inner loop
		if (destColorSpace == 'YCoCg') {
			for (x = 0; x < width; x++) {
				for (y = 0; y < height; y++) {
					r = arr.get(x, y, 0);
					g = arr.get(x, y, 1);
					b = arr.get(x, y, 2);
					tmp = (r + b) >> 2;
					luma = (g >> 1) + tmp;
					co = 128 + ((r >> 1) - (b >> 1));
					cg = 128 + (g >> 1) - tmp;
					output.set(x, y, 0, luma);
					output.set(x, y, 1, co);
					output.set(x, y, 2, cg);
				}
			}
		}
		else if (destColorSpace == 'RGB') {
			for (x = 0; x < width; x++) {
				for (y = 0; y < height; y++) {
					luma = arr.get(x, y, 0);
					co = arr.get(x, y, 1) - 128;
					cg = arr.get(x, y, 2) - 128;
					r = luma - cg + co;
					g = luma + cg;
					b = luma - cg - co;
					output.set(x, y, 0, r);
					output.set(x, y, 1, g);
					output.set(x, y, 2, b);
				}
			}
		}
		else {
			throw Error(destColorSpace.join(" is not a valid destination color space!"))
		}

		return output;
	},

	/*
		Apply a square median filter of dimension k * k to array.

		Uses moving histogram binning to avoid k*k checks per instance.

		arr (ndarray): Contains image info
		k (int): Dimension of filter
		forceChannels (int, optional): If present, force channels to this value
		outputArr (ndarray, optional): If present, write to this array
	*/
	medianFilter(arr, k, forceChannels, outputArr) {
		if (k == 1) {
			return arr;
		}

		const width = arr.shape[0];
		const height = arr.shape[1];
		
		let channels;
		if (forceChannels !== undefined) {
			channels = Math.min(arr.shape[2], forceChannels);
		}
		else {
			channels = arr.shape[2];
		}

		const radius = k >> 1;

		var output;
		// Allocate output array
		if (outputArr === undefined) {
			output = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
			output.data.fill(255);
		}
		else {
			output = outputArr;
		}

		if (k % 2 == 0 || k < 1) {
			throw Error('Median filter must be of odd dimensions');
		}

		// Center of median filter window
		let x = 0;
		let y = 0;

		// Construct counting bins for each channel
		var bins = [];
		var binCount = new Uint32Array(channels);
		let ch = 0;
		for (; ch < channels; ch++) {
			bins.push(new Uint32Array(256));
		}

		// Median index trackers - must be initialized.

		// Index of midpoint corresponds to median value
		var binMedian = new Int32Array(channels);

		// Index "within" midpoint bin
		var binMedOffset = new Int32Array(channels);

		// Window moves down, then right

		// Allocation of window starting (=) / ending (<) coords
		let x0 = 0;
		let y0 = 0;
		let x1 = 0;
		let y1 = 0;

		// Allocation of indexing offset variables for [X, Y, C] image tensor
		let ix = 0;
		let iy = 0;

		// Mutating function - add pixel to bin
		const addPixelBin = function(ix, iy, mediansIndexed) {
			let ch = 0;
			for (; ch < channels; ch++) {
				// Increment value in target bin
				let pix = arr.get(ix, iy, ch);
				bins[ch][pix]++;
				binCount[ch]++;
				if (mediansIndexed) {
					// Added value smaller than median, decr median
					if (pix < binMedian[ch]) {
						binMedOffset[ch]--;
						// Dropped below floor of bin, go to prev
						if (binMedOffset[ch] < 0) {
							binMedian[ch]--;
							while (bins[ch][binMedian[ch]] == 0) {
								binMedian[ch]--;
							}
							// Reappear at top of nonempty bin
							binMedOffset[ch] = bins[ch][binMedian[ch]] - 1;
						}
					}
				}
			}
		}

		// Mutating function - remove pixel from bin
		const subPixelBin = function(ix, iy, mediansIndexed) {
			let ch = 0;
			for (; ch < channels; ch++) {
				// Increment value in target bin
				let pix = arr.get(ix, iy, ch);
				bins[ch][pix]--;
				binCount[ch]--;
				if (mediansIndexed) {
					// If removed value smaller, incr median
					if (pix < binMedian[ch]) {
						binMedOffset[ch]++;
						// Exceeded bin, go to next bin
						if (binMedOffset[ch] >= bins[ch]) {
							binMedian[ch]++;
							while (bins[ch][binMedian[ch]] == 0) {
								binMedian[ch]++;
							}
							// Reappear at bottom of nonempty bin
							binMedOffset[ch] = 0;
						}
					}
				}
			}
		}

		// Mutating function - write median to output
		const writeMedian = function(output, ix, iy) {
			let ch = 0;
			let pix;
			for (; ch < channels; ch++) {
				pix = binMedian[ch];
				output.set(ix, iy, ch, pix);
			}
		}

		while (x < width) {
			// Reset y-coordinate
			y = 0;

			// Reset counters
			let ch = 0;
			for (; ch < channels; ch++) {
				bins[ch].fill(0);
			}
			binCount.fill(0);
			binMedian.fill(0);
			binMedOffset.fill(0);

			// Initial y = 0 run to populate histogram bins
			// Doesn't change during the x-loop
			x0 = Math.max(0, x - radius);
			x1 = Math.min(x + radius + 1, width);

			// This changes during the x-loop
			y0 = 0; // Special value due to top boundary
			y1 = radius + 1; // Special value due to top boundary

			// console.log('Begin initial bin fill with window', x0, x1, y0, y1);
			for (ix = x0; ix < x1; ix++) {
				for (iy = y0; iy < y1; iy++) {
					addPixelBin(ix, iy, false);
				}
			}

			// console.log('Setup initial median indexing');

			// Initialize and index medians
			for (ch = 0; ch < channels; ch++) {
				// Target index is half of total (median)
				let target = binCount[ch] >> 1;
				// Accumulator
				let acc = 0;
				// Indexing variable
				let medianI = 0;
				// Find bin which takes us over target
				let binVal = bins[ch][medianI];
				while (acc + binVal < target) {
					acc += bins[ch][medianI];
					medianI++;
				}
				binMedian[ch] = medianI;
				// Offset is remainder "inside" the bin
				// Mathematical correctness from loop invariant ensures
				// That we will never "exceed" the bin in question
				binMedOffset[ch] = target - acc;
			}

			writeMedian(output, x, y);
			y++;

			// console.log('Begin median filter loop');
			
			// At this point we don't subtract from our bins.
			while (y < radius) {
				y1 = y + radius;
				// New pixels being introduced into bins
				for (ix = x0; ix < x1; ix++) {
					addPixelBin(ix, y1, true);
				}
				writeMedian(output, x, y);
				y++;
			}

			// Add and subtract from bins with moving window over image
			while (y < height - radius) {
				y0 = y - radius;
				y1 = y + radius;
				// Drop / add pixels at back and front of window
				for (ix = x0; ix < x1; ix++) {
					subPixelBin(ix, y0, true);
					addPixelBin(ix, y1, true);
				}
				writeMedian(output, x, y);
				y++;
			}

			// Only remove pixels from bins
			while (y < height) {
				y0 = y - radius;
				// Drop pixels at back of window
				for (ix = x0; ix < x1; ix++) {
					subPixelBin(ix, y0, true);
				}
				writeMedian(output, x, y);
				y++;
			}

			x++;
		}

		return output;
	},

	/*
		Convert [W * H * C] image array into data url.

		arr
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
		Label connected components on ndarray
	*/
	labelComponents(arr) {
		let x;
		let y;

		let labels = 1;
		let scores = {0: 0};

		// Enums
		let UNVISITED = -1;
		let EMPTY = 0;

		const width = arr.shape[0];
		const height = arr.shape[1];

		let outputArr = new Int16Array(width * height);
		outputArr.fill(UNVISITED);
		let output = ndarray(outputArr, [width, height]);

		// Stack-Recursive component labelling
		const labelOutput = function(target, input, x, y, label, scores) {
			let val = target.get(x, y);
			let pix = input.get(x, y);
			let stack = [];

			stack.push([x, y]);

			const pushIfValid = function(target, input, ix, iy, stack) {
				let labelled = input.get(ix, iy) != 0;
				let unvisited = target.get(ix, iy) == UNVISITED;
				if (labelled && unvisited) {
					stack.push([ix, iy]);
				}
			}

			// Allocate stack-assigned indices
			let ix;
			let iy;
			let coord;
			// UP RIGHT DOWN LEFT SELF
			while (stack.length > 0) {
				coord = stack.pop();
				ix = coord[0];
				iy = coord[1];

				// In order to minimize call stack growth and
				// Prevent issues due to closures,
				// We must fully write out each part of this procedure
				if (iy > 0) {
					pushIfValid(target, input, ix, iy - 1, stack);
				}
				if (ix + 1 < width) {
					pushIfValid(target, input, ix + 1, iy, stack);
				}
				if (iy + 1 < height) {
					pushIfValid(target, input, ix, iy + 1, stack);
				}
				if (ix > 0) {
					pushIfValid(target, input, ix - 1, iy, stack);
				}
				
				// If it was pushed into this stack, it was definitely valid
				target.set(ix, iy, label);
				scores[label]++;
			}
			
			// At this point we know it's unvisited and pix = 1.
			// console.log('Finished labelling from', x, y);
		};

		let val;
		let pix;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				pix = arr.get(x, y);
				val = output.get(x, y);
				// If pix is 0 then we don't care
				if (pix == 0) {
					output.set(x, y, EMPTY);
					scores[0]++;
					continue;
				}
				// Otherwise, if pix was 1, check if new
				if (val == UNVISITED) {
					// New label
					scores[labels] = 0;
					labelOutput(output, arr, x, y, labels, scores);
					labels += 1;
				}
				// Otherwise, don't bother
			}
		}

		console.log("Finished component labelling.");

		return {
			"arr": output,
			"labels": labels,
			"scores": scores
		};
	},

	/*
		Determine largest connected component of the target color
	*/
	calcScoredComponents(arr, color) {
		let width = arr.shape[0];
		let height = arr.shape[1];
		// input channels = 3

		// Tolerance image (binary mask)
		let tol_img = ndarray(new Float32Array(width * height), [width, height]);

		let x;
		let y;
		let ch;
		let val;
		let tmp;
		let pix;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				val = 0;
				for (ch = 0; ch < 3; ch++) {
					pix = arr.get(x, y, ch);
					tmp = pix - color[ch];
					tmp /= 255.0;
					tmp *= tmp;
					val += tmp;
				}
				if (val < DecomposeModel.TOLERANCE) {
					tol_img.set(x, y, 1);
				}
			}
		}

		// Mimicked Gaussian Filter
		// For averaging
		let z;
		for (x = 1; x < width; x++) {
			for (y = 1; y < height; y++) {
				tmp = 0;
				tmp += 2 * tol_img.get(x - 1, y);
				tmp += 2 * tol_img.get(x + 1, y);
				tmp += 2 * tol_img.get(x, y - 1);
				tmp += 2 * tol_img.get(x, y + 1);
				tmp += 0.7 * tol_img.get(x - 1, y - 1);
				tmp += 0.7 * tol_img.get(x + 1, y + 1);
				tmp += 0.7 * tol_img.get(x + 1, y - 1);
				tmp += 0.7 * tol_img.get(x - 1, y + 1);
				z = 12;

				if (x > 2) {
					tmp += 0.7 * tol_img.get(x - 2, y);
					z += 1;
				}

				if (x + 2 < width) {
					tmp += 0.7 * tol_img.get(x + 2, y);
					z += 1;
				}

				if (y > 2) {
					tmp += 0.7 * tol_img.get(x, y - 2);
					z += 1;
				}

				if (y + 2 < width) {
					tmp += 0.7 * tol_img.get(x, y + 2);
					z += 1;
				}

				if (tmp > (z * 0.7)) {
					tol_img.set(x, y, 1);
				}
				else if (tmp < (z * 0.3)) {
					tol_img.set(x, y, 0);
				}
			}
		}

		let blobs = DecomposeModel.labelComponents(tol_img);

		// DEBUG ONLY
		// p5_inst.createDiv(color);
		// DecomposeModel.renderBin(tol_img);

		OUTER.blobs = blobs;

		const threshold = DecomposeModel.SCORE_CUTOFF_PERCENT * width * height;
		let components = [];
		let label;
		for (label = 1; label < blobs.labels; label++) {
			let score = blobs.scores[label];

			// Don't even bother if it's not big enough
			if (score < threshold) {
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
			// DecomposeModel.renderBin(component);

			components.push({
				'score': score,
				'arr': component,
				'color': color
			});
		}

		return components;
	},

	componentSortingFunction(a, b) {
		return a.score - b.score;
	},

	/*
		Estimate width of brush to best draw component
		arr (ndarray): binary mask of component
		temp (ndarray, opt): temporary array for calculation.
			is allocated if none is passed in.
	*/
	estimateWidth(arr, temp) {

		// TODO: Pad arr with MAX_W on all sides
		const width = arr.shape[0];
		const height = arr.shape[1];

		// TODO: More sensible magic number?
		// Detects sudden dropoff of fidelity after opening
		const threshold = ndops.sum(arr) * DecomposeModel.W_SENS;

		// Allocate temporary array
		const padding = DecomposeModel.MAX_W;
		const padHeight = 2 * padding + height;
		const padWidth = 2 * padding + width;

		const centerOf = function(arr) {
			return arr.lo(padding, padding).hi(width, height);
		}

		// TODO - move allocation outside. We only ever use one at a time
		// So we can avoid piling up the garbage.

		const paddedSize = padWidth * padHeight;
		const paddedShape = [padWidth, padHeight];
		
		// Padded "framed" array to dilate from
		let paddedArr = new Float32Array(paddedSize);

		// Stretch pad.
		paddedArr.fill(1);

		let padded = ndarray(paddedArr, paddedShape);
		ndops.assign(centerOf(padded), arr);

		// Will contain erosion(s)
		let erodeArr = new Float32Array(paddedSize);
		let erode = ndarray(erodeArr, paddedShape);

		// Will contain opening(s)
		let openedArr = new Float32Array(paddedSize);
		let opened = ndarray(openedArr, paddedShape);

		// To mutate and transform, etc
		const allocateTemp = !(temp !== undefined);
		if (allocateTemp) {
			let tempArr = new Float32Array(paddedSize);
			let temp_ = ndarray(tempArr, paddedShape);
			temp = temp_;
		}

		let error = 0;
		// TODO - there must exist a more efficient algorithm!

		// Preliminary closing
		const closingRadius = DecomposeModel.CLOSING_RADIUS;
		ndops.assign(temp, padded);
		Morphology.dilate(temp, temp, closingRadius);
		Morphology.erosion(padded, temp, closingRadius);

		let w;
		for (w = 2; w < DecomposeModel.MAX_W; w++) {
			// Erode padded with radius w 
			ndops.assign(temp, padded);
			Morphology.erosion(erode, temp, w);
			ndops.assign(temp, erode);
			Morphology.dilate(opened, temp, w);

			// tmp contains closing (thus has fewer pixels)
			ndops.sub(centerOf(temp), centerOf(padded), centerOf(opened));
			error = ndops.sum(centerOf(temp));

			if (error > threshold) {
				break;
				// We actually want the previous...
			}
		}

		let ret = {
			'width': w, 
			'erode': centerOf(erode),
			'opened': centerOf(opened),
			'orig': centerOf(padded),
		};

		if (allocateTemp) {
			ret.temp = temp;
		}

		// return the eroded image and the chosen width
		return ret;

	},

	/*
		Take in a binary mask array and return harris corners.
		Uses 5 by 5 filter.
	
		arr (ndarray) contains binary component mask
	*/
	identifyCorners(arr) {
		const width = arr.shape[0];
		const height = arr.shape[1];
		const radius = 2; // for 5 x 5

		// Eigenvalues
		let eigen;

		// Actual output
		let corners;

		// Cast to float
		let srcArray = new Float32Array(width * height);
		let src = ndarray(srcArray, [width, height]);

		// Apply sobel filter via convolution, with zero-padding

		let dxArray = new Float32Array(width * height);
		let dx = ndarray(dxArray, [width, height]);
		// TODO convolve src with Kernels.SOBEL_5_X into dx

		let dyArray = new Float32Array(width * height);
		let dy = ndarray(dyArray, [width, height]);
		// TODO convolve src with Kernels.SOBEL_5_Y into dy

		// Calculate covariance
		let covArray = new Float32Array(width * height * 3);
		let cov = ndarray(covArray, [width, height]);
		let x;
		let y;
		let dxVal;
		let dyVal;
		let dxx;
		let dxy;
		let dyy;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				dxVal = dx.get(x, y);
				dyVal = dy.get(x, y);
				dxx = dxVal * dxVal;
				dxy = dxVal * dyVal;
				dyy = dyVal * dyVal;
				cov.set(x, y, 0, dxx);
				cov.set(x, y, 1, dxy);
				cov.set(x, y, 2, dyy);
			}
		}

		// TODO Apply simple box blur

		// TODO Apply harris filter

		// TODO Use eigenvalues to focus on peaks

		// TODO threshold peaks

		// TODO Identify peaks and push to corners

		return corners;
	},

	/**
	 * Takes a binary mask and strips it.
	 * @param {ndarray} binaryMask the binary component mask
	 */
	stripMask(binaryMask) {
		// TODO: NONE OF THIS IS RIGHT...PLS FIX
		// Find the bbox, this is definately not right.....
		const width = binaryMask.shape[0];
		const height = binaryMask.shape[1];
		const radius = 2; // for 5 x 5
		let x;
		let y;

		// Determine which axis of bbox is longer
		if (width < height) {
			// Set all coords from ([x-r ... x+r-1],y) to 0
			for (x = x - radius; x < x + radius - 1; x++) {
				binaryMask.set(x, y, 0); 
			}
		} 
		else {
			// Set all coords from (x,[y-r ... y+r-1]) to 0
			for (y = y - radius; y < y + radius - 1; y++) {
				binaryMask.set(x, y, 0); 
			}
		}

		// Move back to pixel that was last equal to a val of 1, again not right...
		let pix = null;
		while (pix != 1) { 
			for (x = 0; x < width; x++) { // width is not what t shoudl iterate thourgh
				for (y = 0; y < length; y++) { // similarly should not be length either
					pix = binaryMask.get(x,y);
				}
			}
		}
		// console.log(pix);
		return binaryMask;
	},

	/*
		Convert image array to descriptive strokes.

		arr (ndarray) contains channeled image information
		imageData (HTMLImageElement) contains hidden <img> for image
	*/
	imageToStrokes(arr, imageData) {

		// Stack of unscored candidate components
		let candidatesUnscored = [];
		// Stack of scored candidate components
		let candidates = [];

		// Sequentially decreasing median filter size to
		// Mimic monotonically decreasing attention to detail
		// TODO - k should start at 9 but median filter is broken for nontrivial case
		let k = 1;
		for (; k >= 1; k -= 2) {

			// Run through median filter in YCoCg
			let yco = DecomposeModel.convertColorSpace(arr, 'YCoCg');
			let filteredYco = DecomposeModel.medianFilter(yco, k, 3);
			let filtered = DecomposeModel.convertColorSpace(filteredYco, 'RGB');
			let dataURL = DecomposeModel.toDataURL(filtered);
			imageData.src = dataURL;

			// Grab dominant colors
			let colorThief = new ColorThief();
			let palette = colorThief.getPalette(imageData);

			console.log(palette);

			let i;
			for (i = 0; i < palette.length; i++) {
				let color = palette[i];

				let scoredComponents = DecomposeModel.calcScoredComponents(filtered, color);

				// Color score
				let j;
				for (j = 0; j < scoredComponents.length; j++) {
					candidates.push(scoredComponents[j]);
				}

			}

			candidates.sort(DecomposeModel.componentSortingFunction);

			let estObject;
			let candidate;
			let temp;
			let corners;
			OUTER.drawns = [];
			OUTER.corners = [];
			for (i = 0; i < DecomposeModel.COMPONENTS_EACH_STEP; i++) {
				candidate = candidates.pop();
				
				// TODO - preliminary closing?

				// Width, erosion (for polytrace), dilation (for subtraction)
				estObject = DecomposeModel.estimateWidth(candidate.arr, temp);

				OUTER.drawns.push(estObject);

				// Pass back to avoid excessive allocation
				temp = estObject.temp;
				
				corners = DecomposeModel.identifyCorners(estObject.erode);
				// TODO?
				OUTER.corners.push(corners);

			}


		}

		// Binary masks / candidates

	},

	// debug only - convert 1-channel binary array to b/w color array
	binToColor(arr, multi) {
		let width = arr.shape[0];
		let height = arr.shape[1];
		let outputArr = new Uint8ClampedArray(width * height * 4);
		let output = ndarray(outputArr, [width, height, 4]);

		if (multi === undefined) {
			multi = 255;
		}

		let x;
		let y;
		let ch;
		let val;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				val = arr.get(x, y) * multi;
				for (ch = 0; ch < 3; ch++) {
					output.set(x, y, ch, val);
				}
				output.set(x, y, 3, 255);
			}
		}

		return output;
	},

	// Debug only - render ndarray
	render(arr) {
		let url = DecomposeModel.toDataURL(arr);
		p5_inst.createImg(url);
	},

	// Debug only - render binary ndarray
	renderBin(arr, multi) {
		let arr3 = DecomposeModel.binToColor(arr, multi);
		let url = DecomposeModel.toDataURL(arr3);
		p5_inst.createImg(url);
	}
}

if (isNode) {
	module.exports = {
		DecomposeModel,
	}
}
