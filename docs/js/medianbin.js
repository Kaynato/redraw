/*
	Median bin object for efficient median filter computation.

	Requires discrete integer values.

	Zicheng Gao
*/

var MedianIntBin = function(range) {
	this.range = range;

	this.bin = new Uint32Array(range);
	this.count = 0;

	this.median = 0;
	this.offset = 0;

	this.indexed = false;

	// Decrement median position
	this.decrMedian = function() {
		this.offset--;
		// If under bin, go to previous bin
		if (this.offset < 0) {
			this.median--;
			while (this.bin[this.median] == 0) {
				this.median--;
			}
			// Reappear at top of nonempty bin
			this.offset = this.bin[this.median] - 1;
		}
	};

	// Increment median position
	this.incrMedian = function() {
		this.offset++;
		// If exceeded bin, go to next bin
		if (this.offset >= this.bin) {
			this.median++;
			while (this.bin[this.median] == 0) {
				this.median++;
			}
			// Reappear at bottom of nonempty bin
			this.offset = 0;
		}
	};

	// "Insert" value to bin
	this.addValue = function(x) {
		// Increment bin value
		this.bin[x]++;

		// If we're not indexed, perform early return
		// (Makes code cleaner)
		if (!this.indexed) {
			this.count++
			return;
		}

		// If even items in bin, we're biased up
		if (this.count % 2 == 0) {
			// If biased up and add lower, go down
			if (x < this.median) {
				this.decrMedian();
			}
		}
		// Otherwise, odd, so median is middle
		else {
			// If in middle and add higher, go up
			if (x >= this.median) {
				this.incrMedian();
			}
		}

		this.count++;
	};

	// "Remove" value from bin
	this.subValue = function(x) {
		// Decrement bin value
		this.bin[x]--;

		// Early return for nonindexed condition for cleaner code
		if (!this.indexed) {
			this.count--;
			return;
		}

		// If even items in bin, biased up
		if (this.count % 2 == 0) {
			// If removing higher value or same bin, go down
			if (x >= this.median) {
				this.decrMedian();
			}
		}
		// Otherwise, odd, so median is middle
		else {
			// If removing same or less, bias (go) up
			if (x <= this.median) {
				this.incrMedian();
			}
		}
		this.count--;
	}

	this.getMedian = function() {
		if (this.indexed) {
			return this.median;
		}
		else {
			console.log("Attempted to retrieve median from non-indexed" +
						" Median Bin! Was this intentional?");
		}
	}

	// Reset median bin
	this.flush = function() {
		this.bin.fill(0);
		this.count = 0;
		this.median = 0;
		this.offset = 0;
		this.indexed = false;
	}

	// Index median
	this.index = function() {
		// Target index is half of total (median)
		let target = this.count >> 1;

		// Accumulator
		let acc = 0;

		// Indexing variable
		this.median = 0;

		// Find bin which, if added, takes us over target
		let binVal = this.bin[this.median];
		while (acc + binVal < target) {
			acc += this.bin[this.median];
			this.median++;
		}

		// Offset is remainder "inside" the bin
		// Mathematical correctness from loop invariant ensures
		// That we will never "exceed" the bin in question.
		this.offset = target - acc;

		// This is now indexed.
		this.indexed = true;
	}

	return this;
}
