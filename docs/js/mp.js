/**
  mp.js
  Defines the multipurpose panel state and handles UI interaction.

  Should be loaded after the network interfaces are exposed.
*/

/* DEFINE ARBITRARILY-DETERMINED GLOBAL VARIABLES */

// Amount of rows to pre-allocate for State Tensor.
const ROWS = 64;

// Definition of data stored in MPState state array (tensor)
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
  // This is something like an arraylist.
  // Each row should store a line segment and auxillary data.
  // Since we are using this form of data storage,
  // Using OOP paradigms are too costly for consistent use.
  array: ndarray(new Float64Array(8 * ROWS), [ROWS, 8]),

  // Determines mode.
  generating: false,

  // The index sits at the next-written position.
  // We display all vectors up to, but not including the position.
  strokeIndex: 0,

  // This index sits at the next available empty position.
  // If we overwrite anything, we should set this to strokeIndex.
  // Otherwise, this serves as an upper limit on 
  dataIndex: 0,

  /*
    Add a stroke to the state.
    p: p5 instance
    lineSize: Number - describes width
    color: p5.Color - describes color
  */
  addStroke(startX, startY, endX, endY, lineSize, color) {
    // We must use the interface provided by ndarray :(
    // Thus, this code is unavoidably a bit messy...
    newStroke = this.array.pick(this.strokeIndex);
    newStroke.set(DataIndices.startX, startX);
    newStroke.set(DataIndices.startY, startY);
    newStroke.set(DataIndices.endX, endX);
    newStroke.set(DataIndices.endY, endY);
    newStroke.set(DataIndices.width, lineSize);
    newStroke.set(DataIndices.colorR, color.levels[0]);
    newStroke.set(DataIndices.colorG, color.levels[1]);
    newStroke.set(DataIndices.colorB, color.levels[2]);
    this.strokeIndex++;
    this.dataIndex++;
  },

  /**
    Get current stroke.
  */
  getCurrentStroke() {
    if (this.strokeIndex > 0)
      return this.array.pick(this.strokeIndex - 1);
    else
      return null;
  },

  /**
    Get all visible strokes.
  */
  getVisibleStrokes() {
    return this.array.hi(this.strokeIndex)
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
      stroke = GenerateModel.nextStroke(this.array)

      // Single stroke addition.
      this.addStroke(stroke.startX, stroke.startY,
                     stroke.endX, stroke.endY,
                     stroke.width,
                     stroke.colorR, stroke.G, stroke.B);
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

    canvas.parent("canvas-holder")
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

  p.drawStroke = function(strokeVec) {
    p5_inst.stroke(strokeVec.get(DataIndices.colorR),
                   strokeVec.get(DataIndices.colorG),
                   strokeVec.get(DataIndices.colorB));
    p5_inst.line(strokeVec.get(DataIndices.startX),
                 strokeVec.get(DataIndices.startY),
                 strokeVec.get(DataIndices.endX),
                 strokeVec.get(DataIndices.endY));
  }
}

// Instantiate the p5js instance.
const p5_inst = new p5(sketch_process);

/* DEFINE BUTTON CALLBACKS */
function seekBackward() {
  MPState.back();
  strokes = MPState.getVisibleStrokes();
  p5_inst.resetCanvas();
  for (let i = 0; i < strokes.shape[0]; i++) {
    stroke = strokes.pick(i);
    p5_inst.drawStroke(stroke);

    // Partially completed function - clean up code
    function accessStroke(index) {
      return strokes.get(i, index)
    }

    stroke = strokes;

    p5_inst.stroke(accessStroke(DataIndices.colorR),
                   accessStroke(DataIndices.colorG),
                   accessStroke(DataIndices.colorB));
    p5_inst.line(accessStroke(DataIndices.startX),
                 accessStroke(DataIndices.startY),
                 accessStroke(DataIndices.endX),
                 accessStroke(DataIndices.endY));
  }
  
}

function seekForward() {
  MPState.forward();
  stroke = MPState.getCurrentStroke();
  p5_inst.drawStroke(stroke);
}

