/* eslint-env node, mocha */
process.env.NODE_ENV = 'test';

// npm 
const chai = require('chai');

// local
const uploadImage = require('../docs/js/upload_image.js');

/* === Setup === */
const expect = chai.expect;
const assert = chai.assert;


describe('uploadImage', function() {
	// it('should accept proper image files', function(done) {
	// 	var mockImage =  { target: { files: ["./assets/square.png"] } }
	// 	uploadImage.uploadImage(mockImage, done);
	// });

	it('should silently reject invalid data input', function() {
		// var mockImage = {target: { files: ["./assets/not_image.png"] }}
		var mockImage = {target: undefined}
		uploadImage.uploadImage(mockImage);
	});

	it('should silently refuse empty input', function() {
		// var mockImage = {target: { files: ["./assets/not_image.png"] }}
		var mockImage = {target: {files: [undefined]}}
		uploadImage.uploadImage(mockImage);
	});

	// Further testing of uploadImage is untenable as it requires the FileReader interface which is not available in npm.
	// Forcing testing would require modification to clientside code which would defeat the purpose.
	// However - uploadImage is, luckily for us, simple enough to be verified.
});