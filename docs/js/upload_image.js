
"use strict";
/**
 * @module upload_image.js
 *
 * Handles image upload.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

/* istanbul ignore if*/
if (!isNode && typeof p5_inst === "undefined") {
  throw Error();
}

// Set height and width of canvas
/* istanbul ignore if*/
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

/**
 * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive.
 * 
 * When uploading an image, actually click the button to import the image, 
 * otherwise the import will not work properly.
 * 
 * @param {*} e - the file object
 * @param {*} callWhenLoaded - callback for when file loaded. Use for testing.
 *
 * Not unit-testable.
 */
function uploadImage(e, callWhenLoaded){
  
  let file = e.target.files[0];
  if (!file) {
    // If file is undefined (e.g. if you don't upload image despite opening window)
    // Fail gracefully and silently
    return;
  }

  /* istanbul ignore next */
  if (typeof(FileReader) !== undefined) {
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
      // Might want to take care of oversize images here: TODO?

      // Turn to 

      ndimgtoarr(e.target.result, function(err, img) {
        if (err) {
          if (!isNode) {
            alert("Unrecognized image data!");
          }
          throw Error("Invalid image data!");
        }

        // Strokes are appended from within DecomposeModel
        // This prevents long wait times during which nothing perceptible happens
        let tensor = DecomposeModel.imageToTensor(img);
        DecomposeModel.imageToStrokes(tensor);

      });

      if (callWhenLoaded !== undefined) {
        callWhenLoaded();
      }
    }
  }
};

module.exports = {
  uploadImage,
};
