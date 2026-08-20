import React, { useCallback, useRef, useState } from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import Tooltip from "@atlaskit/tooltip";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

interface AudioTooltipProps {
  /** URL of the audio file (Kinyarwanda voice guidance). */
  readonly audioSrc: string;
  /** Visible label accompanying the speaker icon. */
  readonly label?: string;
  readonly testId?: string;
}

// cssMap at module scope — build-time extraction.
// Two variants: idle and playing.  cx() applies the correct variant at runtime.
const buttonStyles = cssMap({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // 48×48 px target satisfies Fitts's Law under physical fatigue (HCI mandate).
    minWidth: "48px",
    minHeight: "48px",
    border: "none",
    cursor: "pointer",
    padding: token("space.100"),
    borderRadius: token("radius.small"),
  },
  idle: {
    backgroundColor: token("color.background.neutral"),
    color: token("color.text.subtle"),
  },
  playing: {
    backgroundColor: token("color.background.brand.bold"),
    color: token("color.text.inverse"),
  },
});


/**
 * Audio guidance widget — HCI research mandate (section 3):
 *
 *   "For lower-ranking posts, implement Audio Tooltips. Place a small
 *    'Speaker' icon next to complex questions. When tapped, play a recorded
 *    voice explanation in Kinyarwanda. Research shows this increases data
 *    accuracy by 30% in semi-literate demographics."
 *
 * Implementation:
 * - Uses the Web Audio / <audio> element — no third-party dependency.
 * - Haptic feedback (vibrate) offloads confirmation from visual channel
 *   to the somatosensory channel, matching the field-tablet neuro-ergonomics
 *   requirement.
 * - Button target is min 48×48 px to satisfy Fitts's Law under fatigue.
 */
export function AudioTooltip({
  audioSrc,
  label,
  testId,
}: AudioTooltipProps): React.ReactElement {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = useCallback((): void => {
    if (audioRef.current === null) {
      audioRef.current = new Audio(audioSrc);
      audioRef.current.addEventListener("ended", () => {
        setPlaying(false);
      });
    }

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    // Haptic confirmation — offloads confirmation from overloaded visual cortex.
    if (navigator.vibrate !== undefined) {
      navigator.vibrate(50);
    }

    void audioRef.current.play();
    setPlaying(true);
  }, [audioSrc, playing]);

  return (
    <Tooltip content={t("a11y.play_audio_help")}>
      <Inline space="space.050" alignBlock="center" {...(testId !== undefined ? { testId } : {})}>
        <button
          type="button"
          aria-label={t("a11y.play_audio_help")}
          aria-pressed={playing}
          onClick={handlePlay}
        >
          <Box
            xcss={cx(buttonStyles['base'], playing ? buttonStyles['playing'] : buttonStyles['idle'])}
          >
            <span role="img" aria-hidden="true">
              {playing ? "🔊" : "🔈"}
            </span>
          </Box>
        </button>
        {label !== undefined && (
          <Text size="small" color="color.text.subtle">{label}</Text>
        )}
      </Inline>
    </Tooltip>
  );
}
