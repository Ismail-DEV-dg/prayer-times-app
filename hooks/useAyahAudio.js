import { useEffect, useRef, useState, useCallback } from "react";
import { Audio } from "expo-av";
import { PRIMARY_AUDIO_TIMEOUT_MS, TOTAL_TIMEOUT_MS } from "../services/quranApi";

// Single-ayah audio playback for Read mode. ONE Sound instance exists at any moment:
// pressing another ayah stops and unloads the previous one. Everything
// is cleaned up on unmount.
//
// Lifecycle safety:
// - mountedRef: once the owning screen unmounts, no load/playback is
//   started and no state is written;
// - playTokenRef: every play()/unload() bumps a generation counter;
//   a createAsync() that resolves after a newer play()/unload() is
//   stale — its Sound is unloaded immediately and never stored.
//
// Fallback & Race:
// - Primary API starts immediately.
// - If Primary does not respond within PRIMARY_AUDIO_TIMEOUT_MS (2s), immediately
//   starts the Fallback API.
// - If Primary fails early, Fallback is started immediately without waiting 2s.
// - Whichever returns first wins and plays; the other is unloaded immediately
//   to prevent double playback.
// - If both fail or TOTAL_TIMEOUT_MS (10s) expires, loading state is exited
//   and errorKey is set.
export function useAyahAudio() {
  const soundRef = useRef(null);
  const mountedRef = useRef(true);
  const playTokenRef = useRef(0);
  const [playingKey, setPlayingKey] = useState(null); // "surah/ayah"
  const [loadingKey, setLoadingKey] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [paused, setPaused] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Optional finish callback (Listen player auto-advance). Kept in a ref
  // so play() never needs to change identity when the callback changes.
  const onFinishRef = useRef(null);
  const setOnFinish = useCallback((fn) => {
    onFinishRef.current = typeof fn === "function" ? fn : null;
  }, []);

  const toggleLoop = useCallback(async () => {
    if (soundRef.current) {
      const nextLooping = !isLooping;
      try {
        await soundRef.current.setIsLoopingAsync(nextLooping);
        if (mountedRef.current) setIsLooping(nextLooping);
      } catch (e) {}
    }
  }, [isLooping]);

  // Releases the current Sound (if any) and invalidates every
  // in-flight load. Safe to call at any time, mounted or not.
  const unload = useCallback(async () => {
    playTokenRef.current++; // any createAsync resolving after this is stale
    if (soundRef.current) {
      const sound = soundRef.current;
      soundRef.current = null;
      try {
        await sound.stopAsync();
      } catch (e) {}
      try {
        await sound.unloadAsync();
      } catch (e) {
        // already unloaded
      }
    }
    if (mountedRef.current) {
      setPlayingKey(null);
      setLoadingKey(null);
      setPaused(false);
      setIsLooping(false);
    }
  }, []);

  const stop = useCallback(async () => {
    await unload();
  }, [unload]);

  // Playback position of the current sound (ms), for the progress bar.
  // Resolves to null when nothing is loaded.
  const getPosition = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return null;
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return null;
      return {
        positionMillis: status.positionMillis || 0,
        durationMillis: status.durationMillis || 0,
        isPlaying: status.isPlaying === true,
      };
    } catch (e) {
      return null;
    }
  }, []);

  // play(url, key, fallbackUrl = null, forceRestart = false)
  const play = useCallback(
    async (url, key, fallbackUrl = null, forceRestart = false) => {
      if (!mountedRef.current) return;
      setErrorKey(null);

      if (playingKey === key && soundRef.current) {
        if (forceRestart) {
          try {
            await soundRef.current.setPositionAsync(0);
            await soundRef.current.playAsync();
            if (mountedRef.current) setPaused(false);
          } catch (e) {}
          return;
        }
        // toggle pause/resume for the current ayah
        try {
          if (paused) {
            await soundRef.current.playAsync();
            if (mountedRef.current) setPaused(false);
          } else {
            await soundRef.current.pauseAsync();
            if (mountedRef.current) setPaused(true);
          }
        } catch (e) {
          // fall through to a fresh load
        }
        if (soundRef.current) return;
      }

      await unload(); // stop previous player, invalidate stale loads
      if (!mountedRef.current) return;
      setLoadingKey(key);

      const token = ++playTokenRef.current;
      const startTime = Date.now();

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        // audio mode configuration failure
      }

      if (!mountedRef.current || token !== playTokenRef.current) return;

      const hasFallback = typeof fallbackUrl === "string" && Boolean(fallbackUrl);

      let winnerFound = false;
      let primaryFinished = false;
      let fallbackFinished = false;
      let primaryError = false;
      let fallbackError = false;
      let fallbackStarted = false;
      let fallbackTimer = null;
      let totalTimer = null;

      const cleanupTimers = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (totalTimer) clearTimeout(totalTimer);
      };

      const handleWinner = async (sound, sourceName) => {
        if (winnerFound || !mountedRef.current || token !== playTokenRef.current) {
          // If already won or stale/unmounted, immediately stop and unload to prevent double play or leak
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch (e) {}
          return;
        }

        winnerFound = true;
        cleanupTimers();
        const duration = Date.now() - startTime;
        console.log(`[QuranAudio] ${sourceName} API responded in ${duration}ms`);

        soundRef.current = sound;
        if (mountedRef.current && token === playTokenRef.current) {
          setPlayingKey(key);
          setPaused(false);
          setLoadingKey(null);
        }
      };

      const handleBothFailed = () => {
        if (winnerFound || !mountedRef.current || token !== playTokenRef.current) return;
        winnerFound = true;
        cleanupTimers();
        console.log(`[QuranAudio] Both audio sources failed in ${Date.now() - startTime}ms`);
        soundRef.current = null;
        if (mountedRef.current && token === playTokenRef.current) {
          setPlayingKey(null);
          setLoadingKey(null);
          setErrorKey(key);
        }
      };

      const handleFailure = (sourceName) => {
        if (sourceName === "Primary") {
          primaryFinished = true;
          primaryError = true;
        } else {
          fallbackFinished = true;
          fallbackError = true;
        }

        if (winnerFound || !mountedRef.current || token !== playTokenRef.current) {
          return;
        }

        if (sourceName === "Primary") {
          // If primary failed before fallback started, trigger fallback immediately
          if (!fallbackStarted && hasFallback) {
            if (fallbackTimer) clearTimeout(fallbackTimer);
            startFallback();
          } else if (!hasFallback || fallbackFinished) {
            handleBothFailed();
          }
        } else {
          // Fallback failed
          if (primaryFinished && primaryError) {
            handleBothFailed();
          }
        }
      };

      const loadSound = async (targetUrl, sourceName) => {
        if (!targetUrl || typeof targetUrl !== "string") {
          handleFailure(sourceName);
          return;
        }

        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: targetUrl },
            { shouldPlay: true },
            (status) => {
              if (status.isLoaded && status.didJustFinish) {
                // only the CURRENT sound may react to its own finish
                if (soundRef.current === sound) {
                  if (status.isLooping) {
                    // It will loop natively, do not unload
                    return;
                  }
                  unload();
                  if (onFinishRef.current) onFinishRef.current(key);
                }
              }
            }
          );
          await handleWinner(sound, sourceName);
        } catch (e) {
          handleFailure(sourceName);
        }
      };

      const startFallback = () => {
        if (fallbackStarted || winnerFound || !hasFallback) return;
        fallbackStarted = true;
        loadSound(fallbackUrl, "Fallback");
      };

      // 1. Start primary audio request immediately
      loadSound(url, "Primary");

      // 2. Fallback switch timer: if primary does not respond within 2s, switch to fallback
      if (hasFallback) {
        fallbackTimer = setTimeout(() => {
          if (!winnerFound && !fallbackStarted && mountedRef.current && token === playTokenRef.current) {
            startFallback();
          }
        }, PRIMARY_AUDIO_TIMEOUT_MS);
      }

      // 3. Overall timeout: 10s
      totalTimer = setTimeout(() => {
        if (!winnerFound && mountedRef.current && token === playTokenRef.current) {
          console.log(`[QuranAudio] Overall audio timeout (${TOTAL_TIMEOUT_MS}ms) reached`);
          handleBothFailed();
        }
      }, TOTAL_TIMEOUT_MS);
    },
    [playingKey, paused, unload]
  );

  // Cleanup on unmount — releases the audio resource and blocks all
  // future loads/playback from this hook instance.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playTokenRef.current++;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  return { play, stop, playingKey, loadingKey, errorKey, paused, setOnFinish, getPosition, isLooping, toggleLoop };
}
