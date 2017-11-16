// "use strict";
// /**
//  * @module download_image.js
//  *
//  * Handles image download.
//  */
//
//
// // Is this being run by client or by npm?
// var isNode = (typeof global !== "undefined");
//
// if (!isNode && typeof p5_inst === "undefined") {
//   throw Error();
// }
//
// // Set height and width of canvas
// if (!isNode) {
//   // Must declare using var to work around mocha
//   var canvas = document.getElementById('canvas-holder');
//   // Load input files
//   var downloadImage = document.getElementById('dl');
// } else {
//   // Mock objects - necessary in our case.
//   var canvas = {width: 640, height: 480};
//   var downloadImage = {
//     listeners: [],
//     addEventListener: function(eventName, func, useCapture) {
//       this.listeners.push({"name": eventName, "func": func, "useCapture": useCapture})
//     }
//   };
// }
//
// downloadImage.addEventListener('change', exportData, false);
//
//
// function exportData(){
//
//
//   var canvas = document.getElementById('canvas-holder');
//   console.log(canvas);
//   // console.log(canvas);
//
//
// }
