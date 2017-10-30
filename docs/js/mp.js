"use strict";
// /**
//  * @module mp.js
//  * 
//  * Defines the multipurpose panel state and handles UI interaction. 
//  * Should be loaded after the network interfaces are exposed.
//  */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

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

  /**
   * Add a stroke to the state. 
   * @param {int} startX        
   * @param {int} startY 
   * @param {int} endX 
   * @param {int} endY 
   * @param {Number} lineSize       describes width
   * @param {p5.Color} color        describes color
   */
  addStroke(startX, startY, endX, endY, lineSize, color) {
    if (this.inBounds(startX, startY, endX, endY)) {
      let newStroke = [startX, startY, endX, endY, lineSize];
      newStroke.push(color.levels.slice(0, 3));
      this.state.push(newStroke);

      // Overwrite
      if (this.dataIndex > this.strokeIndex) {
        this.state = this.state.slice(0, this.strokeIndex)
      }

      this.strokeIndex++;
      this.dataIndex = this.strokeIndex;
    }

  },

  /**
   * Gets the current stroke from the canvas
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

  /* Setter for "generating" */
  setGenerating(val) {
    this.generating = val;
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

  /**
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
    sizeSlider.parent("size-slider");
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

// Because of the inclusion issue from mp.test.js, we have to unfortunately define these here
function MockDOMObject(obj) {
  // Compose over
  for (let property in Object.keys(obj)) {
    this[property] = obj[property];
  }

  this.parentDiv = "window";

  this.parent = function(divId) {
    this.parentDiv = divId;
  }

  this.value = function() {
    return 1;
  }

}

function MockP5(sketch_process) {
  this.canvas = null;
  this.slider = null;
  this.strokes = [];
  this.rectList = [];
  this.strokeColorProperty = {"levels": [0, 0, 0, 0]};
  this.strokeWidthProperty = 1;

  this.createCanvas = function(width, height) {
    this.canvas = new MockDOMObject({"width": width, "height": height});
    return this.canvas;
  }

  this.createSlider = function(min, max, step) {
    this.slider = new MockDOMObject({
      "min": min,
      "max": max,
      "step": step,
      value: function() {
        return 1;
      }
    });
    return this.slider;
  }

  // p5 functionality - no testing required
  this.color = function(r, g, b, a) {
    return {"levels": [r, g, b, a]};
  }

  this.clear = function() {
    // p5 - do not test
    this.strokes = [];
    this.rectList = [];
  }

  this.strokeWeight = function(weight) {
    // p5 - do not test
    this.strokeWidthProperty = weight;
  }

  this.stroke = function() {
    let colorArgs = arguments;
    switch (colorArgs.length) {
      case 1:
        this.strokeColorProperty = colorArgs[0];
        break;
      case 3:
        this.strokeColorProperty = {"levels": [colorArgs[0], colorArgs[1], colorArgs[2], 1]};
        break;
      case 4:
        this.strokeColorProperty = {"levels": [colorArgs[0], colorArgs[1], colorArgs[2], colorArgs[3]]};
        break;
    }
  }

  this.line = function(startX, startY, endX, endY) {
    this.strokes.push([startX, startY, endX, endY, this.strokeWidthProperty, this.strokeColorProperty]);
  }

  this.rect = function(left, top, right, bottom) {
    this.rectList.push([left, top, right, bottom]);
  }

  // Mouse parameters
  this.mouseX = 0;
  this.mouseY = 0;
  this.pmouseX = 0;
  this.pmouseY = 0;
  this.setMouse = function(newX, newY) {
    this.pmouseX = this.mouseX;
    this.pmouseY = this.mouseY;
    this.mouseX = newX;
    this.mouseY = newY;
  }

  sketch_process(this);
}


/////////////
// Instantiate the p5js instance.

var p5_inst = null;
if (!isNode) {
  p5_inst = new p5(sketch_process);
} else {
  p5_inst = new MockP5(sketch_process);
}

/* DEFINE BUTTON CALLBACKS */
function seekBackward() {
  MPState.back();
  let strokes = MPState.getVisibleStrokes();
  p5_inst.resetCanvas();
  for (var i = 0; i < strokes.length; i++) {
    p5_inst.drawStroke(strokes[i]);
  }

}

function seekForward() {
  if (MPState.forward()) {
    let stroke = MPState.getCurrentStroke();
    p5_inst.drawStroke(stroke);
  }
  
}

function togglePlay() {
  // Not slated for this release.
  throw new Error("Not implemented!");
}

function updateGenerateToggle() {
  // Cannot be auto-tested due to document interaction.
  let checkbox = document.getElementById('generate-toggle-box');
  MPState.setGenerating(checkbox.checked);
}

if (isNode) {
  module.exports = {
    p5_inst,
    MPState,
    sketch_process, 
    seekBackward,
    seekForward,
    togglePlay
  }
}
