/*
	Morphological operations. Or something.

	Similar to:
	https://github.com/mikolalysenko/ball-morphology/blob/master/morphology.js

	But we allow specification of target, arr
	similar to ndops operations.

	Also, avoids opening / closing for better direct management.

	Zicheng Gao
*/

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
