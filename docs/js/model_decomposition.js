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

const DecomposeModel = {

	TOLERANCE: 0.01,
	SCORE_CUTOFF_PERCENT: 0.02,

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
		canvas.width = arr.shape[0];
		canvas.height = arr.shape[1];

		// TODO - what about image larger than canvas?

		let imgdata = context.getImageData(0, 0, canvas.width, canvas.height);
		let i = imgdata.data.length;
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

			

		}

		// Binary masks / candidates
		OUTER.candidates = candidates;

	},

	// debug only - convert 1-channel binary array to b/w color array
	binToColor(arr, multi) {
		let width = arr.shape[0];
		let height = arr.shape[1];
		let output = ndarray(new Uint8ClampedArray(width * height * 4), [width, height, 4]);

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
