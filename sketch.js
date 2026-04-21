/**
 * ✨ 泡泡拍照濾鏡 — 升級整合版 v2
 * 功能：彩色粒子混合、多種濾鏡模式切換、倒數計時拍照、閃光效果、螢幕補光燈
 */

let capture;
let pg;
let particles = [];
let snapshot = null;

// 倒數與閃光狀態
let countdown = 0;
let countdownTimer = null;
let flashAlpha = 0;

// ── 螢幕補光燈 ──────────────────────────────
let torchOn = false;
let torchStrength = 60; // 0–100，預設中等亮度

// ── 濾鏡模式 ────────────────────────────────
const MODES = [
  { name: '🫧 夢幻泡泡',  types: ['bubble'] },
  { name: '⭐ 星空閃爍',  types: ['star', 'sparkle'] },
  { name: '🌸 花瓣飄落',  types: ['petal', 'heart'] },
  { name: '❄️ 冬日雪花',  types: ['snow', 'bubble'] },
  { name: '💛 彩虹混合',  types: ['bubble', 'star', 'heart', 'petal'] },
];
let modeIndex = 0;

// ── UI 元素 ──────────────────────────────────
let btnCountdown, btnSave, btnMode, btnTorch;
let torchSlider, torchSliderWrap, torchValueLabel;
let uiContainer;
let modeLabel;

// ────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  capture = createCapture(VIDEO);
  capture.hide();

  pg = createGraphics(640, 480);
  pg.colorMode(HSB, 360, 100, 100, 100);

  setupUI();
}

function draw() {
  background(280, 30, 95);

  let scaleFactor = width < height ? 0.85 : 0.6;
  let imgW = width * scaleFactor;
  let imgH = (imgW * (capture.height || 480)) / (capture.width || 640);

  if (imgH > height * 0.72) {
    imgH = height * 0.72;
    imgW = (imgH * (capture.width || 640)) / (capture.height || 480);
  }

  let xOffset = (width - imgW) / 2;
  let yOffset = (height - imgH) / 2 - 30;

  // 更新粒子圖層
  updateParticleLayer();

  // ── 鏡像繪製 ──
  push();
  translate(width, 0);
  scale(-1, 1);
  image(capture, xOffset, yOffset, imgW, imgH);
  image(pg, xOffset, yOffset, imgW, imgH);
  stroke(0, 0, 100, 60);
  strokeWeight(max(2, width * 0.003));
  noFill();
  rect(xOffset, yOffset, imgW, imgH, 8);
  pop();

  // ── 螢幕補光燈疊層（只蓋鏡頭影像區域，補光時粒子仍可見） ──
  if (torchOn) {
    colorMode(RGB, 255);
    let tAlpha = map(torchStrength, 0, 100, 0, 210);
    fill(255, 255, 255, tAlpha);
    noStroke();
    rect(xOffset, yOffset, imgW, imgH, 8);
    colorMode(HSB, 360, 100, 100, 100);
  }

  // ── 倒數顯示 ──
  if (countdown > 0) {
    drawCountdown(xOffset, yOffset, imgW, imgH);
  }

  // ── 拍照閃光（全螢幕） ──
  if (flashAlpha > 0) {
    colorMode(RGB, 255);
    fill(255, 255, 255, flashAlpha);
    noStroke();
    rect(0, 0, width, height);
    colorMode(HSB, 360, 100, 100, 100);
    flashAlpha = max(0, flashAlpha - 18);
  }

  // ── 預覽圖 ──
  if (snapshot) {
    drawPreview(snapshot);
  }

  updateUIStyle();
}

// ────────────────────────────────────────────
// 粒子圖層
function updateParticleLayer() {
  if (capture.loadedmetadata) {
    if (pg.width !== capture.width || pg.height !== capture.height) {
      pg.resizeCanvas(capture.width, capture.height);
      pg.colorMode(HSB, 360, 100, 100, 100);
    }
  }

  pg.clear();

  let mode = MODES[modeIndex];
  if (random(1) < 0.15) {
    let t = random(mode.types);
    particles.push(new Particle(pg.width, pg.height, t));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].move();
    particles[i].display(pg);
    if (particles[i].isOffScreen()) particles.splice(i, 1);
  }
}

// ────────────────────────────────────────────
// 倒數顯示
function drawCountdown(x, y, w, h) {
  let cx = x + w / 2;
  let cy = y + h / 2;
  let pulse = sin(frameCount * 0.15) * 15;

  colorMode(RGB, 255);
  noFill();
  stroke(180, 100, 255, 120);
  strokeWeight(3);
  ellipse(cx, cy, 120 + pulse, 120 + pulse);
  stroke(180, 100, 255, 60);
  strokeWeight(8);
  ellipse(cx, cy, 150 + pulse, 150 + pulse);

  fill(255, 255, 255, 230);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(80);
  textStyle(BOLD);
  text(countdown, cx, cy);
  colorMode(HSB, 360, 100, 100, 100);
}

// ────────────────────────────────────────────
// 拍照
function startCountdownShot() {
  if (countdownTimer) return;
  countdown = 3;
  btnCountdown.elt.disabled = true;

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdown = 0;
      doTakeSnapshot();
    }
  }, 1000);
}

function doTakeSnapshot() {
  flashAlpha = 220;

  setTimeout(() => {
    let scaleFactor = width < height ? 0.85 : 0.6;
    let imgW = width * scaleFactor;
    let imgH = (imgW * capture.height) / capture.width;
    if (imgH > height * 0.72) {
      imgH = height * 0.72;
      imgW = (imgH * capture.width) / capture.height;
    }
    let x = (width - imgW) / 2;
    let y = (height - imgH) / 2 - 30;

    snapshot = get(x, y, imgW, imgH);
    btnSave.show();
    btnCountdown.elt.disabled = false;
  }, 80);
}

function savePhoto() {
  if (snapshot) {
    let filename = 'snap_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2) + '.png';
    save(snapshot, filename);
  }
}

function switchMode() {
  modeIndex = (modeIndex + 1) % MODES.length;
  particles = [];
  modeLabel.html(MODES[modeIndex].name);
}

// ────────────────────────────────────────────
// 補光燈開關
function toggleTorch() {
  torchOn = !torchOn;
  btnTorch.html(torchOn ? '💡 補光：開' : '🔦 補光：關');
  btnTorch.style('background', torchOn
    ? 'linear-gradient(135deg,#f9c74f,#f8961e)'
    : 'linear-gradient(135deg,#555,#777)');
  torchSliderWrap.style('display', torchOn ? 'flex' : 'none');
}

// ────────────────────────────────────────────
// 預覽圖
function drawPreview(img) {
  let pw = width < 600 ? width * 0.25 : 120;
  let ph = (pw * img.height) / img.width;
  let px = width - pw - 20;
  let py = 20;

  colorMode(RGB, 255);
  fill(255, 255, 255, 200);
  noStroke();
  rect(px - 6, py - 6, pw + 12, ph + 12, 10);
  image(img, px, py, pw, ph);
  colorMode(HSB, 360, 100, 100, 100);
}

// ────────────────────────────────────────────
// UI 建立
function setupUI() {
  uiContainer = createDiv('');
  uiContainer.style('position', 'absolute');
  uiContainer.style('bottom', '20px');
  uiContainer.style('width', '100%');
  uiContainer.style('display', 'flex');
  uiContainer.style('flex-direction', 'column');
  uiContainer.style('align-items', 'center');
  uiContainer.style('gap', '8px');

  // 濾鏡名稱
  modeLabel = createDiv(MODES[0].name);
  modeLabel.parent(uiContainer);
  modeLabel.style('font-size', '14px');
  modeLabel.style('color', 'rgba(80,50,120,0.85)');
  modeLabel.style('font-weight', '600');
  modeLabel.style('letter-spacing', '1px');

  // ── 補光燈強度滑桿（預設隱藏） ──
  torchSliderWrap = createDiv('');
  torchSliderWrap.parent(uiContainer);
  torchSliderWrap.style('display', 'none');
  torchSliderWrap.style('align-items', 'center');
  torchSliderWrap.style('gap', '8px');
  torchSliderWrap.style('background', 'rgba(255,255,255,0.60)');
  torchSliderWrap.style('backdrop-filter', 'blur(6px)');
  torchSliderWrap.style('border-radius', '30px');
  torchSliderWrap.style('padding', '6px 16px');

  let torchIcon = createSpan('☀️');
  torchIcon.parent(torchSliderWrap);
  torchIcon.style('font-size', '15px');

  torchSlider = createSlider(10, 100, torchStrength, 1);
  torchSlider.parent(torchSliderWrap);
  torchSlider.style('width', '110px');
  torchSlider.input(() => {
    torchStrength = torchSlider.value();
    torchValueLabel.html(torchStrength + '%');
  });

  torchValueLabel = createSpan(torchStrength + '%');
  torchValueLabel.parent(torchSliderWrap);
  torchValueLabel.style('font-size', '13px');
  torchValueLabel.style('font-weight', '700');
  torchValueLabel.style('color', '#7a5200');
  torchValueLabel.style('min-width', '36px');

  // ── 按鈕列 ──
  let btnRow = createDiv('');
  btnRow.parent(uiContainer);
  btnRow.style('display', 'flex');
  btnRow.style('gap', '10px');
  btnRow.style('justify-content', 'center');
  btnRow.style('flex-wrap', 'wrap');

  btnMode = createButton('🎨 切換濾鏡');
  btnMode.parent(btnRow);
  btnMode.mousePressed(switchMode);

  btnTorch = createButton('🔦 補光：關');
  btnTorch.parent(btnRow);
  btnTorch.mousePressed(toggleTorch);

  btnCountdown = createButton('📸 倒數拍照');
  btnCountdown.parent(btnRow);
  btnCountdown.mousePressed(startCountdownShot);

  btnSave = createButton('💾 儲存');
  btnSave.parent(btnRow);
  btnSave.mousePressed(savePhoto);
  btnSave.hide();
}

function updateUIStyle() {
  let isMobile = width < 600;
  let fs = isMobile ? '13px' : '15px';
  let pd = isMobile ? '8px 15px' : '11px 22px';

  [btnMode, btnTorch, btnCountdown, btnSave].forEach(b => {
    b.style('padding', pd);
    b.style('font-size', fs);
    b.style('border-radius', '50px');
    b.style('border', 'none');
    b.style('font-weight', 'bold');
    b.style('cursor', 'pointer');
    b.style('color', 'white');
    b.style('box-shadow', '0 4px 18px rgba(100,60,180,0.22)');
  });

  btnMode.style('background', 'linear-gradient(135deg,#9b72cf,#c491d3)');
  btnCountdown.style('background', 'linear-gradient(135deg,#6a4c93,#9b72cf)');
  btnSave.style('background', 'linear-gradient(135deg,#ff595e,#ff8c66)');
  // 補光燈按鈕顏色由 toggleTorch() 控制，這裡補上初始狀態
  if (!torchOn) {
    btnTorch.style('background', 'linear-gradient(135deg,#555,#777)');
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ────────────────────────────────────────────
// 粒子類別
class Particle {
  constructor(w, h, type) {
    this.x = random(w);
    this.y = h + 50;
    this.r = random(w * 0.012, w * 0.038);
    this.speed = random(1.2, 3.2);
    this.angle = random(TWO_PI);
    this.hue = random(360);
    this.type = type || 'bubble';
    this.rot = random(TWO_PI);
    this.rotSpeed = random(-0.04, 0.04);
  }

  move() {
    this.y -= this.speed;
    this.x += sin(frameCount * 0.05 + this.angle) * 1.3;
    this.rot += this.rotSpeed;
    this.hue = (this.hue + 0.8) % 360;
  }

  display(t) {
    t.push();
    t.translate(this.x, this.y);
    switch (this.type) {
      case 'bubble':  this._drawBubble(t);  break;
      case 'star':    this._drawStar(t);    break;
      case 'sparkle': this._drawSparkle(t); break;
      case 'heart':   this._drawHeart(t);   break;
      case 'petal':   this._drawPetal(t);   break;
      case 'snow':    this._drawSnow(t);    break;
    }
    t.pop();
  }

  _drawBubble(t) {
    t.noFill();
    t.stroke(this.hue, 60, 100, 75);
    t.strokeWeight(1.8);
    t.ellipse(0, 0, this.r * 2);
    t.fill(0, 0, 100, 55);
    t.noStroke();
    t.ellipse(-this.r * 0.3, -this.r * 0.3, this.r * 0.45);
    t.fill(this.hue, 30, 100, 25);
    t.ellipse(this.r * 0.15, this.r * 0.35, this.r * 0.6, this.r * 0.25);
  }

  _drawStar(t) {
    t.rotate(this.rot);
    t.fill(this.hue, 80, 100, 85);
    t.noStroke();
    let sp = 5, inner = this.r * 0.4, outer = this.r;
    t.beginShape();
    for (let i = 0; i < sp * 2; i++) {
      let a = (i * PI) / sp - PI / 2;
      let r = i % 2 === 0 ? outer : inner;
      t.vertex(cos(a) * r, sin(a) * r);
    }
    t.endShape(CLOSE);
    t.fill(this.hue, 60, 100, 30);
    t.ellipse(0, 0, this.r * 2.5, this.r * 2.5);
  }

  _drawSparkle(t) {
    t.rotate(this.rot);
    t.stroke(this.hue, 50, 100, 90);
    t.strokeWeight(1.5);
    t.noFill();
    for (let i = 0; i < 4; i++) {
      let a = (i * TWO_PI) / 4;
      t.line(0, 0, cos(a) * this.r, sin(a) * this.r);
      t.line(0, 0, cos(a + PI / 4) * this.r * 0.5, sin(a + PI / 4) * this.r * 0.5);
    }
    t.fill(this.hue, 40, 100, 70);
    t.noStroke();
    t.ellipse(0, 0, this.r * 0.4);
  }

  _drawHeart(t) {
    t.rotate(this.rot * 0.3);
    t.fill(this.hue, 70, 100, 80);
    t.noStroke();
    let s = this.r / 10;
    t.scale(s, s);
    t.beginShape();
    t.vertex(0, -3);
    t.bezierVertex(0, -8, 8, -8, 8, -3);
    t.bezierVertex(8, 2, 0, 8, 0, 12);
    t.bezierVertex(0, 8, -8, 2, -8, -3);
    t.bezierVertex(-8, -8, 0, -8, 0, -3);
    t.endShape(CLOSE);
  }

  _drawPetal(t) {
    t.rotate(this.rot);
    t.fill(this.hue, 45, 100, 70);
    t.stroke(this.hue, 50, 85, 50);
    t.strokeWeight(0.5);
    t.ellipse(0, -this.r * 0.5, this.r * 0.45, this.r * 0.95);
    t.stroke(this.hue, 30, 90, 60);
    t.strokeWeight(0.8);
    t.line(0, -this.r * 0.05, 0, -this.r * 0.9);
  }

  _drawSnow(t) {
    t.rotate(this.rot);
    t.stroke(200, 30, 100, 85);
    t.strokeWeight(1.2);
    t.noFill();
    for (let i = 0; i < 6; i++) {
      t.push();
      t.rotate((i * TWO_PI) / 6);
      t.line(0, 0, 0, -this.r);
      t.line(0, -this.r * 0.5, this.r * 0.25, -this.r * 0.72);
      t.line(0, -this.r * 0.5, -this.r * 0.25, -this.r * 0.72);
      t.pop();
    }
    t.fill(200, 20, 100, 60);
    t.noStroke();
    t.ellipse(0, 0, this.r * 0.35);
  }

  isOffScreen() {
    return this.y < -100;
  }
}