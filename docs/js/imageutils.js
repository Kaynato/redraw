/*
	Utilities for [H, W, C(4)] images.

	Requires ndarray.

	Zicheng Gao
*/

const ImageUtils = {
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

		if (k % 2 == 0 || k < 1) {
			throw Error('Median filter must be of odd dimensions');
		}

		const width = arr.shape[0];
		const height = arr.shape[1];
		const radius = k >> 1;
		
		let channels;
		if (forceChannels !== undefined) {
			channels = Math.min(arr.shape[2], forceChannels);
		}
		else {
			channels = arr.shape[2];
		}

		var output;
		// Allocate output array
		if (outputArr === undefined) {
			output = ndarray(new Uint8ClampedArray(arr.data.length), arr.shape);
			output.data.fill(255);
		}
		else {
			output = outputArr;
		}

		// Center of median filter window
		let x = 0;
		let y = 0;

		// Construct counting bins for each channel
		var bins = [];
		let ch;
		for (ch = 0; ch < channels; ch++) {
			bins.push(new MedianIntBin(256));
		}

		// Allocation of window starting (=) / ending (<) coords
		let x0 = 0;
		let y0 = 0;
		let x1 = 0;
		let y1 = 0;

		// Allocation of indexing offset variables for [X, Y, C] image tensor
		let ix = 0;
		let iy = 0;

		// TODO? Consider refactoring the follow 3 functions to
		// A more functional form - doWithPixel(func1(arr, ix, iy)?)

		// Add pixel from input at ix, iy to bins
		const addPixelBin = function(input, ix, iy) {
			let pix;
			let ch;
			for (ch = 0; ch < channels; ch++) {
				pix = input.get(ix, iy, ch);
				bins[ch].addValue(pix);
			}
		};

		// Add pixel from input at ix, iy to bins
		const subPixelBin = function(input, ix, iy) {
			let pix;
			let ch;
			for (ch = 0; ch < channels; ch++) {
				pix = input.get(ix, iy, ch);
				bins[ch].subValue(pix);
			}
		};

		// Mutating function - write median to output
		const writeMedian = function(output, ix, iy) {
			let ch;
			let pix;
			for (ch = 0; ch < channels; ch++) {
				pix = bins[ch].getMedian();
				output.set(ix, iy, ch, pix);
			}
		};

		// Window moves down, then right
		while (x < width) {
			// Reset y-coordinate
			y = 0;

			// Reset counters
			for (ch = 0; ch < channels; ch++) {
				bins[ch].flush();
			}

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
					addPixelBin(arr, ix, iy);
				}
			}

			// Initialize and index medians
			for (ch = 0; ch < channels; ch++) {
				bins[ch].index();
			}

			writeMedian(output, x, y);
			y++;

			// console.log('Begin median filter loop');
			
			// At this point we don't subtract from our bins.
			while (y < radius) {
				y1 = y + radius;
				// New pixels being introduced into bins
				for (ix = x0; ix < x1; ix++) {
					addPixelBin(arr, ix, y1);
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
					subPixelBin(arr, ix, y0);
					addPixelBin(arr, ix, y1);
				}
				writeMedian(output, x, y);
				y++;
			}

			// Only remove pixels from bins
			while (y < height) {
				y0 = y - radius;
				// Drop pixels at back of window
				for (ix = x0; ix < x1; ix++) {
					subPixelBin(arr, ix, y0);
				}
				writeMedian(output, x, y);
				y++;
			}

			// Go right one step
			x++;
		}

		console.log('Finished applying median filter of dimension', k);

		return output;
	},

	/*
		Set img to color where mask is there

		img: [H, W, 4], MUTATED
		mask: [H, W]
		color: [3]
	*/
	setImgColByMaskMut(img, color, mask) {
		const width = img.shape[0];
		const height = img.shape[1];
		const channel = img.shape[1];
		let x;
		let y;
		let ch;
		let val;
		let pix;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				val = mask.get(x, y);
				if (val) {
					for (ch = 0; ch < 3; ch++) {
						pix = color[ch];
						img.set(x, y, ch, pix);
					}
					img.set(x, y, 3, 255);
				}
			}
		}
	},

}