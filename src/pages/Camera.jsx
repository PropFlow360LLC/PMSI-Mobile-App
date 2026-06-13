import { useRef, useState, useEffect, useCallback } from 'react';

function getVideoMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export default function Camera({
  propertyAddress,
  uploadSummary,
  onUploadFile,
  onViewQueue,
  onDone,
  onCancel,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [mode, setMode] = useState('photo');
  const [facingMode, setFacingMode] = useState('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [zoom] = useState('1.0x');

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: mode === 'video',
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (torchOn) {
        await applyTorch(stream, true);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, [facingMode, mode, stopCamera, torchOn]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // Restart stream when camera facing or capture mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, mode]);

  const applyTorch = async (stream, enabled) => {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled }] });
    } catch {
      // Torch not supported on this device
    }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    setTorchOn(next);
    if (streamRef.current) {
      await applyTorch(streamRef.current, next);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setTorchOn(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onUploadFile(file);
      },
      'image/jpeg',
      0.9
    );
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;

    const mimeType = getVideoMimeType();
    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'video/webm',
        });
        const ext = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `video_${Date.now()}.${ext}`, {
          type: blob.type || 'video/webm',
        });
        onUploadFile(file);
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRecordToggle = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleDoneClick = () => {
    if (!confirmDone) {
      setConfirmDone(true);
      setTimeout(() => setConfirmDone(false), 4000);
      return;
    }
    stopCamera();
    onDone();
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const activeCount = uploadSummary.uploading + uploadSummary.queued;
  const showQueueBar = uploadSummary.total > 0;

  return (
    <div className="camera-screen">
      <div className="camera-header">
        <button type="button" className="camera-header-btn" onClick={handleCancel} aria-label="Back">
          ‹
        </button>
        <div className="camera-header-center">
          <div className="camera-header-title">Camera</div>
          {propertyAddress && (
            <div className="camera-header-address">{propertyAddress}</div>
          )}
        </div>
        <div className="camera-header-spacer" />
      </div>

      {showQueueBar && (
        <div className="camera-queue-bar">
          <span className="camera-queue-icon">📤</span>
          <div className="camera-queue-text">
            <div>
              {uploadSummary.uploading > 0
                ? `Uploading ${uploadSummary.uploading + uploadSummary.queued} items…`
                : `${uploadSummary.queued} item(s) queued`}
            </div>
            <div className="camera-queue-sub">
              {uploadSummary.completed} completed
              {uploadSummary.uploading > 0 && ` · ${uploadSummary.uploading} uploading`}
            </div>
          </div>
          <button type="button" className="camera-view-queue-btn" onClick={onViewQueue}>
            View Queue
          </button>
        </div>
      )}

      <div className="camera-preview">
        <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="camera-overlay-top">
          <button type="button" className="camera-pill" onClick={toggleTorch}>
            ⚡ {torchOn ? 'On' : 'Off'}
          </button>
          <span className="camera-pill camera-pill-static">{zoom}</span>
        </div>

        <div className="camera-mode-toggle">
          <button
            type="button"
            className={`camera-mode-btn ${mode === 'photo' ? 'active' : ''}`}
            onClick={() => setMode('photo')}
          >
            Photo
          </button>
          <button
            type="button"
            className={`camera-mode-btn ${mode === 'video' ? 'active' : ''}`}
            onClick={() => setMode('video')}
          >
            Video
          </button>
        </div>
      </div>

      <div className="camera-control-panel">
        <div className="camera-control-grid">
          <button
            type="button"
            className="camera-round-btn camera-round-snapshot"
            onClick={capturePhoto}
            disabled={mode === 'video' && recording}
          >
            <span>📷</span>
          </button>
          <div className="camera-control-label">
            <strong>Snapshot</strong>
            <span>Take a photo</span>
          </div>

          <button
            type="button"
            className={`camera-round-btn camera-round-record ${recording ? 'recording' : ''}`}
            onClick={handleRecordToggle}
            disabled={mode === 'photo'}
          >
            <span>{recording ? '⏹' : '⏺'}</span>
          </button>
          <div className="camera-control-label">
            <strong>{recording ? 'Stop Video' : 'Record Video'}</strong>
            <span>{recording ? 'Tap to finish' : 'Start recording'}</span>
          </div>

          <button type="button" className="camera-round-btn" onClick={flipCamera}>
            <span>🔄</span>
          </button>
          <div className="camera-control-label">
            <strong>Flip</strong>
            <span>Front / Rear</span>
          </div>

          <button type="button" className="camera-round-btn" onClick={toggleTorch}>
            <span>💡</span>
          </button>
          <div className="camera-control-label">
            <strong>Light</strong>
            <span>Torch on/off</span>
          </div>
        </div>
      </div>

      <div className="camera-exit-bar">
        <button type="button" className="camera-exit-btn camera-exit-cancel" onClick={handleCancel}>
          <span>✕</span>
          <span>Cancel</span>
        </button>
        <button
          type="button"
          className={`camera-exit-btn camera-exit-done ${confirmDone ? 'confirm-ready' : ''}`}
          onClick={handleDoneClick}
        >
          <span>✓</span>
          <span>{confirmDone ? 'Tap again to finish' : 'Done'}</span>
        </button>
      </div>
    </div>
  );
}
