/**
 * p5.js 完整專案：攝影機鏡像、動態泡泡疊加、拍照與下載功能
 */

let capture;    // 攝影機物件
let pg;         // 離屏畫布 (泡泡疊加層)
let bubbles = []; // 泡泡陣列

// UI 物件
let btnTakePic;   // 拍照按鈕
let btnSavePic;   // 儲存按鈕
let snapshot = null; // 儲存拍照後的圖片資料
let uiContainer;  // 按鈕容器

function setup() {
  // 1. 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  
  // 2. 啟動攝影機並隱藏原始影片元件
  capture = createCapture(VIDEO);
  capture.hide();

  // 3. 建立離屏畫布，初始寬高設為常見解析度
  pg = createGraphics(640, 480);

  // 4. 建立 HTML UI 介面
  setupUI();
}

function draw() {
  // 背景顏色 e7c6ff
  background('#e7c6ff');

  // 計算視訊顯示區域 (畫布寬高的 60%)
  let imgW = width * 0.6;
  let imgH = height * 0.6;
  let xOffset = (width - imgW) / 2;
  let yOffset = (height - imgH) / 2;

  // --- A. 更新泡泡圖層 (pg) ---
  if (capture.loadedmetadata) {
    if (pg.width !== capture.width || pg.height !== capture.height) {
      pg.resizeCanvas(capture.width, capture.height);
    }
  }

  pg.clear(); // 確保背景透明

  // 產生新泡泡
  if (random(1) < 0.12) {
    bubbles.push(new Bubble(pg.width, pg.height));
  }

  // 處理泡泡動作與顯示
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].move();
    bubbles[i].display(pg);
    if (bubbles[i].isOffScreen()) {
      bubbles.splice(i, 1);
    }
  }

  // --- B. 繪製主畫面 (含鏡像處理) ---
  push();
  // 鏡像修正：平移至右端並將 X 軸翻轉
  translate(width, 0);
  scale(-1, 1);

  // 繪製攝影機畫面
  image(capture, xOffset, yOffset, imgW, imgH);

  // 繪製泡泡層 (疊加在視訊上)
  image(pg, xOffset, yOffset, imgW, imgH);
  
  // 畫一個簡單的白色邊框
  stroke(255);
  strokeWeight(2);
  noFill();
  rect(xOffset, yOffset, imgW, imgH);
  pop();

  // --- C. 拍照預覽圖示 ---
  if (snapshot) {
    drawPreview(snapshot);
  }
}

// --- 功能函數：拍照 ---
function takeSnapshot() {
  let imgW = width * 0.6;
  let imgH = height * 0.6;
  let xOffset = (width - imgW) / 2;
  let yOffset = (height - imgH) / 2;
  
  // get() 會抓取主畫布內容，包含鏡像後的影像與泡泡
  snapshot = get(xOffset, yOffset, imgW, imgH);
  btnSavePic.show(); // 拍照後才顯示儲存按鈕
}

// --- 功能函數：儲存 ---
function savePhoto() {
  if (snapshot) {
    let name = 'bubble-photo-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2) + '.png';
    save(snapshot, name);
  }
}

// --- UI 相關設定 ---
function setupUI() {
  uiContainer = createDiv('');
  uiContainer.style('position', 'absolute');
  uiContainer.style('bottom', '30px');
  uiContainer.style('width', '100%');
  uiContainer.style('display', 'flex');
  uiContainer.style('justify-content', 'center');
  uiContainer.style('gap', '15px');

  btnTakePic = createButton('📷 拍照');
  btnTakePic.parent(uiContainer);
  applyButtonStyle(btnTakePic, '#6a4c93'); // 深紫色
  btnTakePic.mousePressed(takeSnapshot);

  btnSavePic = createButton('💾 儲存照片');
  btnSavePic.parent(uiContainer);
  applyButtonStyle(btnSavePic, '#ff595e'); // 粉紅色
  btnSavePic.mousePressed(savePhoto);
  btnSavePic.hide();
}

function applyButtonStyle(btn, col) {
  btn.style('padding', '12px 24px');
  btn.style('border-radius', '25px');
  btn.style('border', 'none');
  btn.style('background-color', col);
  btn.style('color', 'white');
  btn.style('font-size', '16px');
  btn.style('font-weight', 'bold');
  btn.style('cursor', 'pointer');
  btn.style('box-shadow', '0 4px 15px rgba(0,0,0,0.2)');
}

function drawPreview(img) {
  let pw = 150;
  let ph = (pw * img.height) / img.width;
  let px = 20;
  let py = 20;
  
  fill(255, 150);
  noStroke();
  rect(px - 5, py - 5, pw + 10, ph + 30, 10);
  image(img, px, py, pw, ph);
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(12);
  text("最新照片預覽", px, py + ph + 15);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// --- 泡泡類別 ---
class Bubble {
  constructor(w, h) {
    this.x = random(w);
    this.y = h + 20;
    this.r = random(10, 30);
    this.speed = random(1.5, 4);
    this.noiseOffset = random(1000);
  }

  move() {
    this.y -= this.speed;
    // 使用 noise 讓移動更像在水中飄動
    this.x += map(noise(this.noiseOffset + frameCount * 0.02), 0, 1, -1.5, 1.5);
  }

  display(target) {
    target.push();
    target.stroke(255, 250);
    target.strokeWeight(1.5);
    target.fill(255, 255, 255, 60); // 極淺的半透明白
    target.ellipse(this.x, this.y, this.r * 2);
    
    // 反光效果
    target.noStroke();
    target.fill(255, 180);
    target.ellipse(this.x - this.r * 0.3, this.y - this.r * 0.4, this.r * 0.5, this.r * 0.3);
    target.pop();
  }

  isOffScreen() {
    return this.y < -50;
  }
}