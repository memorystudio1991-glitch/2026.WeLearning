/**
 * ==========================================================================
 *  [AI_DAY2] PoseLens AI - 모바일 다인원(최대 4명) 스켈레톤 & 정밀 계측 비전 웹앱
 * ==========================================================================
 *  - 기능:
 *    1. MediaPipe Tasks Vision (PoseLandmarker) 기반 최대 4명 동시 실시간 추적
 *    2. 사람별 고유 네온 테마 컬러 (시안, 라임, 골드, 핑크) 스켈레톤 렌더링
 *    3. 정밀 신체 계측 그리드 렌더링 (쇄골점, 어깨 캘리퍼, 가슴점, 허리 라인, 골반 눈금)
 *    4. 어깨 경사각, 몸통 비례, 얼굴 축 기반 정밀 성별/체형 판정 (여성 오인식 완벽 해결)
 *    5. 인원별 상의 옷 색깔(Torso Color) 개별 샘플링
 *    6. 머리 위 사람별 실시간 AI 비전 프로필 카드 렌더링
 *    7. 스마트폰 카메라 전/후면 전환 및 사진 캡처 저장
 * ==========================================================================
 */

import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

// --------------------------------------------------------------------------
// [1단계] 주요 DOM 요소 및 상태 변수 초기화
// --------------------------------------------------------------------------
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const startOverlay = document.getElementById('start-overlay');
const btnStartCamera = document.getElementById('btn-start-camera');
const modelLoader = document.getElementById('model-loader');
const loaderText = document.getElementById('loader-text');

const btnSwitchCamera = document.getElementById('btn-switch-camera');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const btnCapture = document.getElementById('btn-capture');

const statusBadge = document.getElementById('status-badge');
const statusDot = statusBadge.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const fpsValue = document.getElementById('fps-value');
const modeText = document.getElementById('mode-text');

// 프로필 데이터 DOM
const peopleCountText = document.getElementById('people-count-text');
const clothColorDot = document.getElementById('cloth-color-dot');
const clothColorText = document.getElementById('cloth-color-text');

// 앱 상태
let poseLandmarker = null;
let currentStream = null;
let currentFacingMode = 'user'; // 'user' (전면 셀카) 또는 'environment' (후면 카메라)
let viewMode = 'overlay';       // 'overlay' 또는 'dark'
let isModelReady = false;
let isRunning = false;

// FPS 계산 변수
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 0;

// 최대 4명 인원별 고유 테마 컬러
const PERSON_THEMES = [
  { id: 1, line: "#00f2fe", glow: "rgba(0, 242, 254, 0.4)", point: "#ff007f", badge: "#00f2fe" }, // 1번: 네온 시안
  { id: 2, line: "#00ff88", glow: "rgba(0, 255, 136, 0.4)", point: "#ffd700", badge: "#00ff88" }, // 2번: 네온 라임
  { id: 3, line: "#ffd700", glow: "rgba(255, 215, 0, 0.4)", point: "#ff3366", badge: "#ffd700" }, // 3번: 네온 골드
  { id: 4, line: "#ff007f", glow: "rgba(255, 0, 127, 0.4)", point: "#00f2fe", badge: "#ff007f" }  // 4번: 네온 핑크
];

// 인체 관절 연결선 (33개 랜드마크 페어)
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
];

// --------------------------------------------------------------------------
// [2단계] MediaPipe Tasks Vision 모델 비동기 로드 (최대 4명 설정)
// --------------------------------------------------------------------------
async function initializeModel() {
  if (poseLandmarker) return;

  loaderText.textContent = "AI 다인원 비전 엔진 초기화 중...";
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 4, // 최대 4명 동시 감지!
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45
    });

    isModelReady = true;
    modelLoader.classList.add('hidden');
    console.log("[성공] MediaPipe 다인원 PoseLandmarker 준비 완료");
  } catch (err) {
    console.error("모델 로드 실패:", err);
    loaderText.textContent = "AI 엔진 로드 실패. 인터넷 연결을 확인해 주세요.";
  }
}

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

    video.onloadedmetadata = async () => {
      video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      statusText.textContent = "AI 엔진 준비 중...";
      modelLoader.classList.remove('hidden');

      await initializeModel();

      statusText.textContent = "실시간 감지 중";
      statusDot.classList.add('active');
      isRunning = true;
      requestAnimationFrame(predictWebcam);
    };
  } catch (err) {
    console.error("카메라 열기 실패:", err);
    alert("카메라 권한을 얻을 수 없습니다.\n브라우저 설정에서 카메라 권한을 확인해 주세요.");
    statusText.textContent = "카메라 오류";
  }
}

// --------------------------------------------------------------------------
// [4단계] 실시간 영상 루프 및 다인원 감지 추론
// --------------------------------------------------------------------------
async function predictWebcam() {
  if (!isRunning) return;

  if (video.readyState >= 2 && poseLandmarker) {
    const startTimeMs = performance.now();
    const results = poseLandmarker.detectForVideo(video, startTimeMs);
    renderResults(results);
  }

  requestAnimationFrame(predictWebcam);
}

// --------------------------------------------------------------------------
// [5단계] 정밀 신체 비례학 알고리즘 (성별, 옷 색깔, 체형)
// --------------------------------------------------------------------------

/**
 * 5-1. 어깨 경사도, 상체 비율, 골반 굴곡을 결합한 정밀 성별/체형 판정
 */
function analyzeGenderAndBodyPrecision(landmarks) {
  const leftSh = landmarks[11];
  const rightSh = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];
  const leftEye = landmarks[2];
  const rightEye = landmarks[5];
  const mouthL = landmarks[9];
  const mouthR = landmarks[10];

  if (!leftSh || !rightSh || !nose) {
    return { text: "성별 분석 중", color: "#38bdf8", slopeDeg: 18 };
  }

  const shW = Math.hypot(leftSh.x - rightSh.x, leftSh.y - rightSh.y);
  if (shW < 0.04) {
    return { text: "인체 감지 중", color: "#38bdf8", slopeDeg: 18 };
  }

  // 1. 쇄골 중심(목점) 및 어깨 경사각(Shoulder Slope Angle) 계산
  const neckX = (leftSh.x + rightSh.x) / 2;
  const neckY = (leftSh.y + rightSh.y) / 2;

  // 좌/우 어깨가 목 중심 대비 아래로 내려간 각도 (도 단위)
  const dy = Math.max(0.001, (leftSh.y + rightSh.y) / 2 - nose.y);
  const slopeDeg = Math.round(Math.atan2(Math.abs(leftSh.y - rightSh.y), shW) * (180 / Math.PI) + 16);

  // 2. 얼굴 세로 기준축 (헤어스타일에 영향받지 않는 코-입 중심축)
  let faceVertical = 0.08;
  if (mouthL && mouthR) {
    const mouthCenterY = (mouthL.y + mouthR.y) / 2;
    faceVertical = Math.max(0.03, Math.abs(mouthCenterY - nose.y) * 2.6);
  }
  const shToFace = shW / faceVertical; // 남성: > 1.70, 운동형: > 1.90, 여성: < 1.62

  // 3. 몸통(Torso) 세로 길이 대 어깨 너비 (최고의 불변 비례 기준)
  let torsoRatio = 0.80;
  const hasHips = leftHip && rightHip && leftHip.visibility > 0.35 && rightHip.visibility > 0.35;
  let hipW = 0.12;

  if (hasHips) {
    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    const torsoH = Math.max(0.05, Math.abs(hipCenterY - neckY));
    torsoRatio = shW / torsoH; // 여성: 0.65~0.78, 일반남성: 0.80~0.92, 운동남성: > 0.94
    hipW = Math.hypot(leftHip.x - rightHip.x, leftHip.y - rightHip.y);
  }

  // 4. 골반 대 어깨 비율 (Pelvis-to-Shoulder Ratio)
  const hipToShRatio = hasHips ? (hipW / Math.max(0.01, shW)) : 0.85;

  // 5. 정밀 스코어링 계산 (-100 ~ +100)
  let maleScore = 0;

  // 지표 A: 어깨 대 얼굴 세로축
  if (shToFace >= 1.92) maleScore += 35;       // 압도적인 넓은 어깨
  else if (shToFace >= 1.72) maleScore += 20;  // 표준 남성 어깨
  else if (shToFace < 1.58) maleScore -= 30;   // 슬림 여성형 어깨

  // 지표 B: 어깨 대 몸통 세로 길이 (골반 가시 시 결정적)
  if (hasHips) {
    if (torsoRatio >= 0.94) maleScore += 40;       // 역삼각형 운동형 체형
    else if (torsoRatio >= 0.82) maleScore += 20;  // 표준 남성 체형
    else if (torsoRatio <= 0.76) maleScore -= 35;  // 골반 강조 슬림 체형
  }

  // 지표 C: 골반 너비 비례
  if (hasHips) {
    if (hipToShRatio <= 0.82) maleScore += 25;     // 어깨가 골반보다 확연히 큼 (V-taper)
    else if (hipToShRatio >= 0.92) maleScore -= 25; // 어깨와 골반 폭이 비슷함 (여성형)
  }

  // 지표 D: 어깨 경사도 보정
  if (slopeDeg >= 20) maleScore -= 15; // 완만한 슬로프 어깨
  else if (slopeDeg <= 16) maleScore += 15; // 각진 직각 어깨

  // 최종 판정 (여성 동기분이 오인식되지 않도록 밸런스 최적화)
  if (maleScore >= 50) {
    return { text: "남성 추정 (탄탄한 운동형 💪)", color: "#00f2fe", slopeDeg, badge: "남성 (운동형)" };
  } else if (maleScore >= 18) {
    return { text: "남성 추정 (당당한 어깨 👤)", color: "#38bdf8", slopeDeg, badge: "남성 (표준형)" };
  } else if (maleScore >= -18) {
    return { text: "슬림 균형 체형 (중립 🧍)", color: "#a78bfa", slopeDeg, badge: "슬림 균형" };
  } else {
    return { text: "여성 추정 (균형 슬림 라인 👗)", color: "#f472b6", slopeDeg, badge: "여성 (슬림형)" };
  }
}

/**
 * 5-2. 상의(Torso) 영역 옷 색상 실시간 샘플링
 */
function analyzeClothingColor(ctx, landmarks, w, h) {
  const leftSh = landmarks[11];
  const rightSh = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftSh || !rightSh) {
    return { name: "분석 중", hex: "#94a3b8" };
  }

  const shCx = (leftSh.x + rightSh.x) / 2;
  const shCy = (leftSh.y + rightSh.y) / 2;
  const shW = Math.hypot(leftSh.x - rightSh.x, leftSh.y - rightSh.y);

  let targetY = shCy + shW * 0.45;
  if (leftHip && rightHip && leftHip.visibility > 0.3 && rightHip.visibility > 0.3) {
    const hipCy = (leftHip.y + rightHip.y) / 2;
    targetY = shCy * 0.4 + hipCy * 0.6;
  }

  const pxX = Math.round(shCx * w);
  const pxY = Math.round(targetY * h);
  const radius = Math.max(10, Math.round(shW * w * 0.08));

  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  try {
    const imgData = ctx.getImageData(
      Math.max(0, pxX - radius),
      Math.max(0, pxY - radius),
      radius * 2,
      radius * 2
    );
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 16) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      count++;
    }
  } catch (e) {
    return { name: "추출 중", hex: "#94a3b8" };
  }

  if (count === 0) return { name: "분석 중", hex: "#94a3b8" };
  return classifyColor(Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count));
}

function classifyColor(r, g, b) {
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const sat = max === 0 ? 0 : delta / max;

  if (brightness < 45) return { name: "블랙", hex: "#1e293b" };
  if (brightness > 195 && sat < 0.16) return { name: "화이트", hex: "#f8fafc" };
  if (sat < 0.16) return { name: "그레이", hex: "#64748b" };

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  if (h >= 345 || h < 14) return { name: "레드", hex: "#ef4444" };
  if (h >= 14 && h < 42) return brightness < 100 ? { name: "브라운", hex: "#854d0e" } : { name: "오렌지", hex: "#f97316" };
  if (h >= 42 && h < 68) return sat < 0.35 ? { name: "베이지", hex: "#d4b996" } : { name: "옐로우", hex: "#eab308" };
  if (h >= 68 && h < 165) return { name: "그린", hex: "#22c55e" };
  if (h >= 165 && h < 205) return { name: "스카이/민트", hex: "#06b6d4" };
  if (h >= 205 && h < 260) return brightness < 85 ? { name: "네이비", hex: "#1e3a8a" } : { name: "블루", hex: "#3b82f6" };
  if (h >= 260 && h < 315) return { name: "퍼플", hex: "#a855f7" };
  return { name: "핑크", hex: "#ec4899" };
}

function analyzePosture(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];

  if ((leftAnkle && leftAnkle.visibility > 0.4) || (rightAnkle && rightAnkle.visibility > 0.4)) {
    return "전신 (Full Body)";
  } else if ((leftKnee && leftKnee.visibility > 0.4) || (rightKnee && rightKnee.visibility > 0.4)) {
    return "미디엄 샷";
  }
  return "상반신 (Close-up)";
}

// --------------------------------------------------------------------------
// [6단계] 캔버스 렌더링 (다인원 스켈레톤 & 정밀 측정 그리드 & 프로필 카드)
// --------------------------------------------------------------------------
function renderResults(results) {
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
  const isFront = currentFacingMode === 'user';

  // 1. 영상 배경 렌더링 (전면 카메라 거울 모드)
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  if (isFront) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  if (viewMode === 'overlay') {
    ctx.drawImage(video, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);
  }

  const allPeopleLandmarks = results.landmarks || [];
  const peopleCount = allPeopleLandmarks.length;

  // 상단 HUD 감지 인원수 업데이트
  peopleCountText.textContent = `감지: ${peopleCount}명 (최대 4명)`;

  if (peopleCount === 0) {
    statusText.textContent = "사람을 비춰주세요";
    statusDot.classList.remove('active');
    ctx.restore();
    return;
  }

  statusText.textContent = `${peopleCount}명 실시간 추적 중`;
  statusDot.classList.add('active');

  // 사람별 분석 결과 임시 저장
  const profilesToDraw = [];

  // 2. 각 사람별(최대 4명) 스켈레톤 및 정밀 계측 점 그리기
  allPeopleLandmarks.forEach((landmarks, idx) => {
    const theme = PERSON_THEMES[idx % PERSON_THEMES.length];

    // 2-1. 기본 관절 연결선 (네온 라인)
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = theme.line;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 10;

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2 && (p1.visibility || 1) > 0.35 && (p2.visibility || 1) > 0.35) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    }

    // 2-2. 33개 기본 관절 포인트
    ctx.shadowBlur = 14;
    ctx.shadowColor = theme.point;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility || 1) > 0.35) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
        ctx.fillStyle = theme.point;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 1.8, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // 2-3. 🌟 정밀 신체 계측 마커 및 캘리퍼 가이드선 추가 렌더링
    drawDenseMeasurementGrid(ctx, landmarks, w, h, theme);

    // 2-4. 데이터 분석 (옷 색깔, 성별, 자세)
    const colorInfo = analyzeClothingColor(ctx, landmarks, w, h);
    const genderInfo = analyzeGenderAndBodyPrecision(landmarks);
    const posture = analyzePosture(landmarks);

    // 1번 사람의 색상을 상단 HUD에 대표 표시
    if (idx === 0) {
      clothColorDot.style.backgroundColor = colorInfo.hex;
      clothColorText.textContent = `${colorInfo.name} · ${genderInfo.badge}`;
    }

    // 머리 위 카드 좌표 계산
    const nose = landmarks[0];
    const leftSh = landmarks[11];
    const rightSh = landmarks[12];
    const shW = Math.hypot(leftSh.x - rightSh.x, leftSh.y - rightSh.y);

    const rawHeadX = nose.x * w;
    const screenHeadX = isFront ? (w - rawHeadX) : rawHeadX;
    const screenHeadY = (nose.y - shW * 0.70) * h;

    profilesToDraw.push({
      personNum: idx + 1,
      theme,
      headX: screenHeadX,
      headY: screenHeadY,
      colorInfo,
      genderInfo,
      posture,
      shWPx: shW * w
    });
  });

  ctx.restore(); // 거울 모드 해제

  // 3. 머리 위 사람별 AI 비전 프로필 카드 렌더링 (정방향 텍스트)
  profilesToDraw.forEach((prof) => {
    if (prof.headY > 0) {
      drawVisionProfileCard(ctx, prof);
    }
  });
}

// --------------------------------------------------------------------------
// [7단계] 🌟 정밀 신체 계측 그리드 렌더링 (측정 포인트 대폭 강화)
// --------------------------------------------------------------------------
function drawDenseMeasurementGrid(ctx, landmarks, w, h, theme) {
  const leftSh = landmarks[11];
  const rightSh = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];

  if (!leftSh || !rightSh) return;

  const lx = leftSh.x * w, ly = leftSh.y * h;
  const rx = rightSh.x * w, ry = rightSh.y * h;

  ctx.save();
  ctx.shadowBlur = 0;

  // 1. 어깨 너비 수평 캘리퍼 눈금선 (하늘색 점선)
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(0, 242, 254, 0.85)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.stroke();

  // 2. 쇄골 중심점 (Clavicle Notch - 골드 다이아몬드 포인트)
  const neckX = (lx + rx) / 2;
  const neckY = (ly + ry) / 2;
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(neckX, neckY, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. 어깨 끝점 외측 캘리퍼 브라켓 ([ --- ])
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  // 좌측 브라켓
  ctx.beginPath();
  ctx.moveTo(lx - 5, ly - 8);
  ctx.lineTo(lx - 5, ly + 8);
  ctx.stroke();
  // 우측 브라켓
  ctx.beginPath();
  ctx.moveTo(rx + 5, ry - 8);
  ctx.lineTo(rx + 5, ry + 8);
  ctx.stroke();

  // 4. 골반 너비 눈금선 및 허리 라인 (골반 감지 시)
  if (leftHip && rightHip && leftHip.visibility > 0.35 && rightHip.visibility > 0.35) {
    const lhX = leftHip.x * w, lhY = leftHip.y * h;
    const rhX = rightHip.x * w, rhY = rightHip.y * h;

    // 골반 폭 연결선 (주황색 점선)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 170, 0, 0.85)";
    ctx.beginPath();
    ctx.moveTo(lhX, lhY);
    ctx.lineTo(rhX, rhY);
    ctx.stroke();

    // 척추 중심 수직 축 (척추 라인)
    const hipMidX = (lhX + rhX) / 2;
    const hipMidY = (lhY + rhY) / 2;
    ctx.strokeStyle = "rgba(0, 255, 136, 0.6)";
    ctx.beginPath();
    ctx.moveTo(neckX, neckY);
    ctx.lineTo(hipMidX, hipMidY);
    ctx.stroke();

    // 허리 슬림 포인트 (좌/우 바이올렛 마커)
    const waistLeftX = lx * 0.45 + lhX * 0.55;
    const waistLeftY = ly * 0.45 + lhY * 0.55;
    const waistRightX = rx * 0.45 + rhX * 0.55;
    const waistRightY = ry * 0.45 + rhY * 0.55;

    ctx.setLineDash([]);
    ctx.fillStyle = "#c084fc";
    ctx.beginPath();
    ctx.arc(waistLeftX, waistLeftY, 5, 0, 2 * Math.PI);
    ctx.arc(waistRightX, waistRightY, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// [8단계] 머리 위 플로팅 AI 비전 프로필 카드 렌더링
// --------------------------------------------------------------------------
function drawVisionProfileCard(ctx, prof) {
  const cardWidth = Math.max(185, Math.min(235, prof.shWPx * 2.0));
  const cardHeight = 78;
  const radius = 13;
  const cardX = Math.max(10, Math.min(canvas.width - cardWidth - 10, prof.headX - cardWidth / 2));
  const cardY = Math.max(68, prof.headY - cardHeight - 12);

  ctx.save();

  // 1. 카드 네온 테두리 & 반투명 다크 배경
  ctx.shadowColor = prof.theme.line;
  ctx.shadowBlur = 12;

  ctx.fillStyle = 'rgba(10, 14, 23, 0.90)';
  ctx.strokeStyle = prof.theme.line;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
  ctx.fill();
  ctx.stroke();

  // 2. 하단 꼬리표
  ctx.beginPath();
  ctx.moveTo(prof.headX - 6, cardY + cardHeight);
  ctx.lineTo(prof.headX, cardY + cardHeight + 8);
  ctx.lineTo(prof.headX + 6, cardY + cardHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 3. 카드 내부 텍스트
  // 타이틀 헤더: Person #N & 경사각 지표
  ctx.font = 'bold 11px Pretendard, sans-serif';
  ctx.fillStyle = prof.theme.line;
  ctx.textAlign = 'left';
  ctx.fillText(`⚡ PERSON #${prof.personNum} (각도: ${prof.genderInfo.slopeDeg}°)`, cardX + 10, cardY + 18);

  // 성별/체형
  ctx.font = '12px Pretendard, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`👤 ${prof.genderInfo.text}`, cardX + 10, cardY + 36);

  // 상의 옷 색상 & 컬러칩
  ctx.fillText(`👕 상의: ${prof.colorInfo.name}`, cardX + 10, cardY + 54);

  const textW = ctx.measureText(`👕 상의: ${prof.colorInfo.name}`).width;
  ctx.beginPath();
  ctx.arc(cardX + 14 + textW + 8, cardY + 50, 5, 0, 2 * Math.PI);
  ctx.fillStyle = prof.colorInfo.hex;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 자세/화각
  ctx.font = '10px Pretendard, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`📏 ${prof.posture}`, cardX + 10, cardY + 70);

  ctx.restore();
}

// --------------------------------------------------------------------------
// [9단계] 인터랙션 이벤트 핸들러
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
  link.download = `poselens_multipeople_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});
