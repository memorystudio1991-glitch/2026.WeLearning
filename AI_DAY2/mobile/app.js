/**
 * ==========================================================================
 *  [AI_DAY2] PoseLens AI - 모바일 실시간 인체 스켈레톤 & 비전 분석 (app.js)
 * ==========================================================================
 *  - 기능:
 *    1. 스마트폰 카메라(전면/후면) 실시간 비디오 스트림 획득
 *    2. MediaPipe Pose 인공지능을 통한 33개 관절 랜드마크 추출
 *    3. 상의 영역(Torso) 픽셀 샘플링을 통한 실시간 옷 색깔(Color) 감지
 *    4. 어깨/골반 비율(Shoulder-to-Hip) 기반 성별 및 체형 추정
 *    5. 화각 및 자세(상반신 / 전신 / 앉음) 실시간 감지
 *    6. 머리 위 플로팅 AI 비전 프로필 카드 렌더링
 *    7. 사진 캡처 및 다운로드 기능 제공
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// [1단계] 주요 DOM 요소 및 상태 변수 초기화
// --------------------------------------------------------------------------
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const startOverlay = document.getElementById('start-overlay');
const btnStartCamera = document.getElementById('btn-start-camera');
const modelLoader = document.getElementById('model-loader');

const btnSwitchCamera = document.getElementById('btn-switch-camera');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const btnCapture = document.getElementById('btn-capture');

const statusBadge = document.getElementById('status-badge');
const statusDot = statusBadge.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const fpsValue = document.getElementById('fps-value');
const modeText = document.getElementById('mode-text');

// 프로필 데이터 DOM
const clothColorDot = document.getElementById('cloth-color-dot');
const clothColorText = document.getElementById('cloth-color-text');
const genderText = document.getElementById('gender-text');

// 앱 상태 관리
let currentStream = null;
let currentFacingMode = 'user'; // 'user' (전면 셀카) 또는 'environment' (후면 카메라)
let viewMode = 'overlay';       // 'overlay' (카메라+뼈대) 또는 'dark' (검은 배경+네온 뼈대)
let isModelReady = false;
let isProcessingFrame = false;

// FPS 계산용 변수
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 0;

// 프로필 데이터 스무딩
let smoothedColor = { name: "분석 중", hex: "#38bdf8" };
let smoothedGender = { text: "분석 중", color: "#38bdf8" };
let smoothedPosture = "상반신";
let colorHistory = [];
let genderHistory = [];

// 인체 관절 연결선 정의 (MediaPipe Pose 33개 랜드마크 페어)
const POSE_CONNECTIONS = [
  // 얼굴
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // 상체 (어깨, 팔, 손목)
  [11, 12], [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19], // 왼손
  [16, 18], [16, 20], [16, 22], [18, 20], // 오른손
  // 몸통
  [11, 23], [12, 24], [23, 24],
  // 하체 (골반, 무릎, 발목, 발)
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // 왼다리
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]  // 오른다리
];

// --------------------------------------------------------------------------
// [2단계] MediaPipe Pose 인공지능 모델 로드 및 설정
// --------------------------------------------------------------------------
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onPoseResults);

// --------------------------------------------------------------------------
// [3단계] 스마트폰 카메라 시작 및 전/후면 전환 제어
// --------------------------------------------------------------------------
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  statusText.textContent = "카메라 연결 중...";
  statusDot.classList.remove('active');

  const constraints = {
    audio: false,
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      statusText.textContent = "AI 모델 로딩 중...";
      modelLoader.classList.remove('hidden');
      requestAnimationFrame(processVideoFrame);
    };
  } catch (err) {
    console.error("카메라 열기 실패:", err);
    alert("카메라 권한을 얻을 수 없습니다.\n브라우저 설정에서 카메라 권한을 확인해 주세요.");
    statusText.textContent = "카메라 오류";
  }
}

// --------------------------------------------------------------------------
// [4단계] 실시간 비디오 프레임 추출 및 AI 분석 루프
// --------------------------------------------------------------------------
async function processVideoFrame() {
  if (video.readyState >= 2 && !isProcessingFrame) {
    isProcessingFrame = true;
    try {
      await pose.send({ image: video });
    } catch (e) {
      console.warn("추론 지연:", e);
    }
    isProcessingFrame = false;
  }
  requestAnimationFrame(processVideoFrame);
}

// --------------------------------------------------------------------------
// [5단계] 시각 데이터 분석 알고리즘 (옷 색깔, 성별 추정, 자세)
// --------------------------------------------------------------------------

/**
 * 5-1. 상의(Torso) 영역 픽셀을 샘플링하여 옷 색상 판별
 */
function analyzeClothingColor(ctx, landmarks, w, h, isFrontCamera) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder) {
    return { name: "알 수 없음", hex: "#94a3b8" };
  }

  // 상체 중심점(가슴/복부 영역) 계산
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

  let targetY;
  if (leftHip && rightHip && leftHip.visibility > 0.3 && rightHip.visibility > 0.3) {
    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    targetY = shoulderCenterY * 0.4 + hipCenterY * 0.6; // 상의 중심부
  } else {
    targetY = shoulderCenterY + shoulderWidth * 0.45; // 골반 미인식 시 어깨 기준 하단
  }

  // 화면 픽셀 좌표 변환
  const pxX = Math.round(shoulderCenterX * w);
  const pxY = Math.round(targetY * h);

  // 샘플링 영역 (반경 16px 내 25개 점 평균)
  const sampleRadius = Math.max(10, Math.round(shoulderWidth * w * 0.08));
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  try {
    const imgData = ctx.getImageData(
      Math.max(0, pxX - sampleRadius),
      Math.max(0, pxY - sampleRadius),
      sampleRadius * 2,
      sampleRadius * 2
    );
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 16) { // 4픽셀 단위 스킵 샘플링
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      count++;
    }
  } catch (err) {
    return { name: "추출 중", hex: "#94a3b8" };
  }

  if (count === 0) return { name: "분석 중", hex: "#94a3b8" };

  const r = Math.round(totalR / count);
  const g = Math.round(totalG / count);
  const b = Math.round(totalB / count);

  return classifyColor(r, g, b);
}

/**
 * RGB 값을 직관적인 한국어 색상명 및 헥스 코드로 분류
 */
function classifyColor(r, g, b) {
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  // 1. 명도 및 채도 극단치 (블랙, 화이트, 그레이)
  if (brightness < 45) {
    return { name: "블랙", hex: "#1e293b", badge: "#0f172a" };
  }
  if (brightness > 200 && saturation < 0.16) {
    return { name: "화이트", hex: "#f8fafc", badge: "#e2e8f0" };
  }
  if (saturation < 0.16) {
    return { name: "그레이", hex: "#64748b", badge: "#475569" };
  }

  // 2. 색상환(Hue) 계산 (0~360도)
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  // 3. 색상별 판별
  if (h >= 345 || h < 14) {
    return { name: "레드", hex: "#ef4444", badge: "#dc2626" };
  } else if (h >= 14 && h < 42) {
    if (brightness < 100) return { name: "브라운", hex: "#854d0e", badge: "#713f12" };
    return { name: "오렌지", hex: "#f97316", badge: "#ea580c" };
  } else if (h >= 42 && h < 68) {
    if (saturation < 0.35) return { name: "베이지", hex: "#d4b996", badge: "#b89772" };
    return { name: "옐로우", hex: "#eab308", badge: "#ca8a04" };
  } else if (h >= 68 && h < 165) {
    return { name: "그린", hex: "#22c55e", badge: "#16a34a" };
  } else if (h >= 165 && h < 205) {
    return { name: "스카이/민트", hex: "#06b6d4", badge: "#0891b2" };
  } else if (h >= 205 && h < 260) {
    if (brightness < 85) return { name: "네이비", hex: "#1e3a8a", badge: "#172554" };
    return { name: "블루", hex: "#3b82f6", badge: "#2563eb" };
  } else if (h >= 260 && h < 315) {
    return { name: "퍼플", hex: "#a855f7", badge: "#9333ea" };
  } else {
    return { name: "핑크", hex: "#ec4899", badge: "#db2777" };
  }
}

/**
 * 5-2. 어깨-골반 비율 기반 성별 및 체형 추정
 */
function analyzeGenderAndBody(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];

  if (!leftShoulder || !rightShoulder) {
    return { text: "성별: 분석 중", color: "#38bdf8" };
  }

  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

  // 골반이 인식된 경우 (전신/중거리)
  if (leftHip && rightHip && leftHip.visibility > 0.4 && rightHip.visibility > 0.4) {
    const hipWidth = Math.hypot(leftHip.x - rightHip.x, leftHip.y - rightHip.y);
    const ratio = shoulderWidth / Math.max(0.01, hipWidth);

    if (ratio >= 1.26) {
      return { text: "남성 추정 (역삼각형 체형)", color: "#38bdf8" };
    } else if (ratio <= 1.15) {
      return { text: "여성 추정 (골반 균형 체형)", color: "#f472b6" };
    } else {
      return { text: "슬림/표준 체형", color: "#a78bfa" };
    }
  }

  // 상반신 클로즈업인 경우 (어깨 너비 대 머리 높이 비율)
  if (nose) {
    const headHeight = Math.abs(leftShoulder.y - nose.y);
    const upperRatio = shoulderWidth / Math.max(0.01, headHeight);
    if (upperRatio > 1.85) {
      return { text: "남성 추정 (넓은 어깨형)", color: "#38bdf8" };
    } else {
      return { text: "여성 추정 (슬림 어깨형)", color: "#f472b6" };
    }
  }

  return { text: "체형 분석 중", color: "#38bdf8" };
}

/**
 * 5-3. 거리 및 자세 상태 판별
 */
function analyzePosture(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];

  if ((leftAnkle && leftAnkle.visibility > 0.4) || (rightAnkle && rightAnkle.visibility > 0.4)) {
    return "전신 (Full Body)";
  } else if ((leftKnee && leftKnee.visibility > 0.4) || (rightKnee && rightKnee.visibility > 0.4)) {
    return "미디엄 샷 (하체 일부)";
  } else {
    return "상반신 (Close-up)";
  }
}

// --------------------------------------------------------------------------
// [6단계] 캔버스 시각화 (스켈레톤 및 머리 위 AI 비전 카드 렌더링)
// --------------------------------------------------------------------------
function onPoseResults(results) {
  if (!isModelReady) {
    isModelReady = true;
    modelLoader.classList.add('hidden');
  }

  // FPS 계산
  const now = performance.now();
  frameCount++;
  if (now - lastFrameTime >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    fpsValue.textContent = currentFps;
    frameCount = 0;
    lastFrameTime = now;
  }

  const w = canvas.width;
  const h = canvas.height;
  const isFrontCamera = currentFacingMode === 'user';

  // 1. 영상 배경 렌더링 (전면 카메라는 거울 모드)
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  if (isFrontCamera) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  if (viewMode === 'overlay') {
    ctx.drawImage(results.image, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);
  }

  const landmarks = results.poseLandmarks;
  const isDetected = landmarks && landmarks.length > 0;
  let cardX = 0, cardY = 0, eyeDistPx = 60;

  if (isDetected) {
    statusText.textContent = "인체 감지 중";
    statusDot.classList.add('active');

    // 2. 뼈대 연결선 그리기 (네온 라인)
    ctx.lineWidth = 4;
    ctx.strokeStyle = viewMode === 'overlay' ? '#00f2fe' : '#00ff88';
    ctx.shadowColor = viewMode === 'overlay' ? '#00f2fe' : '#00ff88';
    ctx.shadowBlur = 12;

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    }

    // 3. 관절 점 그리기
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff007f';
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility || 1) > 0.4) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff007f';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    // 4. 시각 데이터 분석 (옷 색깔, 성별, 자세)
    const detectedColor = analyzeClothingColor(ctx, landmarks, w, h, isFrontCamera);
    const detectedGender = analyzeGenderAndBody(landmarks);
    const detectedPosture = analyzePosture(landmarks);

    // 스무딩 업데이트
    smoothedColor = detectedColor;
    smoothedGender = detectedGender;
    smoothedPosture = detectedPosture;

    // 머리 위 카드 위치 계산
    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    eyeDistPx = eyeDist * w;

    const rawHeadX = nose.x * w;
    cardX = isFrontCamera ? (w - rawHeadX) : rawHeadX;
    cardY = (nose.y - eyeDist * 1.6) * h;

  } else {
    statusText.textContent = "사람을 비춰주세요";
    statusDot.classList.remove('active');
  }

  ctx.restore(); // 거울 모드 해제

  // 5. 머리 위 AI 비전 프로필 카드 렌더링 (글자 뒤집힘 방지 정방향 렌더링)
  if (isDetected && cardY > 0) {
    drawVisionProfileCard(ctx, cardX, cardY, smoothedColor, smoothedGender, smoothedPosture, eyeDistPx);
  }

  // 6. 상단 HUD 실시간 배지 동기화
  clothColorDot.style.backgroundColor = smoothedColor.hex;
  clothColorText.textContent = `상의: ${smoothedColor.name}`;
  genderText.textContent = smoothedGender.text.replace(' (', ' · ').replace(')', '');
  genderText.style.color = smoothedGender.color;
}

// --------------------------------------------------------------------------
// [7단계] 머리 위 플로팅 AI 비전 프로필 카드 렌더링
// --------------------------------------------------------------------------
function drawVisionProfileCard(ctx, headX, headY, colorInfo, genderInfo, posture, eyeDistPx) {
  const cardWidth = Math.max(180, Math.min(240, eyeDistPx * 2.2));
  const cardHeight = 76;
  const radius = 14;
  const cardX = Math.max(12, Math.min(canvas.width - cardWidth - 12, headX - cardWidth / 2));
  const cardY = Math.max(68, headY - cardHeight - 12);

  ctx.save();

  // 1. 네온 글로우 카드 테두리 & 배경
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 14;

  ctx.fillStyle = 'rgba(10, 14, 23, 0.90)';
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.55)';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
  ctx.fill();
  ctx.stroke();

  // 2. 하단 꼬리표
  ctx.beginPath();
  ctx.moveTo(headX - 6, cardY + cardHeight);
  ctx.lineTo(headX, cardY + cardHeight + 8);
  ctx.lineTo(headX + 6, cardY + cardHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 3. 카드 내부 텍스트 렌더링
  // 헤더 타이틀
  ctx.font = 'bold 11px Pretendard, sans-serif';
  ctx.fillStyle = '#00f2fe';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ AI VISION PROFILE', cardX + 12, cardY + 18);

  // 1행: 성별/체형
  ctx.font = '12px Pretendard, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`👤 ${genderInfo.text}`, cardX + 12, cardY + 36);

  // 2행: 상의 옷 색깔 (컬러칩 서클 포함)
  ctx.fillText(`👕 상의: ${colorInfo.name}`, cardX + 12, cardY + 54);

  // 컬러칩 동그라미
  const textWidth = ctx.measureText(`👕 상의: ${colorInfo.name}`).width;
  ctx.beginPath();
  ctx.arc(cardX + 16 + textWidth + 8, cardY + 50, 5, 0, 2 * Math.PI);
  ctx.fillStyle = colorInfo.hex;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3행: 자세/화각
  ctx.font = '10px Pretendard, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`📏 ${posture}`, cardX + 12, cardY + 68);

  ctx.restore();
}

// --------------------------------------------------------------------------
// [8단계] 모바일 인터랙션 이벤트 핸들러
// --------------------------------------------------------------------------
btnStartCamera.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  startCamera();
});

btnSwitchCamera.addEventListener('click', () => {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera();
});

btnToggleMode.addEventListener('click', () => {
  if (viewMode === 'overlay') {
    viewMode = 'dark';
    modeText.textContent = "일반모드";
  } else {
    viewMode = 'overlay';
    modeText.textContent = "다크모드";
  }
});

btnCapture.addEventListener('click', () => {
  btnCapture.style.transform = 'scale(0.85)';
  setTimeout(() => { btnCapture.style.transform = ''; }, 150);

  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  link.download = `poselens_profile_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});
