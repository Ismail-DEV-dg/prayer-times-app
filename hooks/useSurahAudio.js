import { useEffect, useRef, useState, useCallback } from "react";
import { Audio } from "expo-av";

// FULL-SURAH audio playback for the Listen mode ("Слушать").
// ONE SURAH = ONE CONTINUOUS SOUND: a single createAsync loads the whole
// surah track, so the progress bar, seek, pause and finish all refer to
// the entire surah (e.g. 00:00 / 61:47 for Al-Kahf), never to one ayah.
//
// Lifecycle safety (same contract as useAyahAudio, kept intact):
// - mountedRef: once the owning screen unmounts, no load/playback is
//   started and no state is written;
// - playTokenRef: every load()/unload() bumps a generation counter; a
//   createAsync() that resolves after a newer action is stale — its Sound
//   is unloaded immediately and never stored. Loading Surah A and quickly
//   switching to Surah B can never let A overwrite B, stop B, unload B
//   or change B's state. At most ONE Sound exists at any moment.
//
// Fallback: load(url, fallbackUrl) tries the fallback EXACTLY ONCE, only
// when the primary load fails. Both are FULL-SURAH tracks from verified
// same-human sources; there is never a "play one ayah and pretend" path.
// If both fail, error=true and the UI shows an honest error — no retry
// loop.
//
// Background playback: staysActiveInBackground: true (both platforms;
// iOS also needs UIBackgroundModes "audio" in app.json — configured).
export function useSurahAudio() {
  const soundRef = useRef(null);
  const mountedRef = useRef(true);
  const playTokenRef = useRef(0);

  // states: "idle" | "loading" | "playing" | "paused" | "error"
  const [status, setStatus] = useState("idle");
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // Optional finish callback (auto-advance to the next surah). Kept in
  // a ref so load() never needs to change identity.
  const onFinishRef = useRef(null);
  const setOnFinish = useCallback((fn) => {
    onFinishRef.current = typeof fn === "function" ? fn : null;
  }, []);

  // Releases the current Sound (if any) and invalidates every in-flight
  // load. Safe to call at any time, mounted or not.
  const unload = useCallback(async () => {
    playTokenRef.current++; // any createAsync resolving after this is stale
    if (soundRef.current) {
      const sound = soundRef.current;
      soundRef.current = null;
      try {
        await sound.unloadAsync();
      } catch (e) {
        // already unloaded
      }
    }
    if (mountedRef.current) {
      setStatus("idle");
      setPositionMillis(0);
      setDurationMillis(0);
      setIsBuffering(false);
    }
  }, []);

  // load(url, key, fallbackUrl = null) — creates ONE Sound for the whole
  // surah and starts playing it. `key` is a caller-defined identifier of
  // the current track ("reciterId/surah") used by the finish callback.
  const load = useCallback(
    async (url, key, fallbackUrl = null, startMillis = 0) => {
      if (!mountedRef.current) return;
      setStatus("loading");
      setPositionMillis(0);
      setDurationMillis(0);
      setIsBuffering(false);

      const stopCurrent = async () => {
        playTokenRef.current++;
        if (soundRef.current) {
          const sound = soundRef.current;
          soundRef.current = null;
          try {
            await sound.unloadAsync();
          } catch (e) {
            // already unloaded
          }
        }
      };
      await stopCurrent();
      if (!mountedRef.current) return;

      const urls = typeof fallbackUrl === "string" && fallbackUrl ? [url, fallbackUrl] : [url];

      let lastToken = -1;
      for (let i = 0; i < urls.length; i++) {
        const token = ++playTokenRef.current;
        lastToken = token;
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            // Background playback: keep the sound active when the app is
            // backgrounded / the screen is off. Android holds a partial
            // wake lock while a Sound is playing (WAKE_LOCK permission
            // is declared in app.json).
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          const { sound } = await Audio.Sound.createAsync(
            { uri: urls[i] },
            { shouldPlay: true, ...(startMillis > 0 ? { positionMillis: startMillis } : {}) },
            (playbackStatus) => {
              // onPlaybackStatusUpdate: only the CURRENT sound may update
              // the player state. Guarded by soundRef identity + token.
              if (soundRef.current !== sound) return;
              if (!playbackStatus.isLoaded) {
                // Unloaded / failed — a genuine load error is handled by
                // the createAsync catch; nothing to do here.
                return;
              }
              if (mountedRef.current) {
                if (playbackStatus.isPlaying) setStatus("playing");
                else if (playbackStatus.isBuffering) setStatus((s) => (s === "playing" || s === "paused" ? s : s));
                setIsBuffering(playbackStatus.isBuffering === true);
                if (typeof playbackStatus.positionMillis === "number") {
                  setPositionMillis(playbackStatus.positionMillis);
                }
                if (
                  typeof playbackStatus.durationMillis === "number" &&
                  playbackStatus.durationMillis > 0
                ) {
                  setDurationMillis(playbackStatus.durationMillis);
                }
              }
              if (playbackStatus.didJustFinish) {
                // The WHOLE surah track has really finished: unload and
                // notify (auto-next). Called AFTER the internal unload so
                // the player sees a clean state. Only the CURRENT sound.
                if (soundRef.current === sound) {
                  const finishedKey = key;
                  unload().then(() => {
                    if (onFinishRef.current) onFinishRef.current(finishedKey);
                  });
                }
              }
            }
          );
          if (!mountedRef.current || token !== playTokenRef.current) {
            // unmounted, or superseded by a newer load()/unload():
            // release immediately, store nothing. A slow Surah A load can
            // never leak into the newer Surah B.
            try {
              await sound.unloadAsync();
            } catch (e) {
              // already unloaded
            }
            return;
          }
          soundRef.current = sound;
          setStatus("playing");
          return; // PRIMARY (or fallback) loaded — done
        } catch (e) {
          if (!mountedRef.current) {
            // unmounted mid-load: make sure nothing half-loaded leaks
            playTokenRef.current++;
            return;
          }
          if (token !== playTokenRef.current) {
            return; // a newer action owns the player now
          }
          // try the next URL (the single fallback attempt), or fail
        }
      }

      // every candidate URL failed (or none was given) — honest error
      if (mountedRef.current && lastToken === playTokenRef.current) {
        soundRef.current = null;
        setStatus("error");
      }
    },
    [unload]
  );

  // play/pause toggle for the current (fully loaded) surah track.
  const playPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      const st = await sound.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) {
        await sound.pauseAsync();
        if (mountedRef.current) setStatus("paused");
      } else {
        await sound.playAsync();
        if (mountedRef.current) setStatus("playing");
      }
    } catch (e) {
      // sound died mid-toggle; state stays as-is
    }
  }, []);

  // Resume (from paused) without toggling.
  const play = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.playAsync();
      if (mountedRef.current) setStatus("playing");
    } catch (e) {
      // ignore
    }
  }, []);

  // Pause without toggling.
  const pause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.pauseAsync();
      if (mountedRef.current) setStatus("paused");
    } catch (e) {
      // ignore
    }
  }, []);

  // Seek anywhere within the whole surah track.
  const seekTo = useCallback(async (millis) => {
    const sound = soundRef.current;
    const ms = Number(millis);
    if (!sound || !Number.isFinite(ms) || ms < 0) return;
    try {
      await sound.setPositionAsync(ms);
      if (mountedRef.current) setPositionMillis(ms);
    } catch (e) {
      // seek failed (e.g. not seekable) — keep the current position
    }
  }, []);

  // Current playback position snapshot (poll; the status callback already
  // streams updates, this is for callers that want a one-shot read).
  const getPosition = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return null;
    try {
      const st = await sound.getStatusAsync();
      if (!st.isLoaded) return null;
      return {
        positionMillis: st.positionMillis || 0,
        durationMillis: st.durationMillis || 0,
        isPlaying: st.isPlaying === true,
      };
    } catch (e) {
      return null;
    }
  }, []);

  // Cleanup on unmount — releases the audio resource and blocks all
  // future loads/playback from this hook instance.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playTokenRef.current++;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  return {
    load,
    unload,
    playPause,
    play,
    pause,
    seekTo,
    getPosition,
    setOnFinish,
    status,
    positionMillis,
    durationMillis,
    isBuffering,
  };
}
