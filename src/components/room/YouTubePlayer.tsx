"use client";

import { useEffect, useRef, useCallback } from "react";

interface YouTubePlayerProps {
  videoId: string;
  sessionId: string;
  startedAt: string | null;
  durationSeconds: number | null;
  isPaused: boolean;
  muted: boolean;
  onEnded: (sessionId: string) => void;
  onDurationReady?: (seconds: number) => void;
  onAutoplayMuted?: (blocked: boolean) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement,
        config: {
          videoId: string;
          playerVars: Record<string, number | string>;
          events: {
            onReady: (event: { target: YTPlayer }) => void;
            onStateChange: (event: { data: number; target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (
    videoIdOrOptions: string | { videoId: string; startSeconds?: number }
  ) => void;
}

let apiLoaded = false;
let apiLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (apiLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    apiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(tag);
  });
}

function reportDuration(
  player: YTPlayer,
  onDurationReady?: (seconds: number) => void
) {
  const duration = player.getDuration();
  if (duration > 0 && onDurationReady) {
    onDurationReady(Math.floor(duration));
  }
}

function elapsedSeconds(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000);
}

/** Hidden audio-only YouTube player — controls playback without showing video. */
export function YouTubePlayer({
  videoId,
  sessionId,
  startedAt,
  durationSeconds,
  isPaused,
  muted,
  onEnded,
  onDurationReady,
  onAutoplayMuted,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef(sessionId);
  const readyRef = useRef(false);
  const switchingRef = useRef(false);
  const gestureUnlockRef = useRef<(() => void) | null>(null);
  const onEndedRef = useRef(onEnded);
  const onDurationReadyRef = useRef(onDurationReady);
  const onAutoplayMutedRef = useRef(onAutoplayMuted);
  const isPausedRef = useRef(isPaused);
  const mutedRef = useRef(muted);
  onEndedRef.current = onEnded;
  onDurationReadyRef.current = onDurationReady;
  onAutoplayMutedRef.current = onAutoplayMuted;
  isPausedRef.current = isPaused;
  mutedRef.current = muted;
  activeSessionIdRef.current = sessionId;

  const clearGestureUnlock = useCallback(() => {
    if (gestureUnlockRef.current) {
      document.removeEventListener("pointerdown", gestureUnlockRef.current, true);
      gestureUnlockRef.current = null;
    }
  }, []);

  const syncAutoplayMuteState = useCallback((player: YTPlayer) => {
    if (mutedRef.current) {
      onAutoplayMutedRef.current?.(false);
      clearGestureUnlock();
      return;
    }

    let blocked = false;
    try {
      blocked = player.isMuted();
    } catch {
      blocked = false;
    }

    onAutoplayMutedRef.current?.(blocked);

    if (blocked && !gestureUnlockRef.current) {
      const unlock = () => {
        if (mutedRef.current) return;
        try {
          player.unMute();
          if (!isPausedRef.current) {
            player.playVideo();
          }
          if (!player.isMuted()) {
            onAutoplayMutedRef.current?.(false);
            clearGestureUnlock();
          }
        } catch {
          // Player may not be ready yet.
        }
      };
      gestureUnlockRef.current = unlock;
      document.addEventListener("pointerdown", unlock, { capture: true });
    }

    if (!blocked) {
      clearGestureUnlock();
    }
  }, [clearGestureUnlock]);

  const applyPlaybackState = useCallback((player: YTPlayer) => {
    if (mutedRef.current) {
      player.mute();
    } else {
      player.unMute();
    }
    if (isPausedRef.current) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
    syncAutoplayMuteState(player);
  }, [syncAutoplayMuteState]);

  const notifyEnded = useCallback((endedSessionId: string) => {
    onEndedRef.current(endedSessionId);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !videoId) return;

    let cancelled = false;
    const initialSessionId = sessionId;

    (async () => {
      await loadYouTubeAPI();
      if (cancelled || !containerRef.current) return;

      const startSeconds = elapsedSeconds(startedAt);

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            loadedVideoIdRef.current = videoId;
            activeSessionIdRef.current = initialSessionId;
            if (startSeconds > 0) {
              event.target.seekTo(startSeconds, true);
            }
            applyPlaybackState(event.target);
            reportDuration(
              event.target,
              onDurationReadyRef.current ?? undefined
            );
          },
          onStateChange: (event) => {
            const { ENDED, PLAYING, BUFFERING } = window.YT.PlayerState;
            if (
              event.data === PLAYING ||
              event.data === BUFFERING
            ) {
              switchingRef.current = false;
              applyPlaybackState(event.target);
            }
            if (event.data === ENDED && !switchingRef.current) {
              notifyEnded(activeSessionIdRef.current);
              return;
            }
            reportDuration(
              event.target,
              onDurationReadyRef.current ?? undefined
            );
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      switchingRef.current = true;
      readyRef.current = false;
      loadedVideoIdRef.current = null;
      clearGestureUnlock();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // Player is created once per mount; track changes use loadVideoById below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current || !videoId) return;

    if (loadedVideoIdRef.current === videoId) {
      activeSessionIdRef.current = sessionId;
      const startSeconds = elapsedSeconds(startedAt);
      if (startSeconds > 0) {
        const drift = Math.abs(player.getCurrentTime() - startSeconds);
        if (drift > 3) {
          player.seekTo(startSeconds, true);
        }
      }
      applyPlaybackState(player);
      return;
    }

    switchingRef.current = true;
    loadedVideoIdRef.current = videoId;
    activeSessionIdRef.current = sessionId;
    const startSeconds = elapsedSeconds(startedAt);
    if (startSeconds > 0) {
      player.loadVideoById({ videoId, startSeconds });
    } else {
      player.loadVideoById(videoId);
    }
  }, [videoId, sessionId, startedAt, applyPlaybackState]);

  useEffect(() => {
    if (!playerRef.current || !readyRef.current) return;
    applyPlaybackState(playerRef.current);
  }, [isPaused, muted, applyPlaybackState]);

  useEffect(() => {
    if (muted) return;
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    syncAutoplayMuteState(player);
  }, [muted, syncAutoplayMuteState]);

  useEffect(() => () => clearGestureUnlock(), [clearGestureUnlock]);

  useEffect(() => {
    if (!startedAt || !durationSeconds || !sessionId) return;

    const endedSessionId = sessionId;
    const elapsed = elapsedSeconds(startedAt);
    const remaining = (durationSeconds - elapsed) * 1000;

    if (remaining <= 0) {
      if (elapsed >= 3) {
        notifyEnded(endedSessionId);
      }
      return;
    }

    const timer = setTimeout(() => {
      notifyEnded(endedSessionId);
    }, remaining + 2000);

    return () => clearTimeout(timer);
  }, [startedAt, durationSeconds, videoId, sessionId, notifyEnded]);

  return (
    <div
      className="fixed w-px h-px overflow-hidden opacity-0 pointer-events-none"
      style={{ left: -9999, top: -9999 }}
      aria-hidden
    >
      <div ref={containerRef} />
    </div>
  );
}
