/**
 * ==========================================================================
 *  [AI_DAY2] PoseLens AI - 모바일 실시간 인체 스켈레톤 & 표정 이모티콘 (app.js)
 * ==========================================================================
 *  - 기능:
 *    1. 스마트폰 카메라(전면/후면) 실시간 비디오 스트림 획득
 *    2. MediaPipe Pose 인공지능을 통한 33개 관절 랜드마크 추출
 *    3. 눈/입/코 좌표 기하학적 분석을 통한 실시간 표정(이모티콘) 판별
 *       - 😄 활짝 웃음 (Smile)
 *       - 😠 화남 / 찌푸림 (Angry)
 *       - 😲 놀람 (Surprise)
 *       - 😉 윙크 (Wink)
 *       - 😐 무표정 (Neutral)
 *    4. 머리 위 플로팅 네온 이모티콘 말풍선 렌더링
 *    5. 캔버스 위 실시간 네온 스켈레톤 시각화 (오버레이 / 다크 모드)
 *    6. 사진 캡처 및 다운로드 기능 제공
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// [1단계] 주요 DOM 요소 및 상태 변수 초기화
// --------------------------------------------------------------------------
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

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

// 표정 이모티콘 DOM
const emotionBadge = document.getElementById('emotion-badge');
const emotionEmoji = document.getElementById('emotion-emoji');
const emotionLabel = document.getElementById('emotion-label');

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

// 감정 상태 정의 및 스무딩 버퍼
const EMOTIONS = {
  smile: { emoji: '😄', title: '행복', sub: 'Smile', color: '#ffd700', border: '#ffea00' },
  wink: { emoji: '😉', title: '윙크', sub: 'Wink', color: '#e056fd', border: '#f368e0' },
  surprise: { emoji: '😲', title: '놀람', sub: 'Surprise', color: '#00f2fe', border: '#4facfe' },
  angry: { emoji: '😠', title: '화남', sub: 'Angry', color: '#ff3366', border: '#ff0055' },
  neutral: { emoji: '😐', title: '무표정', sub: 'Neutral', color: '#38bdf8', border: '#0284c7' }
};

let emotionHistory = [];
let currentEmotion = EMOTIONS.neutral;

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
  modelComplexity: 1,         // 1: 모바일 환경에서 속도와 정확도 균형 최적
  smoothLandmarks: true,       // 프레임 간 흔들림 보정
  enableSegmentation: false,   // 배경 분리 끄기 (속도 극대화)
  minDetectionConfidence: 0.5, // 50% 이상 신뢰 시 인식
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
// [5단계] 표정(이모티콘) 분석 알고리즘
// --------------------------------------------------------------------------
function analyzeFacialEmotion(landmarks) {
  const nose = landmarks[0];
  const leftEye = landmarks[2];
  const rightEye = landmarks[5];
  const leftEyeInner = landmarks[1];
  const rightEyeInner = landmarks[4];
  const mouthLeft = landmarks[9];
  const mouthRight = landmarks[10];

  if (!nose || !leftEye || !rightEye || !mouthLeft || !mouthRight) {
    return EMOTIONS.neutral;
  }

  // 눈 사이 거리 (얼굴 기준 스케일)
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (eyeDist < 0.03) {
    return EMOTIONS.neutral;
  }

  // 1. 윙크 감지 (한쪽 눈 깜빡임 / 가시성 차이)
  const leftVis = ((landmarks[1].visibility || 1) + (landmarks[2].visibility || 1) + (landmarks[3].visibility || 1)) / 3;
  const rightVis = ((landmarks[4].visibility || 1) + (landmarks[5].visibility || 1) + (landmarks[6].visibility || 1)) / 3;
  if (Math.abs(leftVis - rightVis) > 0.42) {
    return EMOTIONS.wink;
  }

  // 2. 입 너비 및 상하 위치 계산
  const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
  const mouthRatio = mouthWidth / eyeDist; // 일반 기준 0.68 ~ 0.80

  const mouthCenterY = (mouthLeft.y + mouthRight.y) / 2;
  const mouthToNoseY = mouthCenterY - nose.y;
  const verticalDrop = mouthToNoseY / eyeDist;

  // 3. 미간 간격 계산
  const innerEyeDist = Math.hypot(leftEyeInner.x - rightEyeInner.x, leftEyeInner.y - rightEyeInner.y);
  const innerEyeRatio = innerEyeDist / eyeDist;

  // [판별 1] 놀람 😲 : 입이 세로로 크게 벌어졌을 때
  if (verticalDrop > 0.70 && mouthRatio < 0.92) {
    return EMOTIONS.surprise;
  }

  // [판별 2] 활짝 웃음 😄 : 입 너비가 확 늘어나고 입꼬리가 올라갈 때
  if (mouthRatio > 0.85) {
    return EMOTIONS.smile;
  }

  // [판별 3] 화남 / 찌푸림 😠 : 미간 간격이 좁아지고 눈썹이 내려앉을 때
  if (innerEyeRatio < 0.38) {
    return EMOTIONS.angry;
  }

  return EMOTIONS.neutral;
}

// 감정 노이즈 제거 (이동 평균 스무딩)
function getSmoothedEmotion(rawEmotion) {
  emotionHistory.push(rawEmotion);
  if (emotionHistory.length > 6) {
    emotionHistory.shift();
  }

  const counts = {};
  for (const e of emotionHistory) {
    counts[e.title] = (counts[e.title] || 0) + 1;
  }

  let maxCount = 0;
  let dominant = currentEmotion;
  for (const e of emotionHistory) {
    if (counts[e.title] > maxCount) {
      maxCount = counts[e.title];
      dominant = e;
    }
  }

  if (maxCount >= 3) {
    currentEmotion = dominant;
  }
  return currentEmotion;
}

// --------------------------------------------------------------------------
// [6단계] 캔버스 시각화 (스켈레톤 및 머리 위 이모티콘 그리기)
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

  // 1. 영상 및 뼈대 레이어 (전면 카메라는 좌우 반전하여 렌더링)
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
  let detectedEmotion = EMOTIONS.neutral;
  let headScreenX = 0;
  let headScreenY = 0;
  let eyeDistPixels = 60;

  if (isDetected) {
    statusText.textContent = "인체 감지 중";
    statusDot.classList.add('active');

    // 뼈대 연결선 그리기 (네온 라인)
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

    // 관절 점 그리기
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

    // 표정 분석
    const rawEmotion = analyzeFacialEmotion(landmarks);
    detectedEmotion = getSmoothedEmotion(rawEmotion);

    // 머리 위 좌표 계산
    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    eyeDistPixels = eyeDist * w;

    // 거울 모드에 따른 화면상 실제 X 좌표
    const rawHeadX = nose.x * w;
    headScreenX = isFrontCamera ? (w - rawHeadX) : rawHeadX;
    headScreenY = (nose.y - eyeDist * 1.55) * h;

  } else {
    statusText.textContent = "사람을 비춰주세요";
    statusDot.classList.remove('active');
    detectedEmotion = EMOTIONS.neutral;
  }

  ctx.restore(); // 거울 모드 해제

  // 2. 머리 위 플로팅 이모티콘 말풍선 (글자/이모지가 거꾸로 뒤집히지 않도록 정방향으로 렌더링)
  if (isDetected && headScreenY > 0) {
    drawFloatingEmotionBubble(ctx, detectedEmotion, headScreenX, headScreenY, eyeDistPixels);
  }

  // 3. 상단 HUD 이모티콘 뱃지 업데이트
  emotionEmoji.textContent = detectedEmotion.emoji;
  emotionLabel.textContent = detectedEmotion.title;
  emotionBadge.style.borderColor = detectedEmotion.border;
  emotionBadge.style.color = detectedEmotion.color;
}

// --------------------------------------------------------------------------
// [7단계] 머리 위 네온 이모티콘 말풍선 렌더링 함수
// --------------------------------------------------------------------------
function drawFloatingEmotionBubble(ctx, emotion, headX, headY, eyeDistPx) {
  const bubbleWidth = Math.max(130, Math.min(180, eyeDistPx * 1.9));
  const bubbleHeight = 52;
  const radius = 16;
  const bubbleX = headX - bubbleWidth / 2;
  const bubbleY = Math.max(65, headY - bubbleHeight - 12);

  ctx.save();

  // 네온 글로우 효과
  ctx.shadowColor = emotion.border;
  ctx.shadowBlur = 18;

  // 말풍선 배경 (다크 글래스모피즘)
  ctx.fillStyle = 'rgba(10, 14, 23, 0.88)';
  ctx.strokeStyle = emotion.border;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, radius);
  ctx.fill();
  ctx.stroke();

  // 말풍선 하단 꼬리표
  ctx.beginPath();
  ctx.moveTo(headX - 8, bubbleY + bubbleHeight);
  ctx.lineTo(headX, bubbleY + bubbleHeight + 9);
  ctx.lineTo(headX + 8, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 대형 이모티콘 아이콘
  ctx.font = '30px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emotion.emoji, bubbleX + 30, bubbleY + bubbleHeight / 2 + 1);

  // 한글 감정 제목
  ctx.font = 'bold 13px Pretendard, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(emotion.title, bubbleX + 56, bubbleY + bubbleHeight / 2 - 4);

  // 영문 서브라벨
  ctx.font = '10px Pretendard, sans-serif';
  ctx.fillStyle = emotion.color;
  ctx.fillText(emotion.sub, bubbleX + 56, bubbleY + bubbleHeight / 2 + 12);

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
  link.download = `poselens_${currentEmotion.sub.toLowerCase()}_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});
