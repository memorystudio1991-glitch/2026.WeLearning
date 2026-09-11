/**
 * ==========================================================================
 *  [AI_DAY2] PoseLens AI - 모바일 실시간 인체 스켈레톤 메인 로직 (app.js)
 * ==========================================================================
 *  - 기능:
 *    1. 스마트폰 카메라(전면/후면) 실시간 비디오 스트림 획득
 *    2. MediaPipe Pose 인공지능을 통한 33개 관절 랜드마크 추출
 *    3. 캔버스 위 실시간 네온 스켈레톤 렌더링 (일반 오버레이 / 다크 모드)
 *    4. 사진 캡처 및 다운로드 기능 제공
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
  // 기존 스트림이 있다면 중지
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

    // 비디오 메타데이터가 로드되면 캔버스 크기 맞추기 및 분석 루프 시작
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
// [5단계] 인공지능 분석 결과 캔버스 시각화 (스켈레톤 그리기)
// --------------------------------------------------------------------------
function onPoseResults(results) {
  // 최초 1회 모델 로딩 완료 시 모달 닫기
  if (!isModelReady) {
    isModelReady = true;
    modelLoader.classList.add('hidden');
  }

  // 5-1. FPS 계산
  const now = performance.now();
  frameCount++;
  if (now - lastFrameTime >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    fpsValue.textContent = currentFps;
    frameCount = 0;
    lastFrameTime = now;
  }

  // 5-2. 캔버스 지우기 및 변환 설정
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 전면 카메라인 경우 좌우 반전(거울 모드) 적용
  if (currentFacingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  // 5-3. 배경 렌더링 (모드별 분기)
  if (viewMode === 'overlay') {
    // [모드 1: 오버레이] 카메라 영상 그리기
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  } else {
    // [모드 2: 네온 다크] 순수 검은 배경
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 5-4. 랜드마크(스켈레톤) 그리기
  const landmarks = results.poseLandmarks;
  const isDetected = landmarks && landmarks.length > 0;

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

      // 신뢰도(visibility)가 0.4 이상인 관절만 연결
      if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
    }

    // 관절 점(포인트) 그리기
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff007f';
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility || 1) > 0.4) {
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff007f';
        ctx.fill();

        // 중심 하이라이트 원
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
  } else {
    statusText.textContent = "사람을 비춰주세요";
    statusDot.classList.remove('active');
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// [6단계] 모바일 인터랙션 이벤트 핸들러 (버튼 클릭 등)
// --------------------------------------------------------------------------

// 1. 카메라 시작 버튼 클릭 (오버레이 닫기)
btnStartCamera.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  startCamera();
});

// 2. 전면/후면 카메라 전환
btnSwitchCamera.addEventListener('click', () => {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera();
});

// 3. 뷰 모드 전환 (오버레이 <-> 네온 다크)
btnToggleMode.addEventListener('click', () => {
  if (viewMode === 'overlay') {
    viewMode = 'dark';
    modeText.textContent = "일반모드";
  } else {
    viewMode = 'overlay';
    modeText.textContent = "다크모드";
  }
});

// 4. 사진 촬영 및 다운로드
btnCapture.addEventListener('click', () => {
  // 촬영 찰칵 애니메이션 효과
  btnCapture.style.transform = 'scale(0.85)';
  setTimeout(() => { btnCapture.style.transform = ''; }, 150);

  // 캔버스 이미지를 PNG 파일로 다운로드
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  link.download = `poselens_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});
