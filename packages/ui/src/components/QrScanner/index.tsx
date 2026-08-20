/* eslint-disable @atlaskit/ui-styling-standard/enforce-style-prop, @atlaskit/design-system/no-unsafe-design-token-usage, @atlaskit/ui-styling-standard/no-imported-style-values */
import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Box, Stack } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { css, cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

interface QrScannerProps {
  readonly onScan: (value: string) => void;
  readonly onError?: (err: Error) => void;
  readonly testId?: string;
}

const previewWrapperStyles = cssMap({
  base: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: token("color.background.neutral"),
    borderRadius: token("radius.medium"),
  },
  hidden: {
    display: "none",
  },
});

const toggleButtonWrapperStyles = cssMap({
  base: {
    // Ensure the tap target meets the 48 px minimum required by WCAG 2.5.5.
    minWidth: "48px",
    minHeight: "48px",
    display: "flex",
    alignItems: "center",
  },
});

const videoBaseStyles = css({
  display: "block",
  width: "100%",
  maxWidth: "480px",
});

function hasCameraApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.mediaDevices !== undefined &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * Live QR scanner using the device camera + jsQR for decoding.
 *
 * Falls back to a manual text-entry field when getUserMedia is unavailable
 * (desktop without webcam, iOS privacy restriction, HTTPS not served, etc.).
 *
 * Video frames are drawn to a hidden <canvas> each animation frame; jsQR
 * inspects the raw ImageData.  On a match the stream is torn down and
 * onScan is called with the decoded string.
 */
export function QrScanner({
  onScan,
  onError,
  testId,
}: QrScannerProps): React.ReactElement {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep callback ref current without triggering RAF restarts.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraSupported] = useState<boolean>(hasCameraApi);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");

  const stopCamera = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Always clean up on unmount.
  useEffect(() => stopCamera, [stopCamera]);

  const tick = useCallback((): void => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (
      video === null ||
      canvas === null ||
      video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA
    ) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code !== null) {
      stopCamera();
      onScanRef.current(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopCamera]);

  const startCamera = useCallback(async (): Promise<void> => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setCameraError(t("scan.camera_error"));
      onError?.(error);
    }
  }, [tick, onError, t]);

  const handleToggle = useCallback((): void => {
    if (isScanning) {
      stopCamera();
    } else {
      void startCamera();
    }
  }, [isScanning, stopCamera, startCamera]);

  const handleManualChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setManualValue(e.target.value);
    },
    [],
  );

  const handleManualSubmit = useCallback((): void => {
    const trimmed = manualValue.trim();
    if (trimmed.length > 0) {
      onScan(trimmed);
      setManualValue("");
    }
  }, [manualValue, onScan]);

  const handleManualKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter") {
        handleManualSubmit();
      }
    },
    [handleManualSubmit],
  );

  // Camera unavailable or blocked — show fallback only.
  if (!cameraSupported || cameraError !== null) {
    return (
      <Box {...(testId !== undefined ? { testId } : {})}>
        <Stack space="space.300">
          {!cameraSupported && (
            <SectionMessage appearance="information">
              {t("scan.no_camera")}
            </SectionMessage>
          )}
          {cameraError !== null && (
            <SectionMessage appearance="warning">{cameraError}</SectionMessage>
          )}
          <TextField
            value={manualValue}
            onChange={handleManualChange}
            onKeyDown={handleManualKeyDown}
            placeholder={t("scan.fallback_placeholder")}
            aria-label={t("scan.fallback_label")}
          />
          <Box xcss={toggleButtonWrapperStyles['base']}>
            <Button appearance="primary" onClick={handleManualSubmit}>
              {t("scan.fallback_submit")}
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  }

  // Camera available — show live preview + toggle.
  return (
    <Box xcss={previewWrapperStyles['base']} {...(testId !== undefined ? { testId } : {})}>
      {/* Hidden canvas — pixel extraction only, never shown */}
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />

      <Stack space="space.300">
        <Box
          xcss={
            isScanning
              ? previewWrapperStyles['base']
              : previewWrapperStyles['hidden']
          }
          style={{ borderRadius: "var(--ds-border-radius-200, 8px)" }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ display: "block", width: "100%", maxWidth: "480px" }}
            aria-label={t("scan.preview")}
          />
        </Box>

        <Box xcss={toggleButtonWrapperStyles['base']}>
          <Button
            appearance={isScanning ? "default" : "primary"}
            onClick={handleToggle}
          >
            {isScanning ? t("scan.stop") : t("scan.start")}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
