let capture;

function setup() {
  // 第一步驟：產生一個全螢幕的畫布
  createCanvas(windowWidth, windowHeight);
  
  // 設定背景顏色為 e7c6ff
  background('#e7c6ff');

  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  
  // 隱藏預設產生的 HTML 影片元件，只在畫布上繪製
  capture.hide();
}

function draw() {
  // 每一影格重新繪製背景，避免影像重疊
  background('#e7c6ff');

  // 計算影像顯示的寬高（畫布寬高的 60%）
  let imgW = width * 0.6;
  let imgH = height * 0.6;

  // 計算置中座標
  let x = (width - imgW) / 2;
  let y = (height - imgH) / 2;

  // 將攝影機影像繪製在畫布中間
  image(capture, x, y, imgW, imgH);
}

// 當視窗大小改變時，自動調整畫布大小以維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}