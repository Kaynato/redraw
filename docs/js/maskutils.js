/*
	Algorithms for binary arrays (ndarray).

	An original object should be instantiated
		with a certain size and max padding
		to properly set up temp arrays
		and prevent excessive allocation.

	All operations which mutate the inputted
		array are postfixed with mut.
*/

var MaskUtils = function(width, height, maxPadding) {

	this.width = width;
	this.height = height;
	this.size = width * height;
	this.shape = [width, height];
	this.tempUint8 = (function(obj) {
		let arr = new Uint8Array(obj.size);
		return ndarray(arr, obj.shape);
	})(this);

	// Special values for labelling algorithms
	this.UNVISITED = -1;
	this.EMPTY = 0;

	this.maxPadding = maxPadding;
	this.padHeight = 2 * this.maxPadding + this.height;
	this.padWidth = 2 * this.maxPadding + this.width;
	this.paddedSize = this.padWidth * this.padHeight;
	this.paddedShape = [this.padWidth, this.padHeight];

	// Temp array of padded dimensions
	this.paddedTemp = (function(obj){
		let arr = new Float32Array(obj.paddedSize);
		return ndarray(arr, obj.paddedShape);
	})(this);

	// Easy array allocation of mask size
	this.getArr = function(arrType) {
		let arr = new arrType(this.size);
		return ndarray(arr, this.shape);
	};

	// Mutating operation.
	this.fakeGaussianMut = function(arr) {
		// Mimicked Gaussian Filter
		// For smooting.
		let z;
		let tmp;
		for (x = 1; x < this.width; x++) {
			for (y = 1; y < this.height; y++) {
				tmp = 0;
				tmp += 2 * arr.get(x - 1, y);
				tmp += 2 * arr.get(x + 1, y);
				tmp += 2 * arr.get(x, y - 1);
				tmp += 2 * arr.get(x, y + 1);
				tmp += 0.7 * arr.get(x - 1, y - 1);
				tmp += 0.7 * arr.get(x + 1, y + 1);
				tmp += 0.7 * arr.get(x + 1, y - 1);
				tmp += 0.7 * arr.get(x - 1, y + 1);
				z = 12;

				if (x > 2) {
					tmp += 0.7 * arr.get(x - 2, y);
					z += 1;
				}

				if (x + 2 < width) {
					tmp += 0.7 * arr.get(x + 2, y);
					z += 1;
				}

				if (y > 2) {
					tmp += 0.7 * arr.get(x, y - 2);
					z += 1;
				}

				if (y + 2 < width) {
					tmp += 0.7 * arr.get(x, y + 2);
					z += 1;
				}

				if (tmp > (z * 0.7)) {
					arr.set(x, y, 1);
				}
				else if (tmp < (z * 0.3)) {
					arr.set(x, y, 0);
				}
			}
		}
	};

	this.withinDiff = function(arr, color, tolerance) {
		// Tolerance image (binary mask)
		let maskArr = new Float32Array(width * height);
		let mask = ndarray(maskArr, [width, height]);
		let val;
		let tmp;
		let pix;
		let x;
		let y;
		let ch;
		for (x = 0; x < this.width; x++) {
			for (y = 0; y < height; y++) {
				val = 0;
				for (ch = 0; ch < 3; ch++) {
					pix = arr.get(x, y, ch);
					tmp = pix - color[ch];
					tmp /= 255.0;
					tmp *= tmp;
					val += tmp;
				}
				if (val < tolerance) {
					mask.set(x, y, 1);
				}
			}
		}

		return mask;
	};

	/*
		Minor variation that differs enough to warrant separate implementation
		for optimization

		Counts pixels not within tolerance MSE of color.
	*/
	this.withoutDiffCount = function(arr, color, tolerance) {
		// Tolerance image (binary mask)
		let count = 0;
		let val;
		let tmp;
		let pix;
		let x;
		let y;
		let ch;
		for (x = 0; x < this.width; x++) {
			for (y = 0; y < height; y++) {
				val = 0;
				for (ch = 0; ch < 3; ch++) {
					pix = arr.get(x, y, ch);
					tmp = pix - color[ch];
					tmp /= 255.0;
					tmp *= tmp;
					val += tmp;
				}
				if (val >= tolerance) {
					count++;
				}
			}
		}

		return count;
	};

	/*
		Push coords [ix, iy] to stack if labelling is valid.
		That is, if arr is nonzero and labelArr is unvisited
			at that coordinate.

		Mutates stack.
	*/
	this.pushIfValidMut = function(labelArr, arr, ix, iy, stack) {
		let nonzero = arr.get(ix, iy) != 0;
		let unvisited = labelArr.get(ix, iy) == this.UNVISITED;
		if (nonzero && unvisited) {
			stack.push([ix, iy]);
		};
	};

	/*
		Depth-traversal component labelling starting from location
		Uses 8-connectivity.
	
		labelArr (ndarray): MUTATED
			Array containing mostly UNVISITED values.
			Write labels to this array.
		arr (ndarray): Input mask
		x, y (int): Coordinate to start from.
		label (int): Label to assign to this component.
		scores (Object): Accumulator for label(s).
		callback (function, optional): Callback taking in popped coord.
			If undefined, don't use.
			Takes (coord, label).
	*/
	this.labelComponentMut = function(labelArr, arr, x, y, label, scores, callback) {
		let stack = [[x, y]];
		const hasCallback = (callback !== undefined);

		// Allocate stack-assigned indices
		let ix;
		let iy;
		let coord;

		// Use 8-connectivity
		let hasN;
		let hasS;
		let hasE;
		let hasW;
		while (stack.length > 0) {
			coord = stack.pop();
			if (hasCallback) {
				callback(coord, label);
			}
			ix = coord[0];
			iy = coord[1];

			// In order to minimize call stack growth and
			// We fully write out each part of this procedure.

			// Could compact by using arrays and loops
			// But it is better to unroll those loops.
			// But JS is interpreted, so we can't rely on a nonexistent compiler.
			hasN = iy > 0;
			hasE = ix + 1 < this.width;
			hasS = iy + 1 < this.height;
			hasW = ix > 0;
			if (hasN) {
				this.pushIfValidMut(labelArr, arr, ix    , iy - 1, stack);
			}
			if (hasN && hasE) {
				this.pushIfValidMut(labelArr, arr, ix + 1, iy - 1, stack);
			}
			if (hasE) {
				this.pushIfValidMut(labelArr, arr, ix + 1, iy    , stack);
			}
			if (hasE && hasS) {
				this.pushIfValidMut(labelArr, arr, ix + 1, iy + 1, stack);
			}
			if (hasS) {
				this.pushIfValidMut(labelArr, arr, ix    , iy + 1, stack);
			}
			if (hasS & hasW) {
				this.pushIfValidMut(labelArr, arr, ix - 1, iy + 1, stack);
			}
			if (hasW) {
				this.pushIfValidMut(labelArr, arr, ix - 1, iy    , stack);
			}
			if (hasN && hasW) {
				this.pushIfValidMut(labelArr, arr, ix - 1, iy - 1, stack);
			}
			
			// If it was pushed into this stack, it was definitely valid
			labelArr.set(ix, iy, label);
			scores[label]++;
		}
		
		// At this point we know it's unvisited and pix = 1.
	};

	/*
		Label connected components on binary mask ndarray
	*/
	this.labelComponents = function(arr) {
		let x;
		let y;

		let labels = 1;
		let scores = {0: 0};

		// Fill with labels
		let outputArr = new Int16Array(this.width * this.height);
		outputArr.fill(this.UNVISITED);
		let output = ndarray(outputArr, [this.width, this.height]);

		let val;
		let pix;
		for (x = 0; x < this.width; x++) {
			for (y = 0; y < this.height; y++) {
				pix = arr.get(x, y);
				val = output.get(x, y);
				// If pix is 0 then we don't care
				if (pix == 0) {
					output.set(x, y, this.EMPTY);
					scores[0]++;
					continue;
				}
				// Otherwise, if pix was 1, check if new
				if (val == this.UNVISITED) {
					// New label
					scores[labels] = 0;
					this.labelComponentMut(output, arr, x, y, labels, scores);
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
	};

	/*
		Unpads a padded array.
	*/
	this.centerOf = function(arr) {
		return arr.lo(this.padding, this.padding).hi(this.width, this.height);
	};

	/*
		Estimate width of brush to best draw component
		arr (ndarray): binary mask of component
		temp (ndarray, opt): temporary array for calculation.
			is allocated if none is passed in.
	*/
	this.estimateWidth = function(arr, sens) {
		// TODO: More sensible magic number?
		// Detects sudden dropoff of fidelity after opening
		const threshold = ndops.sum(arr) * sens;

		// TODO - move allocation outside. We only ever use one at a time
		// So we can avoid piling up the garbage.

		// Padded "framed" array to dilate from
		let paddedArr = new Float32Array(this.paddedSize);

		// Stretch pad.
		paddedArr.fill(1);

		let padded = ndarray(paddedArr, this.paddedShape);
		ndops.assign(this.centerOf(padded), arr);

		// Will contain erosion(s)
		let erodeArr = new Float32Array(this.paddedSize);
		let erode = ndarray(erodeArr, this.paddedShape);

		// Will contain opening(s)
		let openedArr = new Float32Array(this.paddedSize);
		let opened = ndarray(openedArr, this.paddedShape);

		// To mutate and transform, etc
		let temp = this.paddedTemp;

		// TODO - there must exist a more efficient algorithm!
		// Investigate dt() ?

		// Preliminary closing
		// const closingRadius = DecomposeModel.CLOSING_RADIUS;
		// ndops.assign(temp, padded);
		// Morphology.dilate(temp, temp, closingRadius);
		// Morphology.erosion(padded, temp, closingRadius);

		let error = 0;
		let w;
		for (w = 2; w < DecomposeModel.MAX_W; w++) {
			// Erode padded with radius w 
			ndops.assign(temp, padded);
			Morphology.erosion(erode, temp, w);
			ndops.assign(temp, erode);
			Morphology.dilate(opened, temp, w);

			// tmp contains closing (thus has fewer pixels)
			ndops.sub(this.centerOf(temp), this.centerOf(padded), this.centerOf(opened));
			error = ndops.sum(this.centerOf(temp));

			if (error > threshold) {
				// We actually want the previous...
				w--;
				break;
			}
		}

		// Now we have the correct w
		// Did one more operation than necessary, but we'll fix later
		// (TODO)
		ndops.assign(temp, padded);
		Morphology.erosion(erode, temp, w - 0.5);
		ndops.assign(temp, erode);
		Morphology.dilate(opened, temp, w - 0.5);

		// return the eroded image and the chosen width
		return {
			'width': w,
			'erode': this.centerOf(erode),
			'opened': this.centerOf(opened),
			'orig': this.centerOf(padded),
		};

	};

	/*
		Fill holes with novel seashore algorithm (invented here?)

		Mutates arr.
	*/
	this.fillHolesMut = function(arr, percentage) {
		// TODO!

		// Use temp to guide labeling image.

		return arr;
	};

	/*
		Convert arr to inner edge image.
		4-connectivity.
		Write to output.
	*/
	this.innerEdges = function(output, arr) {
		ndops.assigns(output, 0);

		// Self is 1 && Any 4-connected neighbor is 0
		//   -> set output to 1
		let val;
		for (x = 0; x < this.width; x++) {
			for (y = 0; y < this.height; y++) {
				val = arr.get(x, y);
				if (val > 0) {

					// TODO - might want to clean up later

					// Any boundary element is edge
					if (!(y > 0)) {
						output.set(x, y, 1);
						continue;
					};
					if (!(x + 1 < this.width)) {
						output.set(x, y, 1);
						continue;
					};
					if (!(y + 1 < this.height)) {
						output.set(x, y, 1);
						continue;
					};
					if (!(x > 0)) {
						output.set(x, y, 1);
						continue;
					};

					// Definitely not boundary
					val = arr.get(x, y-1);
					if (val == 0) {
						output.set(x, y, 1);
						continue;
					}
					val = arr.get(x+1, y);
					if (val == 0) {
						output.set(x, y, 1);
						continue;
					}
					val = arr.get(x, y+1);
					if (val == 0) {
						output.set(x, y, 1);
						continue;
					}
					val = arr.get(x-1, y);
					if (val == 0) {
						output.set(x, y, 1);
						continue;
					}
				}
			}
		}
		return arr;
	};

	/*
		Trace loops, returning closed path around loop
		Inbuilt segment simplifier.

		Follows the assumption that loops are connected.

		arr (ndarray): edge image

		Return array of arrays.
	*/
	this.loopTrace = function(arr) {

		// Use the temp array for labels, since we won't output it.
		let temp = this.tempUint8;
		ndops.assigns(temp, 0);
		
		// We use a weird traversal rule so we can't use labelComponentMut.
		let paths = [];

		// Tracer object for loopTrace
		// One at a time! So, one ever, with non-concurrent usage
		const tracer = {
			prevCoord: undefined,
			segAngle: undefined,
			path: [],

			// Stack to push traversal coords to
			// Doesn't have to do immediately with prevCoord
			stack: [],

			// TODO - nice indexing for relative traversal push rule
			// Basically a const
			traversal: undefined,

			// Resets tracer with this [x, y]
			init: function(coord) {
				this.prevCoord = coord;
				this.path = [coord];
				this.segAngle = undefined;
				this.stack = [coord];
				// up
				this.direction = 0;
			},

			// Update with new coord
			// Might write to paths (array)
			update: function(next) {
				// If NEXT is not adjacent to this.prevCoord
				// break off segment and start new segment (TODO)
				// return

				// Otherwise, we know we are adjacent

				// If angle not set, set angle
				// TODO

				// Our cone is the current direction we're going
				// A cautionary example is [...---''']
				// How to tell that moving NE is ok?
				// Raycasting??????

				// Start of cone is actually this.path[0]
				// If we are "getting out" of our "cone" (TODO)
				// break off seg and start new seg (TODO)
				// return

				// Otherwise, just set prev to next
			}
		};

		let x;
		let y;
		let val;
		let lbl;
		let loopLabel = 0;
		for (x = 0; x < width; x++) {
			for (y = 0; y < height; y++) {
				val = arr.get(x, y);
				lbl = temp.get(x, y);

				// Newly encountered loop
				if (val == 1 && lbl == 0) {
					loopLabel++;
					tracer.init([x, y]);

					// TODO
					// Begin path creation!
					// Depth Traversal with Relative Direction rule
					// For going up, push order (backwards traversal) is
					// S SW SE W E NW NE N
					// There should be a way of using indices to make offsets.

					// while tracer.stack has stuff {
						// coord = tracer.stack.pop();
						// tracer.update(coord);
						// tracer.traverse(); // pushes valid neighbours
						// temp.set(coord[0], coord[1], loopLabel);
					// }


				}
			}
		}

		return paths;
	};

	/**
	 * Takes a binary mask and writes stripes across it with specified brush width.
	 * @param {ndarray} binaryMask the binary component mask
	 */
	this.stripMaskMut = function(arr, brushWidth) {
		const radius = (brushWidth >> 1) + 1;

		// Find bbox
		let yMin = this.height;
		let yMax = 0;
		let xMin = this.width;
		let xMax = 0;

		let x;
		let y;
		let val;
		for (x = 0; x < this.width; x++) {
			for (y = 0; y < this.height; y++) {
				val = arr.get(x, y);
				if (val > 0) {
					// Write out instead of using Math.min for optimization?
					if (y < yMin) {
						yMin = y;
					}
					if (y > yMax) {
						yMax = y;
					}
					if (x < xMin) {
						xMin = x;
					}
					if (x > xMax) {
						xMax = x;
					}
				}
			}
		}

		const boxWidth = xMax - xMin;
		const boxHeight = yMax - yMin;

		let paths = [];
		let path = [];
		let writeTo = arr;
		let ix;
		let iy;
		// Scanning order matters!
		if (boxHeight <= boxWidth) {
			// X-axis is major
			for (y = 0; y < this.height; y++) {
				for (x = 0; x < this.width; x++) {
					val = arr.get(x, y);
					if (val > 0) {
						// Append startpoint
						path = [[x, y]];
						
						while (val > 0) {
							// Underestimate neighbor culling
							for (iy = x - radius; iy < x + radius; iy++) {
								arr.set(x, iy, 0);
							}
							// Exceed condition prevents obtaining val
							// Must check before arr.get
							x++;
							if (x >= this.width) {
								break;
							}
							val = arr.get(x, y);
						}
						// Want last valid x
						x--;

						// Append endpoint
						path.push([x, y]);
						paths.push(path);
					}
				}
			}
		}
		else {
			// Y-axis is major
			for (x = 0; x < this.width; x++) {
				for (y = 0; y < this.height; y++) {
					val = arr.get(x, y);
					if (val > 0) {
						// Append startpoint
						path = [[x, y]];
						
						while (val > 0) {
							// Underestimate neighbor culling
							for (ix = x - radius; ix < x + radius; ix++) {
								arr.set(ix, y, 0);
							}
							// Exceed condition prevents obtaining val
							// Must check before arr.get
							y++;
							if (y >= this.height) {
								break;
							}
							val = arr.get(x, y);
						}
						// Want last valid y
						y--;

						// Append endpoint
						path.push([x, y]);
						paths.push(path);
					}
				}
			}
		}

		return paths;
	};

	/*
		Finish the job!

		leftovers is the pre-looptrace brush guide mask.
		erode it with width and then do striping.
	
		Return array of arrays.
	*/
	this.fillInMut = function(leftovers, innerEdges, brushWidth) {
		let temp = this.tempUint8;

		// Erode with width first
		Morphology.dilate(temp, innerEdges, brushWidth);
		ndops.noteq(temp);

		// Array gets "cut down" by simulated brush
		ndops.andeq(leftovers, temp);

		return this.stripMaskMut(leftovers, brushWidth);
	};

}

