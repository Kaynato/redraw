"use strict";
/**
 * @module mp.js
 *
 * Defines the multipurpose panel state and handles UI interaction.
 * Should be loaded after the network interfaces are exposed.
 */

// Is this being run by client or by npm?
var isNode = (typeof global !== "undefined");

/* DEFINE ARBITRARILY-DETERMINED GLOBAL VARIABLES */

// Definition of data stored in MPState state (array)
const DataIndices =
{
  startX: 0,
  startY: 1,
  endX: 2,
  endY: 3,
  width: 4,
  colorR: 5,
  colorG: 6,
  colorB: 7
}

let MPState =
{
  WIDTH: 640,
  HEIGHT: 480,

  // Despite ndarray being loaded, using the dynamically altered
  // linkedlist-like array is easier for us here.
  // We can simply use ndpack to convert to ndarray when calling
  // the network.
  sizes: [],
  state: [],
  colorsR: [],
  colorsG: [],
  colorsB: [],
  strokeIndices: [0],

  // Determines toggle mode.
  generating: false,
  play: false,
  eraser: false,
  color: false,
  fill: false,

  // Droper colors
  rdrop: -1,
  gdrop: -1,
  bdrop: -1,

  // Shapes
  shapeOption: null,

  // The index sits at the next-written position.
  // We display all vectors up to, but not including the position.
  strokeIndex: 0,

  // This index sits at the next available empty position.
  // If we overwrite anything, we should set this to strokeIndex.
  // Otherwise, this serves as an upper limit on
  dataIndex: 0,

  // All saved images in this session.
  savedImages: [],

  inBounds(startX, startY, endX, endY)
  {
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
  addStroke(startX, startY, endX, endY, lineSize, color)
  {
    if (this.inBounds(startX, startY, endX, endY))
    {
      let newStroke = [startX, startY, endX, endY, lineSize];
      newStroke.push(color.levels.slice(0, 3));
      this.state.push(newStroke);
      this.sizes.push(lineSize);
      this.colorsR.push(color.levels[0]);
      this.colorsG.push(color.levels[1]);
      this.colorsB.push(color.levels[2]);

      // Overwrite
      if (this.dataIndex > this.strokeIndex)
      {
        this.state = this.state.slice(0, this.strokeIndex)
        this.sizes = this.sizes.slice(0, this.strokeIndex)
        this.colorsR = this.colorsR.slice(0, this.strokeIndex)
        this.colorsG = this.colorsG.slice(0, this.strokeIndex)
        this.colorsB = this.colorsB.slice(0, this.strokeIndex)
      }

      this.strokeIndex++;
      this.dataIndex = this.strokeIndex;
    }

  },

  setStrokeIndex(val)
  {
    if (val < 0)
    {
      return null;
    }
    return this.strokeIndex = val;
  },

  setDataIndex(val)
  {
    if (val < 0)
    {
      return null;
    }
    return this.dataIndex = val;
  },

  /**
   * Gets the current stroke from the canvas
   */
  getCurrentStroke()
  {
    // console.log('Stroke Index: ' + this.strokeIndex);
    // console.log('Data Index: ' + this.dataIndex)
    // console.log(this.state)
    if (this.strokeIndex > 0)
    {
      return this.state[this.strokeIndex - 1];
    }
    else
    {
      return null;
    }
  },

  /**
    Get size of current stroke from the canvas
  */
  getCurrentSize()
  {
    if (this.strokeIndex > 0)
    {
      return this.sizes[this.strokeIndex - 1];
    }
    else
    {
      return null;
    }
  },

  /** Get all visible strokes. */
  getVisibleStrokes()
  {
    return this.state.slice(0, this.strokeIndex);
  },

  /** Get sizes of all visible strokes. */
  getVisibleSizes()
  {
    return this.sizes.slice(0, this.strokeIndex)
  },

  getVisibleReds()
  {
    return this.colorsR.slice(0, this.strokeIndex)
  },

  getVisibleGreens()
  {
    return this.colorsG.slice(0, this.strokeIndex)
  },

  getVisibleBlues()
  {
    return this.colorsB.slice(0, this.strokeIndex)
  },

  /**
   * Sets the red color of the strokes to the specified ones.
   * @param {array} colorsR   - red colors of the visible strokes
   */
  setVisibleReds(colorsR) {
    if (colorsR.length == 0) {
      return this.colorsR = [];
    }
    return this.colorsR = colorsR;
  },

  /**
   * Sets the green color of the strokes to the specified ones.
   * @param {array} colorsG   - green colors of the visible strokes
   */
  setVisibleGreens(colorsG) {
    if (colorsG.length == 0) {
      return this.colorsG = [];
    }
    return this.colorsG = colorsG;
  },

  /**
   * Sets the blue color of the strokes to the specified ones.
   * @param {array} colorsB   - blue colors of the visible strokes
   */
  setVisibleBlues(colorsB) {
    if (colorsB.length == 0) {
      return this.colorsB = [];
    }
    return this.colorsB = colorsB;
  },

  /**
   * Sets the visible strokes to specified ones.
   * @param {array} strokes   - strokes
   */
  setVisibleStrokes(strokes)
  {
    if (strokes.length == 0)
    {
      return this.state = [];
    }
    return this.state = strokes;
  },

  /**
   * Sets the visible stroke sizes to the specified ones.
   * @param {array} strokeSizes   - line sizes of the visible strokes
   */
  setVisibleSizes(strokeSizes)
  {
    if (strokeSizes.length == 0)
    {
      return this.sizes = [];
    }
    return this.sizes = strokeSizes;
  },

  /** Getter for all saved images in this session */
  getSavedImages()
  {
    return this.savedImages;
  },

  getState()
  {
    return this.state;
  },

  getSizes()
  {
    return this.sizes;
  },

  /** Getter for "generating". */
  isGenerating()
  {
    return this.generating;
  },

  /** Setter for "generating". */
  setGenerating(val)
  {
    this.generating = val;
  },

  /** Getter for "play". */
  isPlay()
  {
    return this.play;
  },

  /** Setter for "play". */
  setPlay(val)
  {
    this.play = val;
  },

  inEraserMode() {
    return this.eraser;
  },

  setEraserMode(val) {
    this.eraser = val;
  },

  inFillMode() {
    return this.fill;
  },

  setFillMode(val) {
    this.fill = val;
  },

  setColorMode(val) {
    this.color = val;
  },

  getColorMode(val) {
    return this.color;
  },

  setRedDropperMode(val) {
    this.rdrop = val;
  },

  getRedDropperMode(val) {
    return this.rdrop;
  },

  setGreenDropperMode(val) {
    this.gdrop = val;
  },

  getGreenDropperMode(val) {
    return this.gdrop;
  },

  setBlueDropperMode(val) {
    this.bdrop = val;
  },

  getBlueDropperMode(val) {
    return this.bdrop;
  },

  getShapeOption() {
    return this.shapeOption;
  },

  setShapeOption(val) {
    if (val < 0) {
      return this.shapeOption = null;
    }
    this.shapeOption = val;
  },

  /**
    Step stroke index backward.
    Returns whether the operation was effective.
  */
  back()
  {
    this.strokeIndices.splice(this.strokeIndices.length-1, 1);
    for (let i = 0; i < this.strokeIndices.length;i++)
    {
      console.log(i);
      if (this.strokeIndex <= this.strokeIndices[i])
        {
          console.log("HI");
          this.strokeIndex = this.strokeIndices[i-1];
          i = this.strokeIndices.length + 1;

        }
    }
    // if (this.strokeIndex > 0)
    // {
    //   this.strokeIndex--;
    //   return true;
    // }
    // else
    // {
    //   return false;
    // }
  },

  /**
    Step stroke index forward or call the generator network.
    Returns whether the operation was effective.
  */


  forward()
  {
    // console.log('State Length: ' + this.state.length);
    if (this.isGenerating())
    {
      // predictVector / nextStroke - update SDD
      let stroke = GenerateModel.nextStroke(this)
      this.addStroke(stroke.startX, stroke.startY,
                     stroke.endX, stroke.endY,
                     stroke.width,
                     stroke.color);
      return true;
    }
    else
    {
      if (this.strokeIndex < this.dataIndex)
      {
        this.strokeIndex++;
        return true;
      }
      else
      {
        return false;
      }
    }
  },

  clear() {
    this.strokeIndex = 0;
    this.dataIndex = 0;
    this.state = [];
  }

}


/**
  Function definition for p5 object.
*/
function sketch_process(p)
{

  let canvas = null;
  let color = null;
  let sizeSlider = null;
  let redSlider = null;
  let greenSlider = null;
  let blueSlider = null;
  let stateSlider = null;
  let red = 0;
  let green = 0;
  let blue = 0;
  let lineSize = 1;
  let stateIndex = 0;


  p.slideState = function()
  {
    const strokes = MPState.getState();
    const sizes = MPState.getSizes();

    // Calculate percentage of state
    let cur_step = Math.floor(strokes.length * stateSlider.value());

    p.resetCanvas();
    for (let i = 0; i < cur_step; i++) {
      p.drawStroke(strokes[i], sizes[i]);
    }
  }

  p.setup = function()
  {

    canvas = p.createCanvas(640, 480);
    lineSize = 5;

    // For now, it's probably better to fix opacity and width.
    // They aren't anywhere in our SDS.
    sizeSlider = p.createSlider(0, 10, lineSize);
    redSlider = p.createSlider(0, 255, red);
    greenSlider = p.createSlider(0, 255, green);
    blueSlider = p.createSlider(0, 255, blue);
    stateSlider = p.createSlider(0, 1, 0, 0.01);

    canvas.parent("canvas-holder");
    sizeSlider.parent("size-slider");
    redSlider.parent("red-slider");
    greenSlider.parent("green-slider");
    blueSlider.parent("blue-slider");
    stateSlider.parent("state-slider");

    stateSlider.changed(p.slideState);

    p.predraw();
  }

  // Additional function for non-interfering setup
  p.predraw = function()
  {
    p.strokeWeight(1);
    p.rect(1, 0, 638, 478);
    p.strokeWeight(lineSize);
    p.color(red, green, blue, 255)
  }

  p.draw = function()
  {
  }

  p.mouseReleased = function()
  {
    MPState.strokeIndices.push(MPState.strokeIndex);
  }



  p.mousePressed = function()
  {
    // Square
    if (MPState.getShapeOption() == 0) {
      lineSize = sizeSlider.value();
      red = redSlider.value();
      green = greenSlider.value();
      blue = blueSlider.value();
      color = p.color(red, green, blue, 255);
      p.strokeWeight(lineSize);
      p.stroke(color);
      // p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
      p.line(p.mouseX, p.mouseY,  p.mouseX + 50, p.mouseY);
      //console.log(p.mouseX, p.mouseY,  p.mouseX + 50, p.mouseY);
      p.line(p.mouseX + 50, p.mouseY, p.mouseX + 50, p.mouseY - 50);
      //console.log(p.mouseX + 50, p.mouseY, p.mouseX + 50, p.mouseY - 50);
      p.line(p.mouseX + 50, p.mouseY - 50, p.mouseX, p.mouseY - 50);
      //console.log(p.mouseX + 50, p.mouseY - 50, p.mouseX, p.mouseY - 50);
      p.line(p.mouseX, p.mouseY - 50, p.mouseX, p.mouseY);
      //console.log(p.mouseX, p.mouseY - 50, p.mouseX, p.mouseY);

      MPState.addStroke(p.mouseX,
                        p.mouseY,
                        p.mouseX + 50,
                        p.mouseY,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 50,
                        p.mouseY,
                        p.mouseX + 50,
                        p.mouseY - 50,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 50,
                        p.mouseY - 50,
                        p.mouseX,
                        p.mouseY - 50,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX,
                        p.mouseY - 50,
                        p.mouseX,
                        p.mouseY,
                        lineSize,
                        color);
      //p.rect(p.mouseX, p.mouseY, 55, 55);
    }
    // Circle
    else if (MPState.getShapeOption() == 1)
    {
      lineSize = sizeSlider.value();
      red = redSlider.value();
      green = greenSlider.value();
      blue = blueSlider.value();
      color = p.color(red, green, blue, 255);
      p.strokeWeight(lineSize);
      p.stroke(color);
      // p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
      p.arc(p.mouseX, p.mouseY, 50, 50, 0, 2*Math.PI);
    }
    // Triangle
    else if (MPState.getShapeOption() == 2)
    {
      lineSize = sizeSlider.value();
      red = redSlider.value();
      green = greenSlider.value();
      blue = blueSlider.value();
      color = p.color(red, green, blue, 255);
      p.strokeWeight(lineSize);
      p.stroke(color);

      p.line(p.mouseX, p.mouseY,  p.mouseX + 30, p.mouseY + 40);
      //console.log(p.mouseX, p.mouseY,  p.mouseX + 30, p.mouseY - 40);

      p.line(p.mouseX + 30, p.mouseY + 40, p.mouseX - 30, p.mouseY + 40);
      //console.log(p.mouseX + 30, p.mouseY - 40, p.mouseX - 30, p.mouseY + 40);

      p.line(p.mouseX - 30, p.mouseY + 40, p.mouseX, p.mouseY);
      //console.log(p.mouseX - 40, p.mouseY, p.mouseX, p.mouseY);

      MPState.addStroke(p.mouseX,
                        p.mouseY,
                        p.mouseX + 30,
                        p.mouseY + 40,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 30,
                        p.mouseY + 40,
                        p.mouseX - 30,
                        p.mouseY + 40,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX - 30,
                        p.mouseY + 40,
                        p.mouseX,
                        p.mouseY,
                        lineSize,
                        color);

      //p.triangle(p.mouseX - 35, p.mouseY + 50, p.mouseX, p.mouseY, p.mouseX + 35, p.mouseY + 50);
    }
    else if (MPState.getShapeOption() == 3) //Rhombus
    {
      lineSize = sizeSlider.value();
      red = redSlider.value();
      green = greenSlider.value();
      blue = blueSlider.value();
      color = p.color(red, green, blue, 255);
      p.strokeWeight(lineSize);
      p.stroke(color);
      // p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
      p.line(p.mouseX, p.mouseY,  p.mouseX + 100, p.mouseY);
      //console.log(p.mouseX, p.mouseY,  p.mouseX + 50, p.mouseY);
      p.line(p.mouseX + 100, p.mouseY, p.mouseX + 50, p.mouseY - 50);
      //console.log(p.mouseX + 50, p.mouseY, p.mouseX + 50, p.mouseY - 50);
      p.line(p.mouseX + 50, p.mouseY - 50, p.mouseX - 50, p.mouseY - 50);
      //console.log(p.mouseX + 50, p.mouseY - 50, p.mouseX, p.mouseY - 50);
      p.line(p.mouseX - 50, p.mouseY - 50, p.mouseX, p.mouseY);
      //console.log(p.mouseX, p.mouseY - 50, p.mouseX, p.mouseY);

      MPState.addStroke(p.mouseX,
                        p.mouseY,
                        p.mouseX + 100,
                        p.mouseY,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 100,
                        p.mouseY,
                        p.mouseX + 50,
                        p.mouseY - 50,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 50,
                        p.mouseY - 50,
                        p.mouseX - 50,
                        p.mouseY - 50,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX - 50,
                        p.mouseY - 50,
                        p.mouseX,
                        p.mouseY,
                        lineSize,
                        color);
    }

    else if (MPState.getShapeOption() == 4)
    {
      lineSize = sizeSlider.value();
      red = redSlider.value();
      green = greenSlider.value();
      blue = blueSlider.value();
      color = p.color(red, green, blue, 255);
      p.strokeWeight(lineSize);
      p.stroke(color);
      // p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
      p.line(p.mouseX, p.mouseY,  p.mouseX + 20, p.mouseY + 60);
      //console.log(p.mouseX, p.mouseY,  p.mouseX + 50, p.mouseY);
      p.line(p.mouseX + 20, p.mouseY + 60, p.mouseX - 30, p.mouseY + 22);
      //console.log(p.mouseX + 50, p.mouseY, p.mouseX + 50, p.mouseY - 50);
      p.line(p.mouseX - 30, p.mouseY + 22, p.mouseX + 30, p.mouseY + 22);
      //console.log(p.mouseX + 50, p.mouseY - 50, p.mouseX, p.mouseY - 50);
      p.line(p.mouseX + 30, p.mouseY + 22, p.mouseX - 20, p.mouseY + 60);
      //console.log(p.mouseX, p.mouseY - 50, p.mouseX, p.mouseY);
      p.line(p.mouseX - 20, p.mouseY + 60, p.mouseX, p.mouseY);

      MPState.addStroke(p.mouseX,
                        p.mouseY,
                        p.mouseX + 20,
                        p.mouseY + 60,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 20,
                        p.mouseY + 60,
                        p.mouseX - 30,
                        p.mouseY + 22,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX - 30 ,
                        p.mouseY + 22,
                        p.mouseX + 30,
                        p.mouseY + 22,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX + 30,
                        p.mouseY + 22,
                        p.mouseX - 20,
                        p.mouseY + 60,
                        lineSize,
                        color);
      MPState.addStroke(p.mouseX - 20,
                        p.mouseY + 60,
                        p.mouseX,
                        p.mouseY,
                        lineSize,
                        color);
    }

  }

  p.mouseDragged = function()
  {
    // Check if the 'draw strokes' state or the 'draw shape' mode. If in the
    // 'draw shape' state, then don't do anything when the mouse is dragged.
    if (MPState.getShapeOption() == null) {
      // If its in eraser mode, add white lines over the previously drawn strokes.
      if (MPState.inEraserMode()) {
        color = p.color(255, 255, 255, 255);
        p.stroke(color);

        // Compare coordinates to closest stroke
        const strokes = MPState.getVisibleStrokes();
        const sizes = MPState.getVisibleSizes();

        let current_closestx = 10000;
        let current_closesty = 10000;
        let endof_closestx = 10000;
        let endof_closesty = 10000;
        let lineSize = 0;
        for (let i=0; i<strokes.length; i++) {
          if ((Math.abs(p.mouseX - strokes[i][0]) + Math.abs(p.mouseY - strokes[i][1])) < (Math.abs(p.mouseX - current_closestx) + Math.abs(p.mouseY - current_closesty))) {
            current_closestx = strokes[i][0];
            current_closesty = strokes[i][1];
            endof_closestx = strokes[i][2];
            endof_closesty = strokes[i][3];
            lineSize = strokes[i][4];
          }
        }
        console.log(current_closestx);
        console.log(current_closesty);
        p.strokeWeight(lineSize+5);
        p.line(current_closestx,
              current_closesty,
              endof_closestx,
              endof_closesty); // add white line with coordinates of startX, startY, endX, endY of closest stroke
        MPState.addStroke(current_closestx,
                          current_closesty,
                          endof_closestx,
                          endof_closesty,
                          lineSize+5,
                          color);
      }
      // Fill mode
      else if (MPState.inFillMode()) {
        const strokes = MPState.getVisibleStrokes();
        const sizes = MPState.getVisibleSizes();
        const mouseX = p.mouseX;
        const mouseY = p.mouseY;
        // console.log(p);

        let current_closestx = 10000;
        let current_closesty = 10000;
        let endof_closestx = 10000;
        let endof_closesty = 10000;
        let lineSize = 0;
        let index_of_interest = 0;
        for (let i=0; i<strokes.length; i++) {
          if ((Math.abs(mouseX - strokes[i][0]) + Math.abs(mouseY - strokes[i][1])) < (Math.abs(mouseX - current_closestx) + Math.abs(mouseY - current_closesty))) {
            current_closestx = strokes[i][0];
            current_closesty = strokes[i][1];
            endof_closestx = strokes[i][2];
            endof_closesty = strokes[i][3];
            lineSize = strokes[i][4];
            index_of_interest = i;
          }
        }

        let upper_limit = index_of_interest;
        let lower_limit = index_of_interest;
        for (let i = index_of_interest + 1; i < strokes.length; i++) {
          if((Math.abs(strokes[i-1][2] - strokes[i][0]) < 50) && Math.abs((strokes[i-1][1] - strokes[i][3]) < 50)) {
            upper_limit = i;
          }
          else {
            break;
          }
        }

        for (let i = index_of_interest; i > 0; i--) {
          if(Math.abs((strokes[i+1][0] - strokes[i][2]) < 50) && Math.abs((strokes[i+1][1] - strokes[i][3]) <50)) {
            lower_limit = i;
          }
          else{
            break;
          }
        }

        let closed_shape = false;

        red = redSlider.value();
        green = greenSlider.value();
        blue = blueSlider.value();
        color = p.color(red, green, blue, 255);

        const size = strokes.length;
        console.log(lower_limit);
        console.log(upper_limit);

        for (let i=lower_limit; i<upper_limit; i++) {
            p.line(strokes[i][0], strokes[i][1], strokes[upper_limit - (i-lower_limit)][2], strokes[upper_limit - (i-lower_limit)][3]);
            MPState.addStroke(strokes[i][0], strokes[i][1], strokes[upper_limit - (i-lower_limit)][2], strokes[upper_limit - (i-lower_limit)][3], lineSize ,color);
        }

        // let upper_slice = index_of_interest;
        // let lower_slice = index_of_interest;

        // for (let i=index_of_interest; i< strokes.length - 1; i++)
        // {
        //   if ((strokes[i][2] == strokes[i + 1][0]) && (strokes[i][3] == strokes[i+1][1]))
        //   {
        //     upper_slice = i;
        //     console.log(current_closestx);
        //   }

        //   else
        //   {
        //     break;
        //   }
        // }

        // for (let i=index_of_interest; i> 1; i--)
        // {
        //   if (strokes[i - 1][2] == strokes[i ][0] && strokes[i - 1][3] == strokes[i][1])
        //   {

        //     lower_slice = i;
        //   }
        //   else
        //   {
        //     break;
        //   }
        // }
        //console.log(lower_slice);

      }
      // Color picker (aka dropper)
      else if(MPState.getColorMode()) {
        const strokes = MPState.getVisibleStrokes();

        let current_closestx = 10000;
        let current_closesty = 10000;
        let line_of_interest = 0;
        for (let i=0; i<strokes.length; i++) {
          if ((Math.abs(p.mouseX - strokes[i][0]) + Math.abs(p.mouseY - strokes[i][1])) < (Math.abs(p.mouseX - current_closestx) + Math.abs(p.mouseY - current_closesty))) {
            current_closestx = strokes[i][0];
            current_closesty = strokes[i][1];
            line_of_interest = i;
          }
        }
        MPState.setRedDropperMode(strokes[line_of_interest][5][0]);
        MPState.setGreenDropperMode(strokes[line_of_interest][5][1]);
        MPState.setBlueDropperMode(strokes[line_of_interest][5][2]);
        MPState.setColorMode(false);
      }
      // Regular draw lines mode
      else {
        lineSize = sizeSlider.value();
        if(MPState.getRedDropperMode() != -1) {
          red = MPState.getRedDropperMode();
          green = MPState.getGreenDropperMode();
          blue = MPState.getBlueDropperMode();
        }
        else {
          red = redSlider.value();
          green = greenSlider.value();
          blue = blueSlider.value();
        }
        color = p.color(red, green, blue, 255);
        p.strokeWeight(lineSize);
        p.stroke(color);
        p.line(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
        MPState.addStroke(p.pmouseX, p.pmouseY,
                          p.mouseX, p.mouseY,
                          lineSize, color);
      }
    }
  }

  p.resetCanvas = function()
  {
    p.clear();
    p.predraw();
    // Don't call setup since we'll proliferate sliders, etc.
  }

  p.getSize = function()
  {
    return lineSize;
  }

  /*
    Draw a stroke as described by in vector form.
  */
  p.drawStroke = function(strokeVec, lineSize)
  {
    p5_inst.strokeWeight(lineSize);
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
function MockDOMObject(obj)
{
  // Compose over
  for (let property in Object.keys(obj))
  {
    this[property] = obj[property];
  }

  this.parentDiv = "window";

  this.parent = function(divId)
  {
    this.parentDiv = divId;
  }

  this.value = function()
  {
    return 1;
  }

}

function MockP5(sketch_process)
{
  this.canvas = null;
  this.slider = null;
  this.strokes = [];
  this.rectList = [];
  this.strokeColorProperty = {"levels": [0, 0, 0, 0]};
  this.strokeWidthProperty = 1;

  this.createCanvas = function(width, height)
  {
    this.canvas = new MockDOMObject({"width": width, "height": height});
    return this.canvas;
  }

  this.createSlider = function(min, max, step)
  {
    this.slider = new MockDOMObject({
      "min": min,
      "max": max,
      "step": step,
      value: function()
      {
        return 1;
      }
    });
    return this.slider;
  }

  // p5 functionality - no testing required
  this.color = function(r, g, b, a)
  {
    return {"levels": [r, g, b, a]};
  }

  this.clear = function()
  {
    // p5 - do not test
    this.strokes = [];
    this.rectList = [];
  }

  this.strokeWeight = function(weight)
  {
    // p5 - do not test
    this.strokeWidthProperty = weight;
  }

  this.stroke = function()
  {
    const colorArgs = arguments;
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

  this.line = function(startX, startY, endX, endY)
  {
    this.strokes.push([startX, startY, endX, endY, this.strokeWidthProperty, this.strokeColorProperty]);
  }

  this.rect = function(left, top, right, bottom)
  {
    this.rectList.push([left, top, right, bottom]);
  }

  // Mouse parameters
  this.mouseX = 0;
  this.mouseY = 0;
  this.pmouseX = 0;
  this.pmouseY = 0;
  this.setMouse = function(newX, newY)
  {
    this.pmouseX = this.mouseX;
    this.pmouseY = this.mouseY;
    this.mouseX = newX;
    this.mouseY = newY;
  }

  sketch_process(this);
}


/////////////
// Instantiate the p5js instance.

// MUST be var - persists across scripts
var p5_inst;
if (!isNode)
{
  p5_inst = new p5(sketch_process);
}
else
{
  p5_inst = new MockP5(sketch_process);
}

/* DEFINE BUTTON CALLBACKS */
function seekBackward()
{
  MPState.back();
  const strokes = MPState.getVisibleStrokes();
  const sizes = MPState.getVisibleSizes();
  p5_inst.resetCanvas();
  for (let i = 0; i < strokes.length; i++)
  {
    p5_inst.drawStroke(strokes[i], sizes[i]);
  }

}

function clears()
{
  // Reset all visible strokes, sizes, colors, and indicies to 0
  MPState.setVisibleStrokes([]);
  MPState.setVisibleSizes([]);
  MPState.setVisibleReds([]);
  MPState.setVisibleGreens([]);
  MPState.setVisibleReds([]);
  MPState.setDataIndex(0);
  MPState.setStrokeIndex(0);
  p5_inst.resetCanvas();
}

function seekForward()
{
  if (MPState.forward())
  {
    const lineSize = MPState.getCurrentSize();
    const stroke = MPState.getCurrentStroke();
    p5_inst.drawStroke(stroke, lineSize);
  }
}

function togglePlay()
{
  // Unit testing
  if (isNode)
  {
    seekForward();
  }
  // Functional testing, unfortunately cannot unit test...
  else
  {
  	let img = document.getElementById('play-pause-img');
		MPState.setPlay(img.src.includes('play'));

  	// If its in the play state, show the pause button, and vice versa
  	if (MPState.play)
    {
  		img.src='./img/pause.png';
      console.log('Is in the "Play" state');

      // If its the generate mode, then simply seekForward
      if (MPState.isGenerating())
      {
        setTimeout(seekForward, 500);
      }
      // otherwise draw all the previous strokes
      else
      {
        const state = MPState.getState();
        const sizes = MPState.getSizes();
        const visibleStrokes = MPState.getVisibleStrokes();
        // console.log(state);
        // console.log(sizes);
        // console.log('Visible Strokes Length: ' + visibleStrokes[2])

        for (let i = visibleStrokes.length; i < state.length; i++)
        {
          // console.log("Current stroke: " + visibleStrokes[i-1]);
          p5_inst.drawStroke(state[i-1], sizes[i-1]);
        }
      }
    }
    else
    {
  		img.src='./img/play.png';
  		console.log('Is in the "Pause" state');
    }
  }
  // Not slated for this release.
  // throw new Error("Not implemented!");
}

function updateGenerateToggle()
{
  // Cannot be auto-tested due to document interaction.
  let checkbox = document.getElementById('generate-toggle-box');
  MPState.setGenerating(checkbox.checked);
}


// TODO update
function rotate()
{
  const strokes = MPState.getState();
  const sizes = MPState.getSizes();
  p5_inst.resetCanvas();
  for (let i = 0; i < MPState.strokeIndex; i++)
  {
    const sX = strokes[i][0] - 320;
    const sY = strokes[i][1] - 240;
    const eX = strokes[i][2] - 320;
    const eY = strokes[i][3] - 240;
    strokes[i][0] = sY + 320;
    strokes[i][1] = -1.0 * sX + 240;
    strokes[i][2] = eY + 320;
    strokes[i][3] = -1.0 * eX + 240;
    p5_inst.drawStroke(strokes[i], sizes[i]);
  }

  for (let i =  MPState.strokeIndex; i < strokes.length; i++)
  {
    const sX = strokes[i][0] - 320;
    const sY = strokes[i][1] - 240;
    const eX = strokes[i][2] - 320;
    const eY = strokes[i][3] - 240;
    MPState.state[i][0] = sY + 320;
    MPState.state[i][1] = -1.0 * sX + 240;
    MPState.state[i][2] = eY + 320;
    MPState.state[i][3] = -1.0 * eX + 240;
  }
}

/**
 * Downloads the current state of the canvas.
 */
function exportData() {
  const strokes = MPState.getVisibleStrokes();
  const sizes = MPState.getVisibleSizes();
  const savedImgs = MPState.getSavedImages();
  const imageIdx = document.getElementById('img-num').value;
  console.log(strokes.length);
  console.log(savedImgs);

  // Check if anything is drawn on the canvas
  if (strokes.length == 0) {
    alert('Cannot download empty canvas image!')
  }
  else {
    let img = null;
    // // If no image state is saved, simply get what is saved on the canvas.
    // if (savedImgs.length == 0) {
    //   img = { strokes, sizes };
    // }
    // // // If the imageIndex is negative (aka 'none' is selected), don't download the image.
    // // else if (imageIdx < 0) {
    // //   alert('Please switch to an image state using the dropdown menu to download it!');
    // //   return;
    // // }
    // // Otherwise get the specified image from the saved state
    // else {
    //   img = savedImgs[imageIdx];
    // }

    // If no image state is saved, simply get what is saved on the canvas.
    if (savedImgs.length == 0 && strokes.length > 0) {
      img = {strokes, sizes};
    }
    else {
      if (strokes.length != savedImgs[imageIdx].strokes.length) {
        img = {strokes, sizes};
      }
      else {
        img = savedImgs[imageIdx];
      }
    }
    // // Get the specified image from the saved state if the visible strokes and saved image state strokes are the same.
    // else if (strokes.length == savedImgs[imageIdx].strokes.length) {
    //   img = savedImgs[imageIdx];
    // }
    // // If there are saved images
    // else {
    //   img = { strokes, sizes };
    // }

    // Draw image onto the "unseen" canvas
    p5_inst.resetCanvas();
    for (let i = 0; i < img.strokes.length; i++) {
      p5_inst.drawStroke(img.strokes[i], img.sizes[i]);
    }
    p5_inst.save('my_canvas.png');
  }
}

/**
 * Mimics the artistic style of Jackson Pollack.
 */
function jpMode()
{
  for (let i = 0; i < 1000; i++)
  {
    const startX =  Math.random()*640;
    const startY =  Math.random()*480;

    const rand = Math.random();
    let endX = null;
    if (rand < 0.5)
    {
      endX = startX + Math.random()*5;
    }
    // If it is a line segment, randomize the X direction
    else
    {
      const rand1 = Math.random();
      if(rand1 < .5)
      {
        endX = startX + Math.random()*100;
      }
      else
      {
        endX = startX - Math.random()*100;
      }
    }

    let endY = null;
    if (rand < 0.5)
    {
      endY = startY + Math.random()*5;
    }
    // If it is a line segment, randomize the Y direction
    else
    {
      const rand1 = Math.random();
      if(rand1 < .5)
      {
        endY = startY + Math.random()*100;
      }
      else
      {
        endY = startY - Math.random()*100;
      }
    }

    let width = null;
    if (rand < 0.5)
    {
      width = Math.random()*15;
    }
    else
    {
      width = Math.random()*5;
    }

    const stroke =
    {
      startX: startX, // start new endX value from endX value of previous vector
      startY: startY, // start new endY value from endY value of previous vector
      endX: endX,
      endY: endY,
      width: width,
      color: {
        _array: [0,0,0,1],
        levels: [Math.random()*255, Math.random()*255, Math.random()*255, Math.random()*255],
        maxes: {
          hsb: [360, 100, 100, 1],
          hsl: [360, 100, 100, 1],
          rgb: [0,0,0,255]
        },
        mode: "rgb",
        name: "p5.Color"
      }
    };

    MPState.addStroke(stroke.startX, stroke.startY,
                   stroke.endX, stroke.endY,
                   stroke.width,
                   stroke.color);
    const new_stroke = MPState.getCurrentStroke();
    const lineSize = MPState.getCurrentSize();

    p5_inst.drawStroke(new_stroke, lineSize);
    }
  }

function warholMode()
{
  const strokes = MPState.getVisibleStrokes();
  const sizes = MPState.getVisibleSizes();
  p5_inst.resetCanvas();
  const initalstrokes = strokes.slice();
  for (let i = 0; i < strokes.length; i++)
  {
    strokes[i][0] = strokes[i][0]/4;
    strokes[i][1] = strokes[i][1]/4;
    strokes[i][2] = strokes[i][2]/4;
    strokes[i][3] = strokes[i][3]/4;
  }

  for(let x = 0; x < 16; x++)
  {
    let red = Math.random()*255;
    let green = Math.random()*255;
    let blue = Math.random()*255;
    for (let i = 0; i < strokes.length; i++)
    {
      if((x % 4) == 0) // 0 to 160 width
      {
        initalstrokes[i][0] = strokes[i][0];
        initalstrokes[i][1] = Math.floor(x/4)*120 + strokes[i][1];
        initalstrokes[i][2] = strokes[i][2];
        initalstrokes[i][3] = Math.floor(x/4)*120 + strokes[i][3];
      }
      else if((x % 4) == 1) // 161 to 320 width
      {
        initalstrokes[i][0] = 160 + strokes[i][0];
        initalstrokes[i][1] = Math.floor(x/4)*120 + strokes[i][1];
        initalstrokes[i][2] = 160 +strokes[i][2];
        initalstrokes[i][3] = Math.floor(x/4)*120 + strokes[i][3];
      }
      else if((x % 4) == 2) // 321 to 480 width
      {
        initalstrokes[i][0] = 320 + strokes[i][0];
        initalstrokes[i][1] = Math.floor(x/4)*120 + strokes[i][1];
        initalstrokes[i][2] = 320 + strokes[i][2];
        initalstrokes[i][3] = Math.floor(x/4)*120 + strokes[i][3];
      }
      else if((x % 4) == 3) // 481 to 640 width
      {
       initalstrokes[i][0] = 480 + strokes[i][0];
       initalstrokes[i][1] = Math.floor(x/4)*120 + strokes[i][1];
       initalstrokes[i][2] = 480 + strokes[i][2];
       initalstrokes[i][3] = Math.floor(x/4)*120 + strokes[i][3];
      }
      initalstrokes[i][5] = p5_inst.color(red, green, blue, 255);
      p5_inst.drawStroke(initalstrokes[i], sizes[i]);

      //i'm amazed i can't think of a better way to do this that works.
      if((x % 4) == 0) // 0 to 160 width
      {
        initalstrokes[i][0] = strokes[i][0];
        initalstrokes[i][1] = strokes[i][1] - Math.floor(x/4)*120;
        initalstrokes[i][2] = strokes[i][2];
        initalstrokes[i][3] = strokes[i][3] -Math.floor(x/4)*120;
      }
      else if((x % 4) == 1) // 161 to 320 width
      {
        initalstrokes[i][0] = strokes[i][0] - 160;
        initalstrokes[i][1] = strokes[i][1] -Math.floor(x/4)*120;
        initalstrokes[i][2] = strokes[i][2] - 160;
        initalstrokes[i][3] = strokes[i][3] - Math.floor(x/4)*120;

      }
      else if((x % 4) == 2) // 321 to 480 width
      {
        initalstrokes[i][0] = strokes[i][0] -320;
        initalstrokes[i][1] = strokes[i][1] -Math.floor(x/4)*120;
        initalstrokes[i][2] = strokes[i][2] - 320;
        initalstrokes[i][3] = strokes[i][3]- Math.floor(x/4)*120;
      }
      else if((x % 4) == 3) // 481 to 640 width
      {
       initalstrokes[i][0] = strokes[i][0] - 480;
       initalstrokes[i][1] = strokes[i][1] - Math.floor(x/4)*120 ;
       initalstrokes[i][2] = strokes[i][2] - 480;
       initalstrokes[i][3] = strokes[i][3] - Math.floor(x/4)*120 ;
      }
    }
  }
}


/**
 * Adds the option to select a saved image state to choose from. Note the index
 * starts at 0.
 *
 * @param {int} idx - The array location of the saved image state
 */
function addOption(idx) {
  // Define new option's text (which starts at idx=1 for human readability)
  // and value (which starts at idx=0 to retrieve the correct saved image)
  const optionTextIdx = idx + 1;

  // Inject new html option based on index location
  const states = document.getElementById('img-num');
  const option = document.createElement('option');
  option.text = 'Image ' + optionTextIdx;
  option.value = idx;
  option.selected = true; // Select the option for the dropdown menu that was just saved
  states.add(option);
}

/**
 * Saves the current state of the canvas.
 */
function saveImage()
{
  if (MPState.getVisibleStrokes().length == 0 || MPState.getVisibleSizes().length == 0) {
    alert('Cannot save empty canvas. Please draw something first!')
  } else {
    // Create new image object to be saved
    const new_img =
    {
      strokes: MPState.getVisibleStrokes(),
      sizes: MPState.getVisibleSizes(),
    }
    // Save the state and add the option to the dropdown
    MPState.savedImages.push(new_img);
    addOption(MPState.savedImages.length - 1); // length - 1 because we save the idx based on its location in array
  }
}

/**
 * Loads the image (using the image index) from the list of saved images.
 * Gets the image index based on the html dropdown menu options.
 */
function loadImage()
{
  const imageIdx = document.getElementById('img-num').value;
  // If the imageIndex is negative (aka 'none' is selected), simply clear the canvas.
  if (imageIdx < 0) {
    clears();
  } else {
    const img = MPState.getSavedImages()[imageIdx];

    // Draw image onto the canvas
    p5_inst.resetCanvas();
    for (let i = 0; i < img.strokes.length; i++)
    {
      p5_inst.drawStroke(img.strokes[i], img.sizes[i]);
    }
  }
}

function mirrorMode()
{
  const modeID = document.getElementById('mode').value;

  if(modeID == 1)
  {
    //vertical
    //divide size of vertical compoent 2
    const strokes = MPState.getVisibleStrokes();
    const sizes = MPState.getVisibleSizes();
    p5_inst.resetCanvas();
    for (let i = 0; i < strokes.length; i++)
    {
      strokes[i][0] = strokes[i][0]/2;
      strokes[i][1] = strokes[i][1];
      strokes[i][2] = strokes[i][2]/2;
      strokes[i][3] = strokes[i][3];

      p5_inst.drawStroke(strokes[i], sizes[i]);
    }

    for (let i = 0; i < strokes.length; i++)
    {
      const diff_start = (320 - strokes[i][0])*2;
      const diff_end = (320 - strokes[i][2])*2;
      strokes[i][0] = strokes[i][0] + diff_start;
      strokes[i][1] = strokes[i][1];
      strokes[i][2] = strokes[i][2] + diff_end;
      strokes[i][3] = strokes[i][3];
      p5_inst.drawStroke(strokes[i], sizes[i]);

    }
  }
  else if(modeID == 2)
  {
    const strokes = MPState.getVisibleStrokes();
    const sizes = MPState.getVisibleSizes();
    p5_inst.resetCanvas();
    for (let i = 0; i < strokes.length; i++)
    {
      strokes[i][0] = strokes[i][0];
      strokes[i][1] = strokes[i][1]/2;
      strokes[i][2] = strokes[i][2];
      strokes[i][3] = strokes[i][3]/2;

      p5_inst.drawStroke(strokes[i], sizes[i]);
    }

    for (let i = 0; i < strokes.length; i++)
    {
      const diff_start = (240 - strokes[i][1])*2;
      const diff_end = (240 - strokes[i][3])*2;
      strokes[i][0] = strokes[i][0];
      strokes[i][1] = strokes[i][1] + diff_start;
      strokes[i][2] = strokes[i][2];
      strokes[i][3] = strokes[i][3]+ diff_end;
      p5_inst.drawStroke(strokes[i], sizes[i]);

    }
  }
   else if(modeID == 3)
  {
    const strokes = MPState.getVisibleStrokes();
    const sizes = MPState.getVisibleSizes();
    p5_inst.resetCanvas();
    for (let i = 0; i < strokes.length; i++)
    {
      strokes[i][0] = strokes[i][0]/2;
      strokes[i][1] = strokes[i][1]/2;
      strokes[i][2] = strokes[i][2]/2;
      strokes[i][3] = strokes[i][3]/2;

      p5_inst.drawStroke(strokes[i], sizes[i]);
    }

    for (let i = 0; i < strokes.length; i++)
    {
      let diff_startx = (320 - strokes[i][0])*2;
      let diff_endx = (320 - strokes[i][2])*2;
      strokes[i][0] = strokes[i][0] + diff_startx;
      strokes[i][1] = strokes[i][1];
      strokes[i][2] = strokes[i][2] + diff_endx;
      strokes[i][3] = strokes[i][3];
      p5_inst.drawStroke(strokes[i], sizes[i]);
      strokes[i][0] = strokes[i][0] - diff_startx;
      strokes[i][2] = strokes[i][2] - diff_endx;

    }

    for (let i = 0; i < strokes.length; i++)
    {
      let diff_starty = (240 - strokes[i][1])*2;
      let diff_endy = (240 - strokes[i][3])*2;
      strokes[i][0] = strokes[i][0];
      strokes[i][1] = strokes[i][1] + diff_starty;
      strokes[i][2] = strokes[i][2];
      strokes[i][3] = strokes[i][3]+ diff_endy;
      p5_inst.drawStroke(strokes[i], sizes[i]);
      strokes[i][1] = strokes[i][1] - diff_starty;
      strokes[i][3] = strokes[i][3] - diff_endy;

    }

    for (let i = 0; i < strokes.length; i++)
    {
      let diff_startx = (320 - strokes[i][0])*2;
      let diff_starty = (240 - strokes[i][1])*2;
      let diff_endx = (320 - strokes[i][2])*2;
      let diff_endy = (240 - strokes[i][3])*2;
      strokes[i][0] = strokes[i][0] + diff_startx;
      strokes[i][1] = strokes[i][1] + diff_starty;
      strokes[i][2] = strokes[i][2] + diff_endx;
      strokes[i][3] = strokes[i][3] + diff_endy;
      p5_inst.drawStroke(strokes[i], sizes[i]);
      strokes[i][0] = strokes[i][0] - diff_startx;
      strokes[i][1] = strokes[i][1] - diff_starty;
      strokes[i][2] = strokes[i][2] - diff_endx;
      strokes[i][3] = strokes[i][3] - diff_endy;

    }
  }

}

function updateEraserToggle()
{
  // Cannot be auto-tested due to document interaction.
  let checkbox = document.getElementById('eraser-toggle-box');
  MPState.setEraserMode(checkbox.checked);
}

function color_picker()
{
  // Cannot be auto-tested due to document interaction.
  if(MPState.getColorMode())
  {
    MPState.setRedDropperMode(-1);
    MPState.setColorMode(false);

  }
  else
  {
    MPState.setColorMode(true);
  }
}

function updateFillToggle()
{
  // Cannot be auto-tested due to document interaction.
  let checkbox = document.getElementById('fill-toggle-box');
  MPState.setFillMode(checkbox.checked);
}

function shapeTool() {
  const shape = document.getElementById('shape').value;
  MPState.setShapeOption(shape);
}

//begin new

//begin end
if (isNode) {
  module.exports =
  {
    p5_inst,
    MPState,
    sketch_process,
    seekBackward,
    seekForward,
    togglePlay,
    jpMode,
    clears
  }
}
