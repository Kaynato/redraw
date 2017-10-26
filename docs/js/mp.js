/**
  mp.js
  Defines the multipurpose panel state and handles UI interaction.

  Should be loaded after the network interfaces are exposed.
*/

/* DEFINE ARBITRARILY-DETERMINED GLOBAL VARIABLES */

// Definition of data stored in MPState state (array)
const DataIndices = {
  startX: 0,
  startY: 1,
  endX: 2,
  endY: 3,
  width: 4,
  colorR: 5,
  colorG: 6,
  colorB: 7
}

let MPState = {
  WIDTH: 640,
  HEIGHT: 480,

  // Despite ndarray being loaded, using the dynamically altered
  // linkedlist-like array is easier for us here.
  // We can simply use ndpack to convert to ndarray when calling
  // the network.
  state: [],

  // Determines mode.
  generating: false,

  // The index sits at the next-written position.
  // We display all vectors up to, but not including the position.
  strokeIndex: 0,

  // This index sits at the next available empty position.
  // If we overwrite anything, we should set this to strokeIndex.
  // Otherwise, this serves as an upper limit on 
  dataIndex: 0,

  inBounds(startX, startY, endX, endY) {
    return startX >= 0 && startX <= this.WIDTH &&
        startY >= 0 && startY <= this.HEIGHT &&
        endX >= 0 && endX <= this.WIDTH &&
        endY >= 0 && endY <= this.HEIGHT;
  },

  /*
    Add a stroke to the state.
    p: p5 instance
    lineSize: Number - describes width
    color: p5.Color - describes color
  */
  addStroke(startX, startY, endX, endY, lineSize, color) {
    if (this.inBounds(startX, startY, endX, endY)) {
      newStroke = [startX, startY, endX, endY, lineSize];
      newStroke.push(color.levels.slice(0, 3));
      this.state.push(newStroke);
      this.strokeIndex++;
      this.dataIndex++;
    }

  },

  /**
    Get current stroke.
  */
  getCurrentStroke() {
    if (this.strokeIndex > 0)
      return this.state[this.strokeIndex - 1];
    else
      return null;
  },

  /**
    Get all visible strokes.
  */
  getVisibleStrokes() {
    return this.state.slice(0, this.strokeIndex);
  },

  /* Getter for "generating" */
  isGenerating() {
    return this.generating;
  },

  /**
    Step stroke index backward.
    Returns whether the operation was effective.
  */
  back() {
    if (this.strokeIndex > 0) {
      this.strokeIndex--;
      return true;
    } else {
      return false;
    }
  },

  /*
    Step stroke index forward or call the generator network.
    Returns whether the operation was effective.
  */
  forward() {
    if (this.isGenerating()) {
      // predictVector / nextStroke - update SDD
      stroke = GenerateModel.nextStroke(this.state)

      // Single stroke addition.
      this.addStroke(stroke.startX, stroke.startY,
                     stroke.endX, stroke.endY,
                     stroke.width,
                     stroke.colorR, stroke.colorG, stroke.colorB);
    } else {
      if (this.strokeIndex < this.dataIndex) {
        this.strokeIndex++;
        return true;
      } else {
        return false;
      }
    }
  },

}

/**
  Function definition for p5 object.
*/
function sketch_process(p) {

  let canvas = null;
  let color = null;
  let sizeSlider = null;
  let lineSize = 1;

  p.setup = function() {
    canvas = p.createCanvas(640, 480);
    lineSize = 5;
    color = p.color(0, 0, 0, 255);

    // For now, it's probably better to fix opacity and width.
    // They aren't anywhere in our SDS.
    sizeSlider = p.createSlider(0, 10, lineSize);

    canvas.parent("canvas-holder");
    p.predraw();
  }

  // Additional function for non-interfering setup
  p.predraw = function() {
    p.strokeWeight(1);
    p.rect(1, 0, 638, 479);
    p.strokeWeight(lineSize);
  }

  p.draw = function() {

  }

  p.mouseDragged = function() {
    lineSize = sizeSlider.value();
    p.strokeWeight(lineSize);
    p.stroke(color);
    p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
    MPState.addStroke(p.pmouseX, p.pmouseY,
                      p.mouseX, p.mouseY,
                      lineSize, color);
  }

  p.resetCanvas = function() {
    p.clear();
    p.predraw();
    // Don't call setup since we'll proliferate sliders, etc.
  }

  p.getSize = function() {
    return lineSize;
  }

  /*
    Draw a stroke as described by in vector form.
  */
  p.drawStroke = function(strokeVec) {
    p5_inst.stroke(strokeVec[DataIndices.colorR],
                   strokeVec[DataIndices.colorG],
                   strokeVec[DataIndices.colorB]);
    p5_inst.line(strokeVec[DataIndices.startX],
                 strokeVec[DataIndices.startY],
                 strokeVec[DataIndices.endX],
                 strokeVec[DataIndices.endY]);
  }
}

// Instantiate the p5js instance.
const p5_inst = new p5(sketch_process);

/* DEFINE BUTTON CALLBACKS */
function seekBackward() {
  MPState.back();
  strokes = MPState.getVisibleStrokes();
  p5_inst.resetCanvas();
  for (var i = 0; i < strokes.length; i++) {
    p5_inst.drawStroke(strokes[i]);
  }

}

function seekForward() {
  MPState.forward();
  stroke = MPState.getCurrentStroke();
  p5_inst.drawStroke(stroke);
}

function togglePlay() {
  throw new Error("Not implemented!");
}




// Load input files
// const imageLoader = document.getElementById('file-input');
// const ctx = canvas.getContext('2d');

// imageLoader.addEventListener('change', uploadImage, false);

// /**
//  * Uploads an image (PNG, GIF, JPEG, etc.) from the local drive
//  * @param {*} e 
//  */
// async function uploadImage(e){
//     const reader = new FileReader();
//     reader.onload = function(event){
//         const img = new Image();
//         img.onload = function() {
//             canvas.width = windowHeight;
//             canvas.height = windowHeight;
//             ctx.drawImage(img, 0, 0);
//         }
//         img.src = event.target.result;
//     }
//     reader.readAsDataURL(e.target.files[0]);
// }

