"use strict";
/**
 * @module predict_vector.js
 * Generation network. Loaded with TensorFire.
 * Slated for release 2.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

// local
// import { MPState } from './mp.js';
// const mp = require('./mp.js');

const PredictUtils = {
	box_mueller_gaussian() {
	    var x = 0;
	    var y = 0;
	    const pi = Math.PI;
	    while(x === 0)
	    	x = Math.random();
	    while(y === 0)
	    	y = Math.random();
	    let a = Math.sqrt(-2.0 * Math.log(x));
	    let ret = a * Math.cos(2.0 * pi * y);
	    return ret;
	}
}

const GenerateModel = {

	/**
	 * Load model fron json dict files. 
	 */
	loadModel() {
		throw Error("No longer relevant!");
	},

	/**
	 * Predicts the next stroke based off previous strokes. 
	 * Update sonce we get TensorFire working. 
	 * 
	 * For continous calling, we probably want to avoid repeatedly using ndpack. 
	 * 
	 * @param {mp.object} mpState 
	 * @returns newStroke 	- a stroke object containing a startX, startY, endX, endY, width and color.
	 */
	nextStroke(mpState) {

		// Single stroke addition.
		let cur_stroke = mpState.getCurrentStroke();
		let est_radius = 50.0;
		const radius_jitter = 5.0;

		if (cur_stroke == null) {
			// Use random start location and curr color
			let red;
			let green;
			let blue;
			if(MPState.getRedDropperMode() != -1) {
				red = MPState.getRedDropperMode();
				green = MPState.getGreenDropperMode();
				blue = MPState.getBlueDropperMode();
	        }
	        else {
				red = MPState.sliderRed;
				green = MPState.sliderGreen;
				blue = MPState.sliderBlue;
	        }
			let rx = Math.random() * 640;
			let ry = Math.random() * 480;
			cur_stroke = [0, 0, rx, ry, 2.0, [red, green, blue]];
			est_radius = 50.0; // arbitrary
		} else {
			let dx = cur_stroke[2] - cur_stroke[0];
			let dy = cur_stroke[3] - cur_stroke[1];
			let jitter = radius_jitter * PredictUtils.box_mueller_gaussian();
			est_radius = Math.max(Math.min(Math.sqrt(dx * dx + dy * dy) + jitter, 80.0), 5.0);
		}

		let dx = PredictUtils.box_mueller_gaussian()*est_radius;
		let dy = PredictUtils.box_mueller_gaussian()*est_radius;
		if (dx + cur_stroke[2] > 640 || dx + cur_stroke[2] < 0)
			dx *= -1;
		if (dy + cur_stroke[3] > 640 || dy + cur_stroke[3] < 0)
			dy *= -1;
		
		const newStroke = {
			startX: cur_stroke[2], // start new endX value from endX value of previous vector
			startY: cur_stroke[3], // start new endY value from endY value of previous vector
			endX: cur_stroke[2] + dx,
			endY: cur_stroke[3] + dy,
			width: cur_stroke[4],
			color: {
				_array: [0,0,0,1],
				levels: [cur_stroke[5][0],
						 cur_stroke[5][1],
						 cur_stroke[5][2], 255],
				maxes: {
					hsb: [360, 100, 100, 1],
					hsl: [360, 100, 100, 1],
					rgb: [255,255,255,255]
				},
				mode: "rgb",
				name: "p5.Color"
			}
		};


		return newStroke;
		// Procedure:
		// 	1. Unpack the current state
		// 	2. Get the current stroke
		// 	3. Predict new stroke using random values
		// 	4. Check if the indicies of that stroke are within the window
		// 		a. If not, retry with a new vector
		// 	5. return new vector indicies
	}
}

if (isNode) {
  module.exports = {
    GenerateModel,
  }
}
