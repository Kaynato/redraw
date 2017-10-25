// Set height and width of canvas
const canvas = document.getElementById('myCanvas');

const windowHeight = parseInt(window.innerHeight) - 200;;
const windowWidth = window.innerWidth;

canvas.width = windowWidth;
canvas.height = windowHeight;

// Load input files
const imageLoader = document.getElementById('file-input');
imageLoader.addEventListener('change', uploadImage, false);

const ctx = canvas.getContext('2d');

// Upload image from local drive

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
            ctx.drawImage(img, parseInt(windowWidth) / 5, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

module.exports = {
    uploadImage,
};