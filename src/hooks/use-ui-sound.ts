"use client";

import { useCallback, useRef } from "react";

type ToneContext = AudioContext;

function createTone(
  context: ToneContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.025);
}

export function useUiSound(enabled: boolean) {
  const contextRef = useRef<ToneContext | null>(null);

  const withAudio = useCallback(
    (play: (context: ToneContext) => void) => {
      if (!enabled || typeof window === "undefined" || !window.AudioContext) return;

      const context = contextRef.current ?? new window.AudioContext();
      contextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().then(() => play(context)).catch(() => undefined);
        return;
      }

      play(context);
    },
    [enabled],
  );

  const playTap = useCallback(() => {
    withAudio((context) => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.exponentialRampToValueAtTime(285, now + 0.075);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.026, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.095);
    });

    if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }, [enabled, withAudio]);

  const playSuccess = useCallback(() => {
    withAudio((context) => {
      const now = context.currentTime;
      createTone(context, 660, now, 0.1, 0.022);
      createTone(context, 880, now + 0.075, 0.14, 0.025);
    });
  }, [withAudio]);

  return { playTap, playSuccess };
}
