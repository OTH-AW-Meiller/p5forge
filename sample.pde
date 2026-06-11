int particles = 80;
float drift = 0.0;

void setup() {
  size(820, 520);
  colorMode(HSB, 360, 100, 100, 100);
  background(220, 35, 10);
  noStroke();
}

void draw() {
  fill(220, 35, 10, 8);
  rect(0, 0, width, height);

  for (int i = 0; i < particles; i++) {
    float t = frameCount * 0.01 + i * 0.17 + drift;
    float x = noise(t, 31.2) * width - width / 6;
    float y = noise(77.8, t) * height;
    float d = 8 + noise(t, t * 1.7) * 70;
    float hue = (frameCount * 0.7 + i * 5) % 360;
    fill(hue, 80, 100, 45);
    circle(x, y, d);
  }
}

void mousePressed() {
  background(220, 35, 10);
  drift = random(0, 1000);
}
