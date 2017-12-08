/*
	SVG Builder for ReDRAW.
	A nice bit of convenienence code for line-only SVG string creation.
	Testable, etc.

	Zicheng Gao
*/

var SVGBuilder = function(width, height) {
	let preamble = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
	preamble += "<svg version=\"1.1\" ";
	preamble += "width=\"" + width + "px\" "
	preamble += "height=\"" + height + "px\" ";
	preamble += "viewBox=\"0 0 " + width + " " + height + "\">\n";
	this.string = preamble;

	const linePreamble = "<line fill=\"none\" ";
	const circlePreamble = "<circle ";

	// rgb is a 3-list
	this.rgbToHex = function(rgb) {
		let ret = "#";
		let i;
		let numStr;
		for (i = 0; i < rgb.length; i++) {
			numStr = rgb[i].toString(16);
			// Pad for small numbers
			if (numStr.length < 2) {
				ret += "0" + numStr;
			}
			// Normal
			else if (numStr.length == 2) {
				ret += numStr;
			}
			// Clip to FF
			else {
				ret += "FF";
			}
		}
		return ret;
	}

	this.addStroke = function(strokeVec, size) {
		let startX = strokeVec[0];
		let startY = strokeVec[1];
		let endX = strokeVec[2];
		let endY = strokeVec[3];
		// Points
		if (endX == startX && endY == startY) {
			this.string += circlePreamble;
			this.string += "cx=\"" + startX + "\" ";
			this.string += "cy=\"" + startY + "\" ";
			this.string += "r=\"" + size / 2 + "\" ";
			this.string += "fill=\"" + this.rgbToHex(strokeVec[5]) + "\"";
			this.string += "/>\n";
		}
		// Lines
		else {
			this.string += linePreamble;
			this.string += "x1=\"" + startX + "\" ";
			this.string += "y1=\"" + startY + "\" ";
			this.string += "x2=\"" + endX + "\" ";
			this.string += "y2=\"" + endY + "\" ";
			this.string += "stroke=\"" + this.rgbToHex(strokeVec[5]) + "\" ";
			this.string += "stroke-width=\"" + size + "\" ";
			this.string += "stroke-miterlimit=\"10\" ";
			this.string += "/>\n";
		}
	}

	this.finish = function() {
		this.string += "</svg>\n";
		return this.string;
	}
}

module.exports = SVGBuilder;