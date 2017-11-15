
var canvas = document.getElementById("canvas-holder");
var ctx = canvas.getContext("2d");

/* REGISTER DOWNLOAD HANDLER */
/* Only convert the canvas to Data URL when the user clicks.
   This saves RAM and CPU ressources in case this feature is not required. */
function exportData() {
  var dt = canvas.toDataURL('image/png');
  /* Change MIME type to trick the browser to downlaod the file instead of displaying it */
  dt = dt.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');

  /* In addition to <a>'s "download" attribute, you can define HTTP-style headers */
  dt = dt.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Canvas.png');

  this.href = dt;
};
document.getElementById("dl").addEventListener('click', dlCanvas, false);
