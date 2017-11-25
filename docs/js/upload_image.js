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

imageLoader.addEventListener('change', uploadImage, false);

var debugvariable = undefined;
/**
 * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive.
 * 
 * When uploading an image, actually click the button to import the image, 
 * otherwise the import will not work properly.
 * 
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
    debugvariable = e;
    let img = p5_inst.createImg(e.target.result).hide();
    p5_inst.image(img, 2, 2);
  }
};

if (isNode) {
  module.exports = {
    uploadImage,
  };
}
