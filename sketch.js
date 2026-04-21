/**
 * ✨ 泡泡拍照濾鏡 — 完整整合版 v3
 * 功能：
 *   - 彩色粒子系統（泡泡/星星/花瓣/雪花/愛心）
 *   - 粒子特效模式切換（5 種）
 *   - 色調濾鏡（正常/黑白/復古/冷色/暖色/夢幻紫）← 新增
 *   - 美顏濾鏡（亮膚/提亮對比）← 新增
 *   - 像素/Glitch 藝術風（像素化/RGB 色差）← 新增
 *   - 螢幕補光燈（常亮，強度可調）
 *   - 倒數計時拍照 + 閃光效果
 *   - 拍照預覽 + 儲存
 *
 * 注意：色調/美顏/Glitch 濾鏡使用 p5.js 的 loadPixels() / updatePixels()
 *       在攝影機解析度高時可能略有效能消耗，建議使用 720p 以下解析度。
 *
 * 使用方式：在 HTML 引入 p5.js 後，將此檔案作為 sketch.js 載入即可。
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js"></script>
 * <script src="bubble_camera.js"></script>
 */

// ── 全域變數 ─────────────────────────────────
let capture;
let pg;           // 粒子離屏畫布
let filterPg;     // 色調/美顏/Glitch 離屏畫布
let particles = [];
let snapshot = null;

// 倒數 & 閃光
let countdown = 0;
let countdownTimer = null;
let flashAlpha = 0;

// 補光燈
let torchOn = false;
let torchStrength = 60;

// ── 粒子特效模式（5 種） ─────────────────────
const PARTICLE_MODES = [
  { name: '🫧 夢幻泡泡', types: ['bubble'] },
  { name: '⭐ 星空閃爍', types: ['star', 'sparkle'] },
  { name: '🌸 花瓣飄落', types: ['petal', 'heart'] },
  { name: '❄️ 冬日雪花', types: ['snow', 'bubble'] },
  { name: '💛 彩虹混合', types: ['bubble', 'star', 'heart', 'petal'] },
];
let particleModeIndex = 0;

// ── 色調濾鏡（6 種） ─────────────────────────
// 每種濾鏡定義一個 applyToPixels(pixels, w, h) 函式
const COLOR_FILTERS = [
  { name: '🎨 正常',   id: 'normal'  },
  { name: '⬛ 黑白',   id: 'bw'      },
  { name: '📷 復古',   id: 'retro'   },
  { name: '🧊 冷色',   id: 'cool'    },
  { name: '🔥 暖色',   id: 'warm'    },
  { name: '💜 夢幻紫', id: 'purple'  },
];
let colorFilterIndex = 0;

// ── 美顏模式（3 種） ─────────────────────────
const BEAUTY_MODES = [
  { name: '✨ 原始',   id: 'none'     },
  { name: '🌟 亮膚',   id: 'brighten' },
  { name: '💎 提亮對比', id: 'vivid'  },
];
let beautyModeIndex = 0;

// ── Glitch/像素模式（3 種） ──────────────────
const GLITCH_MODES = [
  { name: '🔲 無特效',  id: 'none'    },
  { name: '🟫 像素化',  id: 'pixel'   },
  { name: '📡 RGB偏移', id: 'glitch'  },
];
let glitchModeIndex = 0;

// ── UI 元素 ──────────────────────────────────
let btnParticleMode, btnColorFilter, btnBeauty, btnGlitch;
let btnTorch, btnCountdown, btnSave;
let torchSlider, torchSliderWrap, torchValueLabel;
let uiContainer, topBarContainer;
let particleLabel, filterLabel;

// ────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1); // 避免 Retina 螢幕讓 loadPixels 消耗過大

  capture = createCapture(VIDEO);
  capture.hide();

  pg = createGraphics(640, 480);
  pg.colorMode(HSB, 360, 100, 100, 100);

  filterPg = createGraphics(640, 480);

  setupUI();
}

// ────────────────────────────────────────────
function draw() {
  background(280, 30, 95);

  // ── 計算影像顯示區域 ──
  let scaleFactor = width < height ? 0.85 : 0.6;
  let imgW = width * scaleFactor;
  let imgH = (imgW * (capture.height || 480)) / (capture.width || 640);
  if (imgH > height * 0.72) {
    imgH = height * 0.72;
    imgW = (imgH * (capture.width || 640)) / (capture.height || 480);
  }
  let xOff = (width - imgW) / 2;
  let yOff = (height - imgH) / 2 - 30;

  // ── 同步 filterPg 尺寸 ──
  if (filterPg.width !== Math.round(imgW) || filterPg.height !== Math.round(imgH)) {
    filterPg.resizeCanvas(Math.round(imgW), Math.round(imgH));
  }

  // ── 更新粒子圖層 ──
  updateParticleLayer();

  // ── 將攝影機畫面 + 濾鏡繪製到 filterPg ──
  applyAllFilters(imgW, imgH);

  // ── 主畫布：鏡像繪製 ──
  push();
  translate(width, 0);
  scale(-1, 1);

  // 已處理完濾鏡的影像
  image(filterPg, xOff, yOff, imgW, imgH);

  // 粒子疊加層
  image(pg, xOff, yOff, imgW, imgH);

  // 裝飾框
  stroke(0, 0, 100, 55);
  strokeWeight(max(2, width * 0.003));
  noFill();
  rect(xOff, yOff, imgW, imgH, 8);
  pop();

  // ── 螢幕補光燈 ──
  if (torchOn) {
    colorMode(RGB, 255);
    fill(255, 255, 255, map(torchStrength, 0, 100, 0, 210));
    noStroke();
    rect(xOff, yOff, imgW, imgH, 8);
    colorMode(HSB, 360, 100, 100, 100);
  }

  // ── 倒數 ──
  if (countdown > 0) drawCountdown(xOff, yOff, imgW, imgH);

  // ── 拍照閃光 ──
  if (flashAlpha > 0) {
    colorMode(RGB, 255);
    fill(255, 255, 255, flashAlpha);
    noStroke();
    rect(0, 0, width, height);
    colorMode(HSB, 360, 100, 100, 100);
    flashAlpha = max(0, flashAlpha - 18);
  }

  // ── 拍照預覽 ──
  if (snapshot) drawPreview(snapshot);

  updateUIStyle();
}

// ════════════════════════════════════════════
// 濾鏡核心：把所有色調/美顏/Glitch 套用到 filterPg
// ════════════════════════════════════════════
function applyAllFilters(imgW, imgH) {
  // 先把攝影機畫面畫到 filterPg
  filterPg.clear();
  filterPg.image(capture, 0, 0, imgW, imgH);

  let gm = GLITCH_MODES[glitchModeIndex].id;

  // Glitch 模式：像素化（不需 loadPixels，用 drawingContext 縮放實現）
  if (gm === 'pixel') {
    let blockSize = 12;
    // 縮小再放大
    let tempW = Math.ceil(imgW / blockSize);
    let tempH = Math.ceil(imgH / blockSize);
    let ctx = filterPg.drawingContext;
    ctx.imageSmoothingEnabled = false;
    // 縮小
    ctx.drawImage(ctx.canvas, 0, 0, tempW, tempH);
    // 清掉再放大
    ctx.clearRect(0, 0, imgW, imgH);
    ctx.drawImage(ctx.canvas, 0, 0, tempW, tempH, 0, 0, imgW, imgH);
    return; // 像素化模式略過其他像素處理（避免效能過差）
  }

  // 其他模式：loadPixels 像素逐格處理
  filterPg.loadPixels();
  let d = filterPg.pixels;
  let len = d.length;

  let cfId = COLOR_FILTERS[colorFilterIndex].id;
  let bmId = BEAUTY_MODES[beautyModeIndex].id;

  for (let i = 0; i < len; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];

    // ── 1. 色調濾鏡 ──
    if (cfId === 'bw') {
      let gray = 0.299*r + 0.587*g + 0.114*b;
      r = g = b = gray;

    } else if (cfId === 'retro') {
      // 仿底片：提升紅/綠，壓低藍，加入輕微褪色
      let nr = min(255, r * 1.1 + 20);
      let ng = min(255, g * 1.0 + 10);
      let nb = min(255, b * 0.7 + 20);
      r = nr; g = ng; b = nb;

    } else if (cfId === 'cool') {
      // 冷色：提升藍，稍降紅
      r = max(0, r * 0.85);
      g = g * 0.95;
      b = min(255, b * 1.15 + 15);

    } else if (cfId === 'warm') {
      // 暖色：提升紅/橙，壓藍
      r = min(255, r * 1.15 + 15);
      g = min(255, g * 1.05);
      b = max(0, b * 0.8);

    } else if (cfId === 'purple') {
      // 夢幻紫：提升紅藍、壓綠
      r = min(255, r * 1.1 + 20);
      g = max(0, g * 0.75);
      b = min(255, b * 1.2 + 30);
    }

    // ── 2. 美顏濾鏡 ──
    if (bmId === 'brighten') {
      // 亮膚：整體提亮，膚色範圍加強
      r = min(255, r + 25);
      g = min(255, g + 18);
      b = min(255, b + 10);

    } else if (bmId === 'vivid') {
      // 提亮對比：S 曲線近似（中間調提亮，暗部略壓）
      r = min(255, ((r / 255 - 0.5) * 1.3 + 0.5 + 0.05) * 255);
      g = min(255, ((g / 255 - 0.5) * 1.3 + 0.5 + 0.05) * 255);
      b = min(255, ((b / 255 - 0.5) * 1.3 + 0.5 + 0.05) * 255);
      r = max(0, r); g = max(0, g); b = max(0, b);
    }

    // ── 3. RGB 色差 Glitch ──
    // 偏移量用 frameCount 製造動態感
    if (gm === 'glitch') {
      // 只對 R 通道做水平偏移讀取（在 updatePixels 後另外處理）
      // 這裡先標記：實際在獨立 pass 處理
    }

    d[i] = r; d[i+1] = g; d[i+2] = b;
  }

  filterPg.updatePixels();

  // ── Glitch RGB 偏移：獨立 pass ──
  if (gm === 'glitch') {
    applyGlitchRGB(imgW, imgH);
  }
}

// RGB 色差偏移：複製畫面後對 R / B 通道做水平位移
function applyGlitchRGB(imgW, imgH) {
  filterPg.loadPixels();
  let src = new Uint8ClampedArray(filterPg.pixels); // 複製原始像素
  let d   = filterPg.pixels;
  let w   = filterPg.width;
  let h   = filterPg.height;

  // 偏移量：跟著 frameCount 緩慢震動
  let shiftR = Math.round(sin(frameCount * 0.07) * 8 + cos(frameCount * 0.13) * 4);
  let shiftB = -shiftR; // B 往反方向偏

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = (y * w + x) * 4;

      // R 通道：從 x + shiftR 位置讀取
      let xR = Math.min(w - 1, Math.max(0, x + shiftR));
      let idxR = (y * w + xR) * 4;

      // B 通道：從 x + shiftB 位置讀取
      let xB = Math.min(w - 1, Math.max(0, x + shiftB));
      let idxB = (y * w + xB) * 4;

      d[idx]     = src[idxR];     // R 偏移
      d[idx + 1] = src[idx + 1];  // G 不變
      d[idx + 2] = src[idxB + 2]; // B 偏移
      // alpha 不變
    }
  }
  filterPg.updatePixels();
}

// ════════════════════════════════════════════
// 粒子圖層
// ════════════════════════════════════════════
function updateParticleLayer() {
  if (capture.loadedmetadata) {
    if (pg.width !== capture.width || pg.height !== capture.height) {
      pg.resizeCanvas(capture.width, capture.height);
      pg.colorMode(HSB, 360, 100, 100, 100);
    }
  }
  pg.clear();

  let mode = PARTICLE_MODES[particleModeIndex];
  if (random(1) < 0.15) {
    particles.push(new Particle(pg.width, pg.height, random(mode.types)));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].move();
    particles[i].display(pg);
    if (particles[i].isOffScreen()) particles.splice(i, 1);
  }
}

// ════════════════════════════════════════════
// 倒數 & 拍照
// ════════════════════════════════════════════
function drawCountdown(x, y, w, h) {
  let cx = x + w / 2, cy = y + h / 2;
  let pulse = sin(frameCount * 0.15) * 15;
  colorMode(RGB, 255);
  noFill();
  stroke(180, 100, 255, 120); strokeWeight(3);
  ellipse(cx, cy, 120 + pulse, 120 + pulse);
  stroke(180, 100, 255, 60);  strokeWeight(8);
  ellipse(cx, cy, 150 + pulse, 150 + pulse);
  fill(255, 255, 255, 230); noStroke();
  textAlign(CENTER, CENTER); textSize(80); textStyle(BOLD);
  text(countdown, cx, cy);
  colorMode(HSB, 360, 100, 100, 100);
}

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
    snapshot = get((width - imgW) / 2, (height - imgH) / 2 - 30, imgW, imgH);
    btnSave.show();
    btnCountdown.elt.disabled = false;
  }, 80);
}

function savePhoto() {
  if (snapshot) {
    save(snapshot, 'snap_' + nf(hour(),2) + nf(minute(),2) + nf(second(),2) + '.png');
  }
}

// ════════════════════════════════════════════
// 模式切換函式
// ════════════════════════════════════════════
function switchParticleMode() {
  particleModeIndex = (particleModeIndex + 1) % PARTICLE_MODES.length;
  particles = [];
  particleLabel.html(PARTICLE_MODES[particleModeIndex].name);
}

function switchColorFilter() {
  colorFilterIndex = (colorFilterIndex + 1) % COLOR_FILTERS.length;
  btnColorFilter.html(COLOR_FILTERS[colorFilterIndex].name);
}

function switchBeauty() {
  beautyModeIndex = (beautyModeIndex + 1) % BEAUTY_MODES.length;
  btnBeauty.html(BEAUTY_MODES[beautyModeIndex].name);
}

function switchGlitch() {
  glitchModeIndex = (glitchModeIndex + 1) % GLITCH_MODES.length;
  btnGlitch.html(GLITCH_MODES[glitchModeIndex].name);
}

function toggleTorch() {
  torchOn = !torchOn;
  btnTorch.html(torchOn ? '💡 補光：開' : '🔦 補光：關');
  btnTorch.style('background', torchOn
    ? 'linear-gradient(135deg,#f9c74f,#f8961e)'
    : 'linear-gradient(135deg,#555,#777)');
  torchSliderWrap.style('display', torchOn ? 'flex' : 'none');
}

// ════════════════════════════════════════════
// 預覽圖
// ════════════════════════════════════════════
function drawPreview(img) {
  let pw = width < 600 ? width * 0.25 : 120;
  let ph = (pw * img.height) / img.width;
  let px = width - pw - 20, py = 20;
  colorMode(RGB, 255);
  fill(255, 255, 255, 200); noStroke();
  rect(px - 6, py - 6, pw + 12, ph + 12, 10);
  image(img, px, py, pw, ph);
  colorMode(HSB, 360, 100, 100, 100);
}

// ════════════════════════════════════════════
// UI 建立
// ════════════════════════════════════════════
function setupUI() {
  // ── 頂部標籤列（粒子特效名稱） ──
  topBarContainer = createDiv('');
  topBarContainer.style('position', 'absolute');
  topBarContainer.style('top', '16px');
  topBarContainer.style('left', '0');
  topBarContainer.style('width', '100%');
  topBarContainer.style('display', 'flex');
  topBarContainer.style('justify-content', 'center');
  topBarContainer.style('pointer-events', 'none');

  particleLabel = createDiv(PARTICLE_MODES[0].name);
  particleLabel.parent(topBarContainer);
  particleLabel.style('font-size', '14px');
  particleLabel.style('font-weight', '700');
  particleLabel.style('color', 'rgba(70,40,120,0.88)');
  particleLabel.style('letter-spacing', '1px');
  particleLabel.style('background', 'rgba(255,255,255,0.55)');
  particleLabel.style('padding', '4px 14px');
  particleLabel.style('border-radius', '20px');

  // ── 底部控制面板 ──
  uiContainer = createDiv('');
  uiContainer.style('position', 'absolute');
  uiContainer.style('bottom', '18px');
  uiContainer.style('width', '100%');
  uiContainer.style('display', 'flex');
  uiContainer.style('flex-direction', 'column');
  uiContainer.style('align-items', 'center');
  uiContainer.style('gap', '8px');

  // 補光滑桿（隱藏）
  torchSliderWrap = createDiv('');
  torchSliderWrap.parent(uiContainer);
  torchSliderWrap.style('display', 'none');
  torchSliderWrap.style('align-items', 'center');
  torchSliderWrap.style('gap', '8px');
  torchSliderWrap.style('background', 'rgba(255,255,255,0.60)');
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

  // ── 濾鏡按鈕列（上排） ──
  let filterRow = createDiv('');
  filterRow.parent(uiContainer);
  filterRow.style('display', 'flex');
  filterRow.style('gap', '8px');
  filterRow.style('justify-content', 'center');
  filterRow.style('flex-wrap', 'wrap');

  btnColorFilter = createButton(COLOR_FILTERS[0].name);
  btnColorFilter.parent(filterRow);
  btnColorFilter.mousePressed(switchColorFilter);

  btnBeauty = createButton(BEAUTY_MODES[0].name);
  btnBeauty.parent(filterRow);
  btnBeauty.mousePressed(switchBeauty);

  btnGlitch = createButton(GLITCH_MODES[0].name);
  btnGlitch.parent(filterRow);
  btnGlitch.mousePressed(switchGlitch);

  // ── 主按鈕列（下排） ──
  let btnRow = createDiv('');
  btnRow.parent(uiContainer);
  btnRow.style('display', 'flex');
  btnRow.style('gap', '8px');
  btnRow.style('justify-content', 'center');
  btnRow.style('flex-wrap', 'wrap');

  btnParticleMode = createButton('🎨 粒子特效');
  btnParticleMode.parent(btnRow);
  btnParticleMode.mousePressed(switchParticleMode);

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
  let fs  = isMobile ? '12px' : '14px';
  let pd  = isMobile ? '7px 13px' : '10px 20px';

  let allBtns = [btnParticleMode, btnColorFilter, btnBeauty,
                 btnGlitch, btnTorch, btnCountdown, btnSave];
  allBtns.forEach(b => {
    b.style('padding', pd);
    b.style('font-size', fs);
    b.style('border-radius', '50px');
    b.style('border', 'none');
    b.style('font-weight', 'bold');
    b.style('cursor', 'pointer');
    b.style('color', 'white');
    b.style('box-shadow', '0 4px 16px rgba(100,60,180,0.20)');
  });

  // 色調濾鏡按鈕：青紫漸層
  btnColorFilter.style('background', 'linear-gradient(135deg,#48cae4,#7b2d8b)');
  // 美顏按鈕：珊瑚粉
  btnBeauty.style('background', 'linear-gradient(135deg,#f48fb1,#e91e8c)');
  // Glitch 按鈕：霓虹綠
  btnGlitch.style('background', 'linear-gradient(135deg,#00c896,#008f6a)');
  // 粒子特效
  btnParticleMode.style('background', 'linear-gradient(135deg,#9b72cf,#c491d3)');
  // 倒數
  btnCountdown.style('background', 'linear-gradient(135deg,#6a4c93,#9b72cf)');
  // 儲存
  btnSave.style('background', 'linear-gradient(135deg,#ff595e,#ff8c66)');
  // 補光燈
  if (!torchOn) btnTorch.style('background', 'linear-gradient(135deg,#555,#777)');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ════════════════════════════════════════════
// 粒子類別
// ════════════════════════════════════════════
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
    t.stroke(this.hue, 60, 100, 75); t.strokeWeight(1.8);
    t.ellipse(0, 0, this.r * 2);
    t.fill(0, 0, 100, 55); t.noStroke();
    t.ellipse(-this.r*0.3, -this.r*0.3, this.r*0.45);
    t.fill(this.hue, 30, 100, 25);
    t.ellipse(this.r*0.15, this.r*0.35, this.r*0.6, this.r*0.25);
  }

  _drawStar(t) {
    t.rotate(this.rot);
    t.fill(this.hue, 80, 100, 85); t.noStroke();
    let sp=5, inner=this.r*0.4, outer=this.r;
    t.beginShape();
    for (let i=0; i<sp*2; i++) {
      let a=(i*PI)/sp - PI/2, r=i%2===0?outer:inner;
      t.vertex(cos(a)*r, sin(a)*r);
    }
    t.endShape(CLOSE);
    t.fill(this.hue, 60, 100, 30);
    t.ellipse(0, 0, this.r*2.5, this.r*2.5);
  }

  _drawSparkle(t) {
    t.rotate(this.rot);
    t.stroke(this.hue, 50, 100, 90); t.strokeWeight(1.5); t.noFill();
    for (let i=0; i<4; i++) {
      let a=(i*TWO_PI)/4;
      t.line(0,0,cos(a)*this.r,sin(a)*this.r);
      t.line(0,0,cos(a+PI/4)*this.r*0.5,sin(a+PI/4)*this.r*0.5);
    }
    t.fill(this.hue, 40, 100, 70); t.noStroke();
    t.ellipse(0, 0, this.r*0.4);
  }

  _drawHeart(t) {
    t.rotate(this.rot*0.3);
    t.fill(this.hue, 70, 100, 80); t.noStroke();
    let s=this.r/10; t.scale(s,s);
    t.beginShape();
    t.vertex(0,-3);
    t.bezierVertex(0,-8,8,-8,8,-3);
    t.bezierVertex(8,2,0,8,0,12);
    t.bezierVertex(0,8,-8,2,-8,-3);
    t.bezierVertex(-8,-8,0,-8,0,-3);
    t.endShape(CLOSE);
  }

  _drawPetal(t) {
    t.rotate(this.rot);
    t.fill(this.hue, 45, 100, 70);
    t.stroke(this.hue, 50, 85, 50); t.strokeWeight(0.5);
    t.ellipse(0,-this.r*0.5,this.r*0.45,this.r*0.95);
    t.stroke(this.hue, 30, 90, 60); t.strokeWeight(0.8);
    t.line(0,-this.r*0.05,0,-this.r*0.9);
  }

  _drawSnow(t) {
    t.rotate(this.rot);
    t.stroke(200,30,100,85); t.strokeWeight(1.2); t.noFill();
    for (let i=0; i<6; i++) {
      t.push(); t.rotate((i*TWO_PI)/6);
      t.line(0,0,0,-this.r);
      t.line(0,-this.r*0.5,this.r*0.25,-this.r*0.72);
      t.line(0,-this.r*0.5,-this.r*0.25,-this.r*0.72);
      t.pop();
    }
    t.fill(200,20,100,60); t.noStroke();
    t.ellipse(0,0,this.r*0.35);
  }

  isOffScreen() { return this.y < -100; }
}