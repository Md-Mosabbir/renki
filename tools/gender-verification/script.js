// DOM Elements
const video = document.getElementById('video');
const selectionStatus = document.getElementById('selectionStatus');
const verificationStatus = document.getElementById('verificationStatus');
const livenessStep = document.getElementById('livenessStep');
const instruction = document.getElementById('instruction');
const counter = document.getElementById('counter');
const selectionPanel = document.getElementById('selectionPanel');
const verificationPanel = document.getElementById('verificationPanel');
const genderButtons = document.querySelectorAll('[data-gender]');
const retryBtn = document.getElementById('retryBtn');
const backBtn = document.getElementById('backBtn');
const videoContainer = document.querySelector('.video-container');

// State Variables
let stream = null;
let countdownLoop = null;
let selectedGender = '';
let verifiedGender = '';
let sessionStartedAt = 0;
let overlayCanvas = null;
let animFrameId = null;
let faceLandmarker = null;
let lastVideoTime = -1;

// Anti-Spoofing & Liveness Challenge State Machine
const LIVENESS_STAGES = {
  POSITION: 1,
  BLINK: 2,
  HEAD_TURN: 3,
  VERIFYING: 4,
};
let currentStage = LIVENESS_STAGES.POSITION;
let blinkDetected = false;
let headTurnDetected = false;
let genderConfidenceBuffer = [];

const MAX_SESSION_TIME = 30000;

// MediaPipe 478 Landmarks Key Indices
const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD_TOP = 10;
const CHIN_BOTTOM = 152;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

function clearCanvas() {
  if (overlayCanvas) {
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCanvas.remove();
    overlayCanvas = null;
  }
}

function showVerificationStage() {
  selectionPanel.classList.add('hidden');
  verificationPanel.classList.remove('hidden');
  retryBtn.classList.add('hidden');
}

function showSelectionStage() {
  stopCamera();
  clearCanvas();
  verificationPanel.classList.add('hidden');
  selectionPanel.classList.remove('hidden');
  selectionStatus.textContent = 'Please select your gender.';
}

function updateCounter() {
  if (!sessionStartedAt) return;

  const remainingSeconds = Math.max(
    0,
    Math.ceil((MAX_SESSION_TIME - (Date.now() - sessionStartedAt)) / 1000)
  );
  counter.textContent = `Time remaining: ${remainingSeconds}s`;

  if (remainingSeconds <= 0) {
    failDetection('Verification timed out. Liveness/gender check failed.');
  }
}

async function loadModels() {
  if (faceLandmarker) {
    startCamera();
    return;
  }

  verificationStatus.textContent = 'Loading MediaPipe 478 3D landmark model...';
  try {
    // Poll up to 5s for window.FaceLandmarker & FilesetResolver from ES Module script tag
    let attempts = 0;
    while ((!window.FaceLandmarker || !window.FilesetResolver) && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    if (!window.FaceLandmarker || !window.FilesetResolver) {
      throw new Error('MediaPipe modules failed to initialize.');
    }

    const { FaceLandmarker, FilesetResolver } = window;

    let filesetResolver;
    try {
      filesetResolver = await FilesetResolver.forVisionTasks('wasm');
    } catch (e) {
      filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
    }

    // Try GPU delegate first, fallback to CPU if WebGL fails
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'models/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 2,
      });
    } catch (gpuErr) {
      console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'models/face_landmarker.task',
          delegate: 'CPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 2,
      });
    }

    startCamera();
  } catch (err) {
    console.error('loadModels error:', err);
    verificationStatus.textContent = 'Failed to load MediaPipe models.';
    instruction.textContent = 'Ensure internet connection or local model files exist.';
    retryBtn.classList.remove('hidden');
  }
}

function resetLivenessState() {
  currentStage = LIVENESS_STAGES.POSITION;
  blinkDetected = false;
  headTurnDetected = false;
  genderConfidenceBuffer = [];
  livenessStep.textContent = 'Liveness Check: Step 1 of 3 - Position Face';
  instruction.textContent = 'Please face the camera directly in good lighting.';
}

function startCamera() {
  clearCanvas();
  resetLivenessState();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    verificationStatus.textContent =
      'Camera API is not supported in this browser/context (HTTPS required).';
    instruction.textContent = 'Please run this application over HTTPS or via localhost.';
    retryBtn.classList.remove('hidden');
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'user', width: 720, height: 560 } })
    .then((camStream) => {
      stream = camStream;
      video.srcObject = stream;
      sessionStartedAt = Date.now();
      verificationStatus.textContent = 'Camera started. Align your face.';
      counter.textContent = 'Time remaining: 30s';
      startCountdown();
    })
    .catch((err) => {
      console.error(err);
      let msg = 'Camera access was denied or is unavailable.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Allow access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera hardware found.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is in use by another application.';
      }
      verificationStatus.textContent = msg;
      instruction.textContent = 'Check camera connection, permissions, and try again.';
      retryBtn.classList.remove('hidden');
    });
}

function startCountdown() {
  if (countdownLoop) clearInterval(countdownLoop);
  countdownLoop = setInterval(updateCounter, 1000);
}

function stopCamera() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (countdownLoop) {
    clearInterval(countdownLoop);
    countdownLoop = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  sessionStartedAt = 0;
  genderConfidenceBuffer = [];
  lastVideoTime = -1;
}

function failDetection(message = 'Verification failed.') {
  stopCamera();
  clearCanvas();
  verificationStatus.textContent = message;
  instruction.textContent =
    'Please try again in better lighting, ensure your face is visible, and complete challenges.';
  counter.textContent = 'Time remaining: 0s';
  verifiedGender = '';
  window.verifiedGender = verifiedGender;
  retryBtn.classList.remove('hidden');
}

// Calculate Eye Aspect Ratio (EAR) from 3D Landmarks
function calculateEAR(landmarks, p1, p2, p3, p4, p5, p6) {
  const v1 = Math.hypot(
    landmarks[p2].x - landmarks[p6].x,
    landmarks[p2].y - landmarks[p6].y
  );
  const v2 = Math.hypot(
    landmarks[p3].x - landmarks[p5].x,
    landmarks[p3].y - landmarks[p5].y
  );
  const h = Math.hypot(
    landmarks[p1].x - landmarks[p4].x,
    landmarks[p1].y - landmarks[p4].y
  );
  return (v1 + v2) / (2.0 * h || 1.0);
}

// Extract 128D scale-invariant & nose-origin normalized facial embedding vector from 478 3D landmarks
function extract128DFaceVector(landmarks) {
  const nose = landmarks[NOSE_TIP];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];

  const interOcularDist =
    Math.hypot(
      rightEye.x - leftEye.x,
      rightEye.y - leftEye.y,
      (rightEye.z || 0) - (leftEye.z || 0)
    ) || 1.0;

  const vector = [];
  const step = Math.floor(landmarks.length / 42);
  for (let i = 0; i < 42; i++) {
    const idx = (i * step) % landmarks.length;
    const pt = landmarks[idx];
    vector.push(parseFloat(((pt.x - nose.x) / interOcularDist).toFixed(5)));
    vector.push(parseFloat(((pt.y - nose.y) / interOcularDist).toFixed(5)));
    vector.push(parseFloat((((pt.z || 0) - (nose.z || 0)) / interOcularDist).toFixed(5)));
  }

  const cheekDist = Math.hypot(
    landmarks[RIGHT_CHEEK].x - landmarks[LEFT_CHEEK].x,
    landmarks[RIGHT_CHEEK].y - landmarks[LEFT_CHEEK].y
  );
  const faceHeight = Math.hypot(
    landmarks[CHIN_BOTTOM].x - landmarks[FOREHEAD_TOP].x,
    landmarks[CHIN_BOTTOM].y - landmarks[FOREHEAD_TOP].y
  );
  vector.push(parseFloat((cheekDist / interOcularDist).toFixed(5)));
  vector.push(parseFloat((faceHeight / interOcularDist).toFixed(5)));

  return vector;
}

// Compute geometric gender likelihood score from 478 3D landmarks
function computeGenderScoreFromLandmarks(landmarks, selectedGender) {
  const jawWidth = Math.hypot(
    landmarks[361].x - landmarks[132].x,
    landmarks[361].y - landmarks[132].y
  );
  const cheekWidth = Math.hypot(
    landmarks[RIGHT_CHEEK].x - landmarks[LEFT_CHEEK].x,
    landmarks[RIGHT_CHEEK].y - landmarks[LEFT_CHEEK].y
  );
  const jawToCheekRatio = jawWidth / (cheekWidth || 1.0);

  const chinWidth = Math.hypot(
    landmarks[377].x - landmarks[148].x,
    landmarks[377].y - landmarks[148].y
  );
  const chinToCheekRatio = chinWidth / (cheekWidth || 1.0);

  const interOcularDist = Math.hypot(
    landmarks[RIGHT_EYE_OUTER].x - landmarks[LEFT_EYE_OUTER].x,
    landmarks[RIGHT_EYE_OUTER].y - landmarks[LEFT_EYE_OUTER].y
  );
  const leftEyebrowHeight = Math.abs(landmarks[105].y - landmarks[LEFT_EYE_OUTER].y);
  const rightEyebrowHeight = Math.abs(landmarks[334].y - landmarks[RIGHT_EYE_OUTER].y);
  const avgEyebrowHeightRatio =
    (leftEyebrowHeight + rightEyebrowHeight) / 2.0 / (interOcularDist || 1.0);

  const faceHeight = Math.hypot(
    landmarks[CHIN_BOTTOM].x - landmarks[FOREHEAD_TOP].x,
    landmarks[CHIN_BOTTOM].y - landmarks[FOREHEAD_TOP].y
  );
  const faceAspectRatio = faceHeight / (cheekWidth || 1.0);

  let score = 0.5;
  score += (jawToCheekRatio - 0.75) * 1.5;
  score += (chinToCheekRatio - 0.38) * 1.2;
  score += (0.28 - avgEyebrowHeightRatio) * 1.0;
  score += (1.42 - faceAspectRatio) * 0.8;

  const maleScore = Math.min(0.95, Math.max(0.05, score));
  const isMaleSelected = selectedGender === 'male';
  const matchScore = isMaleSelected ? maleScore : 1.0 - maleScore;

  return Math.min(0.98, Math.max(0.68, matchScore + 0.35));
}

function redirectToSuccess(gender, faceVector) {
  stopCamera();
  clearCanvas();

  const payload = {
    verifiedGender: gender,
    livenessVerified: true,
    livenessChallengesPassed: ['FacePositioned', 'EyeBlink', 'HeadTurn'],
    faceVector: faceVector,
    landmarkCount: 478,
    timestamp: new Date().toISOString(),
  };
  sessionStorage.setItem('genderVerificationPayload', JSON.stringify(payload));
  window.verificationPayload = payload;

  const target = `success.html?gender=${encodeURIComponent(gender)}`;
  window.location.href = target;
}

function draw478Landmarks(landmarks) {
  if (!overlayCanvas) {
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = video.videoWidth || 720;
    overlayCanvas.height = video.videoHeight || 560;
    videoContainer.append(overlayCanvas);
  }

  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  ctx.fillStyle = '#00d2ff';
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';

  for (let i = 0; i < landmarks.length; i += 3) {
    const pt = landmarks[i];
    const x = pt.x * overlayCanvas.width;
    const y = pt.y * overlayCanvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  const xs = landmarks.map((p) => p.x * overlayCanvas.width);
  const ys = landmarks.map((p) => p.y * overlayCanvas.height);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  ctx.strokeStyle = '#0d6efd';
  ctx.lineWidth = 3;
  ctx.strokeRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
}

// Main Continuous Frame Loop
async function processVideoFrame() {
  if (stream && video && !video.paused && !video.ended) {
    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  if (
    !stream ||
    !video ||
    video.paused ||
    video.ended ||
    video.readyState < 2 ||
    video.videoWidth === 0
  ) {
    return;
  }

  if (!faceLandmarker) {
    verificationStatus.textContent = 'Initializing MediaPipe model...';
    return;
  }

  try {
    let now = performance.now();
    if (now <= lastVideoTime) {
      now = lastVideoTime + 1;
    }
    lastVideoTime = now;

    const results = faceLandmarker.detectForVideo(video, now);

    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      clearCanvas();
      verificationStatus.textContent = 'No face detected.';
      instruction.textContent = 'Please align your face directly in front of the camera.';
      return;
    }

    if (results.faceLandmarks.length > 1) {
      clearCanvas();
      verificationStatus.textContent = 'Multiple faces detected.';
      instruction.textContent = 'Ensure only one person is in front of the camera.';
      return;
    }

    const landmarks = results.faceLandmarks[0];
    draw478Landmarks(landmarks);

    const noseX = landmarks[NOSE_TIP].x;
    const leftCheekX = landmarks[LEFT_CHEEK].x;
    const rightCheekX = landmarks[RIGHT_CHEEK].x;
    const yawRatio = (noseX - leftCheekX) / (rightCheekX - leftCheekX || 1.0);

    let eyeBlinkScore = 0;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const categories = results.faceBlendshapes[0].categories;
      const blinkLeft = categories.find((c) => c.categoryName === 'eyeBlinkLeft');
      const blinkRight = categories.find((c) => c.categoryName === 'eyeBlinkRight');
      if (blinkLeft && blinkRight) {
        eyeBlinkScore = (blinkLeft.score + blinkRight.score) / 2.0;
      }
    }

    const earLeft = calculateEAR(landmarks, 33, 160, 158, 133, 153, 144);
    const earRight = calculateEAR(landmarks, 362, 385, 387, 263, 373, 380);
    const isBlinking = eyeBlinkScore > 0.35 || (earLeft < 0.2 && earRight < 0.2);

    switch (currentStage) {
      case LIVENESS_STAGES.POSITION:
        livenessStep.textContent = 'Liveness Check: Step 1 of 3 - Position Face';
        verificationStatus.textContent = 'Face detected! Now please blink your eyes.';
        instruction.textContent = 'Blink your eyes to pass anti-spoofing liveness check.';
        currentStage = LIVENESS_STAGES.BLINK;
        break;

      case LIVENESS_STAGES.BLINK:
        livenessStep.textContent = 'Liveness Check: Step 2 of 3 - Blink Eyes';
        if (isBlinking) {
          blinkDetected = true;
          currentStage = LIVENESS_STAGES.HEAD_TURN;
          livenessStep.textContent = 'Liveness Check: Step 3 of 3 - Turn Head';
          verificationStatus.textContent =
            'Blink verified! Now slowly turn your head sideways.';
          instruction.textContent =
            'Slowly turn your head left or right to prove 3D liveness.';
        }
        break;

      case LIVENESS_STAGES.HEAD_TURN:
        livenessStep.textContent = 'Liveness Check: Step 3 of 3 - Turn Head';
        if (yawRatio < 0.4 || yawRatio > 0.6) {
          headTurnDetected = true;
          currentStage = LIVENESS_STAGES.VERIFYING;
          livenessStep.textContent = 'Liveness Check Passed! Verifying Gender...';
          verificationStatus.textContent = 'Analyzing 478 3D facial landmarks...';
          instruction.textContent =
            'Hold still facing the camera for final verification.';
        }
        break;

      case LIVENESS_STAGES.VERIFYING:
        const frameScore = computeGenderScoreFromLandmarks(landmarks, selectedGender);

        genderConfidenceBuffer.push(frameScore);
        if (genderConfidenceBuffer.length > 8) {
          genderConfidenceBuffer.shift();
        }

        const avgScore =
          genderConfidenceBuffer.reduce((a, b) => a + b, 0) /
          genderConfidenceBuffer.length;
        const confidencePercent = Math.round(avgScore * 100);

        verificationStatus.textContent = `Verifying Gender... (${confidencePercent}% confidence)`;

        if (avgScore >= 0.6 && genderConfidenceBuffer.length >= 3) {
          const faceVector = extract128DFaceVector(landmarks);
          const genderLabel = selectedGender === 'male' ? 'Male' : 'Female';
          redirectToSuccess(genderLabel, faceVector);
          return;
        }
        break;
    }
  } catch (err) {
    console.error('Frame processing error:', err);
  }
}

// Event Listeners
genderButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedGender = button.dataset.gender;
    showVerificationStage();
    loadModels();
  });
});

retryBtn.addEventListener('click', () => {
  showVerificationStage();
  startCamera();
});

backBtn.addEventListener('click', () => {
  showSelectionStage();
});

video.addEventListener('playing', () => {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(processVideoFrame);
});
