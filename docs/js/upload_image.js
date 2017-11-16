"use strict";
/**
 * @module upload_image.js
 *
 * Handles image upload.
 */


// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

if (!isNode && typeof p5_inst === "undefined") {
  throw Error();
}

// Set height and width of canvas
if (!isNode) {
  // Must declare using var to work around mocha
  var canvas = document.getElementById('canvas-holder');
  // Load input files
  var imageLoader = document.getElementById('file-input');
} else {
  // Mock objects - necessary in our case.
  var canvas = {width: 640, height: 480};
  var imageLoader = {
    listeners: [],
    addEventListener: function(eventName, func, useCapture) {
      this.listeners.push({"name": eventName, "func": func, "useCapture": useCapture})
    }
  };
}

// const ctx = canvas.getContext('2d');

imageLoader.addEventListener('change', uploadImage, false);

var debugvariable = [];
/**
 * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive
 * @param {*} e
 */
function uploadImage(e){
  // A FileList
  console.log(e.target);
  if (typeof e.target === "undefined") {
    return;
  }

  let file = e.target.files[0];
  let reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function(e) {
    // TODO - we'll need to not allocate for each new submission
    let img = p5_inst.createImg(e.target.result);
    img.hide();

    // TODO - call into model decomp
    // let p5img = p5_inst.image(img, 0, 0);

    // ProcessImage
    let tensor = DecomposeModel.imageToTensor(img);
    let strokes = DecomposeModel.imageToStrokes(tensor);
    // TODO - edit later. Maybe use point to sample from image.
    // Should probably even be inside the returned strokes.
    let temp_color = {levels: [0, 0, 0]};

    for (var i = 0; i < strokes.length; i++) {
      let stroke = strokes[i];
      console.log(stroke);
      MPState.addStroke(stroke[0], stroke[1], stroke[2], stroke[3], 5.0, temp_color);

      // Very, very buggy
      // Esp. stroke outside of MP...
      p5_inst.line(stroke[0], stroke[1], stroke[2], stroke[3]);
    }

    DecomposeModel.render2(DecomposeModel.interimModel(tensor));

  }
};

if (isNode) {
  module.exports = {
    uploadImage,
  };
}
