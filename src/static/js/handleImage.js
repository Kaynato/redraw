var imageLoader = document.getElementById('file-input');
imageLoader.addEventListener('change', handleImage, false);

var canvas = document.getElementById('myCanvas');
var ctx = canvas.getContext('2d');

// Upload image from local drive
function handleImage(e){
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function() {
            canvas.width = window.innerWidth;
            canvas.height = 1000;
            ctx.drawImage(img,0,0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

// Set height and width of canvas
var canvas = document.getElementById('myCanvas');

canvas.width = window.innerWidth
canvas.height = window.innerHeigh;
