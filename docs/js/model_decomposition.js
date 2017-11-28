"use strict";
/**
 * @module model_decompostion.js
 * 
 * Redraw raster image with vector line segments of width and color.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

// CHANGE AND GET RID OF MENTIONS OF "DEBUG" BEFORE MERGE WITH MASTER

// DEBUG
var OUTER = {
	l: []
};

const DecomposeModel = {

	// Tolerance for color error when looking for binary masks
	// Try higher values...? Might make a painterly feel.
	TOLERANCE: 0.01,

	// Score cutoff for ignoring components
	SCORE_CUTOFF_PERCENT: 0.02,

	// How many components to draw each step
	COMPONENTS_EACH_STEP: 5,

	// Max width allowable for estimation
	MAX_W: 21,

	// Percentage loss which is unacceptable (lower = more accurate)
	W_SENS: 0.05,

	// MUST BE INITIALIZED PER IMAGE.
	maskUtils: undefined,

	// max / min for median filter. greater maxfilt is the greater descent
	// in order of increasing detail from large inpainting
	MAX_FILT: 1,
	MIN_FILT: 1,

	// A color that either color thief ignores or we prohibit from the palette
	IGNORED_COLOR: [255, 255, 255],

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
		const data = imgdata.data;
		let channels = data.length / (width * height);

		let tensor = ndarray(data, [width, height, channels]);

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
	*/
	scoreComponents(arr, color, maskUtil) {
		let width = arr.shape[0];
		let height = arr.shape[1];
		// input channels = 3

		// Tolerance image (binary mask)
		let maskArr = new Float32Array(width * height);
		let mask = ndarray(maskArr, [width, height]);

		let x;
		let y;
		let ch;

		// All values in arr which have RGB MSE < Tolerance
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
					mask.set(x, y, 1);
				}
			}
		}

		// Smooth things out
		maskUtil.fakeGaussianMut(mask);

		// This allocates a new array
		let blobs = maskUtil.labelComponents(mask);

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

	/*
		RENDER THE PATH IN THE P5 CANVAS
		AND ADD IT TO THE MPSTATE.

		This allows us continuous play. I guess.
		It makes the wait more interesting. I guess.
	*/
	renderPath(path, color, width) {
		const pathLength = path.length;
		if (pathLength < 2) {
			console.log("Attempted to render a path with length < 2! " +
						"Was this intentional?");
			return;
		}

		const colorObj = {
			_array: [0,0,0,1],
			levels: [color[0], color[1], color[2], 255],
			maxes: {
				hsb: [360, 100, 100, 1],
				hsl: [360, 100, 100, 1],
				rgb: [255,255,255,255]
			},
			mode: "rgb",
			name: "p5.Color"
		};

		let i;
		let startX = path[0][0];
		let startY = path[0][1];
		let endX;
		let endY;
		let coord;
		for (i = 1; i < pathLength - 1; i++) {
			endX = path[i][0];
			endY = path[i][1];
			MPState.addStroke(startX, startY, endX, endY, width, color);
			const new_stroke = MPState.getCurrentStroke();
			const lineSize = MPState.getCurrentSize();
			p5_inst.drawStroke(new_stroke, lineSize);
			startX = endX;
			startY = endY;
		}

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

		// Strokes!
		let strokes = [];

		// Stack of unscored candidate components
		let candidatesUnscored = [];


		// Initialize a mask util object
		const width = arr.shape[0];
		const height = arr.shape[1];
		const maskUtil = new MaskUtils(width, height, DecomposeModel.MAX_W);

		const componentSortingFunction = function(a, b) {
			return a.score - b.score;
		};

		// Stack of scored candidate components
		let candidates;
		let imagestate;

		// Sequentially decreasing median filter size to
		// Mimic monotonically decreasing attention to detail
		// TODO - k should start at 9 but median filter is broken for nontrivial case
		// (IGNORE TODO?) - Median filter takes too long anyway
		// 					and we might not need it
		let k = DecomposeModel.MAX_FILT;
		for (; k >= DecomposeModel.MIN_FILT; k -= 2) {

			candidates = [];

			// Run through median filter in YCoCg
			let yco = ImageUtils.convertColorSpace(arr, 'YCoCg');
			let filteredYco = ImageUtils.medianFilter(yco, k, 3);
			let filtered = ImageUtils.convertColorSpace(filteredYco, 'RGB');
			let dataURL = DecomposeModel.toDataURL(filtered);
			imageData.src = dataURL;

			// DEBUG
			OUTER.filtered = filtered;
			DecomposeModel.render(filtered);

			imagestate = filtered;

			// Grab dominant colors
			// Evaluate components for dominant colors
			let i;
			let colorThief = new ColorThief();
			let palette = colorThief.getPalette(imageData);
			for (i = 0; i < palette.length; i++) {
				let color = palette[i];

				let scoredComponents = DecomposeModel.scoreComponents(filtered, color, maskUtil);

				// Color score
				let j;
				for (j = 0; j < scoredComponents.length; j++) {
					candidates.push(scoredComponents[j]);
				}

			}

			candidates.sort(componentSortingFunction);

			// DEBUG
			OUTER.drawns = [];
			OUTER.loopPaths = [];

			let toWhiten = maskUtil.getArr(Uint8Array);

			const sens = DecomposeModel.W_SENS;
			for (i = 0; i < DecomposeModel.COMPONENTS_EACH_STEP; i++) {
				let candidate = candidates.pop();
				
				// TODO - Check if this is even necessary
				let filled = maskUtil.fillHolesMut(candidate.arr);

				// Width, erosion (for polytrace), dilation (for subtraction)
				let widthObject = maskUtil.estimateWidth(filled, sens);
				OUTER.drawns.push(widthObject);

				// TODO - orig or opened? Which gives better results?
				ndops.oreq(toWhiten, widthObject.orig);

				// DEBUG
				p5_inst.createDiv(widthObject.width);
				DecomposeModel.renderBin(widthObject.orig);
				DecomposeModel.renderBin(widthObject.erode);
				DecomposeModel.renderBin(widthObject.opened);

				// Cannibalize candidate.arr / orig for inner edges
				let innerEdges = candidate.arr;
				maskUtil.innerEdges(innerEdges, widthObject.erode);

				// Outer loop
				let outerPath = maskUtil.loopTrace(innerEdges);
				// OUTER.loopPaths.push(outerPath);

				DecomposeModel.renderPath(outerPath);

				// Mock-draw outer loop and grab thing or whatever
				let innerPath = maskUtil.fillIn(widthObject.erode,
											innerEdges,
											widthObject.width);

				DecomposeModel.renderPath(innerPath);

				// Mock-draw component
				ImageUtils.setImgColByMaskMut(imagestate,
											  DecomposeModel.IGNORED_COLOR,
											  toWhiten);
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
