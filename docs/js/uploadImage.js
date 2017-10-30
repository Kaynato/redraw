// /**
//  * @module uploadImage.js
//  * 
//  * Handles image upload.
//  */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

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

/**
 * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive
 * @param {*} e 
 */
function uploadImage(e){
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            canvas.width = windowHeight;
            canvas.height = windowHeight;
            // ctx.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
    console.log('true')
}

if (isNode) {
    module.exports = {
        uploadImage,
    };
}