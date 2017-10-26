/**
 * @module uploadImage.js
 * Handles image upload
 */

// Set height and width of canvas
const canvas = document.getElementById('canvas-holder');

// Load input files
const imageLoader = document.getElementById('file-input');
const ctx = canvas.getContext('2d');

imageLoader.addEventListener('change', uploadImage, false);

/**
 * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive
 * @param {*} e 
 */
async function uploadImage(e){
    const reader = new FileReader();
    reader.onload = function(event){
        const img = new Image();
        img.onload = function() {
            canvas.width = windowHeight;
            canvas.height = windowHeight;
            ctx.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

module.exports = {
    uploadImage,
};