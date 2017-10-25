function setup() {
  canvas = createCanvas(640, 480);
  rect(1, 0, 638, 479);
  c = color(0);
  lineSize = 10;

  text = createDiv('Color');
  text.position(0, 580);

  greenButton = createButton('Green');
  greenButton.position(40,580);
  greenButton.mousePressed(changeColorGreen);

  redButton = createButton('Red');
  redButton.position(90,580);
  redButton.mousePressed(changeColorRed);

  blueButton = createButton('Blue');
  blueButton.position(135,580);
  blueButton.mousePressed(changeColorBlue);

  blackButton = createButton('Black');
  blackButton.position(180,580);
  blackButton.mousePressed(changeColorBlack);

  text = createDiv('Drawing Size');
  text.position(0, 700);

  sizeSlider = createSlider(1, 30, 10);
  sizeSlider.position(100, 700);

  resetButton = createButton('Reset');
  resetButton.position(0, 600);
  resetButton.mousePressed(resetCanvas);

}

function draw() {
}

function mouseDragged()
{
  lineSize = sizeSlider.value();
	strokeWeight(lineSize);
  stroke(c);
	line(mouseX, mouseY, pmouseX, pmouseY);
}

function changeColorGreen()
{
  c = color(0, 255, 0);
}

function changeColorRed()
{
  c = color(255,0, 0);
}

function changeColorBlue()
{
  c = color(0,0, 255);
}

function changeColorBlack()
{
  c = color(0, 0, 0);
}

function resetCanvas()
{
  clear();
  setup();

}

function getColor()
{
  return c;
}

function getSize()
{
  return lineSize;
}
