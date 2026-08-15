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
let faceApiModelsLoaded = false;
let isDetectingGender = false;
let lastGenderDetectTime = 0;
let positionStableFrames = 0;
let genderMatchFrames = 0;
let genderMismatchFrames = 0;

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

const MAX_SESSION_TIME = 30000;
const GENDER_CONFIDENCE_THRESHOLD = 0.65;
const REQUIRED_MATCH_FRAMES = 5;
const REQUIRED_MISMATCH_FRAMES = 3;
const POSITION_STABLE_FRAMES = 8;
const GENDER_DETECT_INTERVAL_MS = 350;
const FACE_CENTER_MIN = 0.42;
const FACE_CENTER_MAX = 0.58;

// MediaPipe 478 Landmarks Key Indices
const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

function capitalizeGender(gender) {
  if (!gender) return '';
  const normalized = gender.toLowerCase();
  return normalized === 'male' ? 'Male' : normalized === 'female' ? 'Female' : gender;
}

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

async function loadFaceApiModels() {
  if (faceApiModelsLoaded) return;

  if (typeof faceapi === 'undefined') {
    throw new Error('face-api library failed to load.');
  }

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('models'),
    faceapi.nets.ageGenderNet.loadFromUri('models'),
  ]);

  faceApiModelsLoaded = true;
}

async function loadModels() {
  if (faceLandmarker && faceApiModelsLoaded) {
    startCamera();
    return;
  }

  verificationStatus.textContent = 'Loading face detection and gender models...';
  try {
    let attempts = 0;
    while ((!window.FaceLandmarker || !window.FilesetResolver) && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    if (!window.FaceLandmarker || !window.FilesetResolver) {
      throw new Error('MediaPipe modules failed to initialize.');
    }

    await loadFaceApiModels();

    const { FaceLandmarker, FilesetResolver } = window;

    let filesetResolver;
    try {
      filesetResolver = await FilesetResolver.forVisionTasks('wasm');
    } catch (e) {
      filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
    }

    if (!faceLandmarker) {
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
    }

    startCamera();
  } catch (err) {
    console.error('loadModels error:', err);
    verificationStatus.textContent = 'Failed to load verification models.';
    instruction.textContent = 'Ensure internet connection or local model files exist.';
    retryBtn.classList.remove('hidden');
  }
}

function resetLivenessState() {
  currentStage = LIVENESS_STAGES.POSITION;
  blinkDetected = false;
  headTurnDetected = false;
  positionStableFrames = 0;
  genderMatchFrames = 0;
  genderMismatchFrames = 0;
  lastGenderDetectTime = 0;
  isDetectingGender = false;
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
  lastVideoTime = -1;
  isDetectingGender = false;
  genderMatchFrames = 0;
  genderMismatchFrames = 0;
  positionStableFrames = 0;
}

function failDetection(message = 'Verification failed.') {
  stopCamera();
  clearCanvas();
  verificationStatus.textContent = message;
  instruction.textContent =
    'Please try again in better lighting, ensure your face is visible, and complete all challenges.';
  counter.textContent = 'Time remaining: 0s';
  verifiedGender = '';
  window.verifiedGender = verifiedGender;
  livenessStep.textContent = 'Verification Failed';
  retryBtn.classList.remove('hidden');
}

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

function isFaceCentered(yawRatio) {
  return yawRatio >= FACE_CENTER_MIN && yawRatio <= FACE_CENTER_MAX;
}

async function detectGenderFromVideo() {
  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
    )
    .withAgeAndGender();

  if (!detection) return null;

  return {
    gender: detection.gender.toLowerCase(),
    probability: detection.genderProbability,
  };
}

async function computeFaceDescriptorFromVideo() {
  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) {
    return null;
  }

  return Array.from(detection.descriptor);
}

function redirectToSuccess(gender, faceVector) {
  stopCamera();
  clearCanvas();

  const verifiedLabel = capitalizeGender(gender);

  const payload = {
    verifiedGender: verifiedLabel,
    selectedGender: capitalizeGender(selectedGender),
    livenessVerified: true,
    livenessChallengesPassed: ['FacePositioned', 'EyeBlink', 'HeadTurn'],
    faceVector: faceVector,
    faceVectorSource: 'face-api-faceRecognitionNet',
    landmarkCount: 478,
    timestamp: new Date().toISOString(),
  };
  sessionStorage.setItem('genderVerificationPayload', JSON.stringify(payload));
  window.verificationPayload = payload;

  window.location.href = `success.html?gender=${encodeURIComponent(verifiedLabel)}&status=success`;
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

async function runGenderVerification() {
  if (isDetectingGender) return;
  if (Date.now() - lastGenderDetectTime < GENDER_DETECT_INTERVAL_MS) return;

  isDetectingGender = true;
  lastGenderDetectTime = Date.now();

  try {
    const result = await detectGenderFromVideo();
    if (!result) {
      verificationStatus.textContent = 'Analyzing face for gender verification...';
      instruction.textContent = 'Hold still and keep your face clearly visible.';
      return;
    }

    const detectedGender = result.gender;
    const confidencePercent = Math.round(result.probability * 100);
    const selectedLabel = capitalizeGender(selectedGender);
    const detectedLabel = capitalizeGender(detectedGender);

    if (
      detectedGender === selectedGender &&
      result.probability >= GENDER_CONFIDENCE_THRESHOLD
    ) {
      genderMatchFrames += 1;
      genderMismatchFrames = 0;
      verificationStatus.textContent = `Verifying gender... ${genderMatchFrames}/${REQUIRED_MATCH_FRAMES} confirmations (${confidencePercent}% ${detectedLabel})`;
      instruction.textContent = `Detected ${detectedLabel}. Hold still while we confirm your selection.`;

      if (genderMatchFrames >= REQUIRED_MATCH_FRAMES) {
        verificationStatus.textContent =
          'Gender verified. Extracting 128D face descriptor...';
        instruction.textContent = 'Hold still for a moment.';

        const faceVector = await computeFaceDescriptorFromVideo();
        if (!faceVector || faceVector.length !== 128) {
          failDetection(
            'Gender verified, but face descriptor extraction failed. Please try again.'
          );
          return;
        }

        redirectToSuccess(detectedGender, faceVector);
      }
      return;
    }

    if (result.probability >= GENDER_CONFIDENCE_THRESHOLD) {
      genderMismatchFrames += 1;
      genderMatchFrames = 0;
      verificationStatus.textContent = `Gender mismatch detected (${confidencePercent}% ${detectedLabel}).`;
      instruction.textContent = `You selected ${selectedLabel}, but the camera detected ${detectedLabel}.`;

      if (genderMismatchFrames >= REQUIRED_MISMATCH_FRAMES) {
        failDetection(
          `Verification failed. You selected ${selectedLabel}, but we detected ${detectedLabel}. Please try again.`
        );
      }
      return;
    }

    verificationStatus.textContent = `Analyzing gender... (${confidencePercent}% ${detectedLabel}, need ${Math.round(GENDER_CONFIDENCE_THRESHOLD * 100)}%)`;
    instruction.textContent = 'Hold still facing the camera in good lighting.';
  } catch (err) {
    console.error('Gender detection error:', err);
    verificationStatus.textContent =
      'Gender analysis failed temporarily. Hold still and retrying...';
  } finally {
    isDetectingGender = false;
  }
}

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

  if (!faceLandmarker || !faceApiModelsLoaded) {
    verificationStatus.textContent = 'Initializing verification models...';
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
      positionStableFrames = 0;
      return;
    }

    if (results.faceLandmarks.length > 1) {
      clearCanvas();
      verificationStatus.textContent = 'Multiple faces detected.';
      instruction.textContent = 'Ensure only one person is in front of the camera.';
      positionStableFrames = 0;
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
        if (isFaceCentered(yawRatio)) {
          positionStableFrames += 1;
          verificationStatus.textContent = `Face detected. Hold steady (${positionStableFrames}/${POSITION_STABLE_FRAMES})...`;
          instruction.textContent = 'Keep your face centered in the frame.';

          if (positionStableFrames >= POSITION_STABLE_FRAMES) {
            currentStage = LIVENESS_STAGES.BLINK;
            verificationStatus.textContent =
              'Face positioned! Now please blink your eyes.';
            instruction.textContent =
              'Blink your eyes to pass anti-spoofing liveness check.';
          }
        } else {
          positionStableFrames = 0;
          verificationStatus.textContent =
            'Face detected. Center your face in the frame.';
          instruction.textContent = 'Look straight at the camera in good lighting.';
        }
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
        } else {
          verificationStatus.textContent = 'Waiting for eye blink...';
          instruction.textContent = 'Blink both eyes clearly while facing the camera.';
        }
        break;

      case LIVENESS_STAGES.HEAD_TURN:
        livenessStep.textContent = 'Liveness Check: Step 3 of 3 - Turn Head';
        if (yawRatio < 0.38 || yawRatio > 0.62) {
          headTurnDetected = true;
          currentStage = LIVENESS_STAGES.VERIFYING;
          genderMatchFrames = 0;
          genderMismatchFrames = 0;
          livenessStep.textContent = 'Liveness Check Passed! Verifying Gender...';
          verificationStatus.textContent =
            'Head turn verified. Face the camera for gender check.';
          instruction.textContent = 'Look straight at the camera and hold still.';
        } else {
          verificationStatus.textContent = 'Turn your head left or right...';
          instruction.textContent = 'Slowly rotate your head to show 3D liveness.';
        }
        break;

      case LIVENESS_STAGES.VERIFYING:
        livenessStep.textContent = 'Liveness Check Passed! Verifying Gender...';
        if (!isFaceCentered(yawRatio)) {
          verificationStatus.textContent =
            'Face the camera directly for gender verification.';
          instruction.textContent = 'Return your head to center and hold still.';
          genderMatchFrames = 0;
          return;
        }

        await runGenderVerification();
        break;
    }
  } catch (err) {
    console.error('Frame processing error:', err);
  }
}

genderButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedGender = button.dataset.gender;
    selectionStatus.textContent = `Selected: ${capitalizeGender(selectedGender)}. Starting verification...`;
    showVerificationStage();
    loadModels();
  });
});

retryBtn.addEventListener('click', () => {
  if (!faceLandmarker || !faceApiModelsLoaded) {
    loadModels();
    return;
  }
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
