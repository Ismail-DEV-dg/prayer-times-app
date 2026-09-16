import { useEffect, useRef, useState, useCallback } from "react";
import { Audio } from "expo-av";

// Single-ayah audio playback. ONE Sound instance exists at any moment:
// pressing another ayah stops and unloads the previous one. Everything
// is cleaned up on unmount.
//
// Lifecycle safety (6.3):
// - mountedRef: once the owning screen unmounts, no load/playback is
//   started and no state is written;
// - playTokenRef: every play()/unload() bumps a generation counter;
//   a createAsync() that resolves after a newer play()/unload() is
//   stale — its Sound is unloaded immediately and never stored, so a
//   slow PRIMARY load can never leak a playing sound.
//
// Fallback (6.4): play(url, key, fallbackUrl) tries the fallback URL
// EXACTLY ONCE when (and only when) the primary load fails. A null/
// undefined fallbackUrl is perfectly valid — PRIMARY alone. If both
// fail, errorKey is set (existing error UI), with NO retry loop.
// The fallback is fully optional: the hook never imports or requires
// any specific fallback source.
//
// expo-av is the SDK 54 audio module (expo-audio is newer but
// expo-av ~16.0.8 is the bundled, verified version for this SDK).
//
// Player extensions (Listen mode) — additive only, the original API
// (play/stop/playingKey/loadingKey/errorKey/paused) is unchanged:
// - setOnFinish(fn): optional callback invoked when the CURRENT sound
//   finishes (didJustFinish). The player screen uses it to advance to
//   the next ayah. The internal unload-on-finish behavior is preserved;
// - getPosition(): playback position + duration of the current sound
//   (for the progress bar), null when nothing is loaded;
// - background playback: the audio mode keeps the sound active in the
//   background (staysActiveInBackground: true on both platforms —
//   iOS additionally needs UIBackgroundModes "audio" in app.json, which
//   is configured there). Works through the SAME single-Sound
//   architecture — no second audio system.
export function useAyahAudio() {
  const soundRef = useRef(null);
  const mountedRef = useRef(true);
  const playTokenRef = useRef(0);
  const [playingKey, setPlayingKey] = useState(null); // "surah/ayah"
  const [loadingKey, setLoadingKey] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [paused, setPaused] = useState(false);

  // Optional finish callback (Listen player auto-advance). Kept in a ref
  // so play() never needs to change identity when the callback changes.
  const onFinishRef = useRef(null);
  const setOnFinish = useCallback((fn) => {
    onFinishRef.current = typeof fn === "function" ? fn : null;
  }, []);

  // Releases the current Sound (if any) and invalidates every
  // in-flight load. Safe to call at any time, mounted or not.
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
      setPlayingKey(null);
      setLoadingKey(null);
      setPaused(false);
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

  // play(url, key, fallbackUrl = null) — loads and plays; guards
  // against double-taps. fallbackUrl is optional and may be absent.
  const play = useCallback(
    async (url, key, fallbackUrl = null) => {
      if (!mountedRef.current) return;
      setErrorKey(null);

      if (playingKey === key && soundRef.current) {
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

      const urls = typeof fallbackUrl === "string" && fallbackUrl ? [url, fallbackUrl] : [url];

      let lastToken = -1;
      for (let i = 0; i < urls.length; i++) {
        const token = ++playTokenRef.current;
        lastToken = token;
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            // Background playback (Listen mode): keep the sound active
            // when the app is backgrounded / the screen is off. iOS also
            // needs UIBackgroundModes: ["audio"] (app.json); Android
            // holds a partial wake lock while a Sound is playing.
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          const { sound } = await Audio.Sound.createAsync(
            { uri: urls[i] },
            { shouldPlay: true },
            (status) => {
              if (status.isLoaded && status.didJustFinish) {
                // only the CURRENT sound may react to its own finish
                if (soundRef.current === sound) {
                  unload();
                  // Notify the player (auto-advance). Called AFTER the
                  // internal unload so the player sees a clean state.
                  if (onFinishRef.current) onFinishRef.current(key);
                }
              }
            }
          );
          if (!mountedRef.current || token !== playTokenRef.current) {
            // unmounted, or superseded by a newer play()/unload():
            // release immediately, store nothing. If unmounted, stop
            // entirely — no fallback, no state writes; if merely
            // superseded, a newer play() owns the loop now.
            try {
              await sound.unloadAsync();
            } catch (e) {
              // already unloaded
            }
            return;
          }
          soundRef.current = sound;
          setPlayingKey(key);
          setPaused(false);
          setLoadingKey(null);
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

      // every candidate URL failed (or none was given)
      if (mountedRef.current && lastToken === playTokenRef.current) {
        soundRef.current = null;
        setPlayingKey(null);
        setLoadingKey(null);
        setErrorKey(key);
      }
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
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  return { play, stop, playingKey, loadingKey, errorKey, paused, setOnFinish, getPosition };
}
