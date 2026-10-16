import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOTIFICATION_ID = "quran_background_audio_player";
export const CHANNEL_ID = "quran_audio_player";
export const CATEGORY_ID = "quran_player_controls";

// Actions
export const ACTION_PREV = "action_prev";
export const ACTION_REWIND = "action_rewind";
export const ACTION_PLAY_PAUSE = "action_play_pause";
export const ACTION_FORWARD = "action_forward";
export const ACTION_NEXT = "action_next";
export const ACTION_LOOP = "action_loop";

let isInitialized = false;

/**
 * Configure notifications to show alert banners and setup Android channel / iOS categories
 */
export async function initBackgroundPlayer() {
  if (isInitialized || Platform.OS === "web") return;

  try {
    // Show notification even if app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Плеер Корана",
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
        showBadge: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // Register categories with action buttons
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      {
        identifier: ACTION_PREV,
        buttonTitle: "⏮ Пред",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_REWIND,
        buttonTitle: "⏪ -10с",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_PLAY_PAUSE,
        buttonTitle: "⏯ Пауза/Пуск",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_FORWARD,
        buttonTitle: "⏩ +10с",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_NEXT,
        buttonTitle: "⏭ След",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_LOOP,
        buttonTitle: "🔁 Повтор",
        options: { opensAppToForeground: false },
      },
    ]);

    isInitialized = true;
  } catch (e) {
    // Best-effort initialization
  }
}

/**
 * Request notification permissions if not already granted
 */
export async function requestPlayerNotificationPermissions() {
  if (Platform.OS === "web") return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch (e) {
    return false;
  }
}

/**
 * Show or update sticky media player notification
 */
export async function updateBackgroundPlayerNotification({
  surah,
  reciter,
  isPlaying = false,
  isLooping = false,
}) {
  if (Platform.OS === "web") return;

  try {
    await initBackgroundPlayer();

    const title = surah
      ? `${surah.number}. ${surah.englishName} · ${surah.name || ""}`
      : "Священный Коран";

    const reciterName = reciter?.name || "Чтец";
    const statusText = isPlaying ? "▶ Играет" : "⏸ На паузе";
    const loopText = isLooping ? " · 🔁 Повтор ВКЛ" : "";

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body: `${reciterName} · ${statusText}${loopText}`,
        subtitle: isPlaying ? "Воспроизведение Корана" : "Пауза",
        data: { screen: "/listen/player" },
        sound: false,
        sticky: isPlaying,
        autoDismiss: false,
        categoryIdentifier: CATEGORY_ID,
        color: "#E3BE72", // Gold accent color from theme
      },
      trigger: null, // deliver immediately
    });
  } catch (e) {
    // Best-effort notification update
  }
}

/**
 * Dismiss the media player notification
 */
export async function dismissBackgroundPlayerNotification() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch (e) {
    // Ignore error
  }
}

/**
 * Listen for notification action button taps
 * @param {object} callbacks - { onPlayPause, onPrev, onNext, onRewind, onForward, onToggleLoop }
 * @returns {function} unsubscribe function
 */
export function addNotificationActionListener(callbacks) {
  if (Platform.OS === "web") return () => {};

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      if (!actionId || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // User tapped the notification itself (not a button) -> default app foregrounding
        return;
      }

      switch (actionId) {
        case ACTION_PLAY_PAUSE:
          if (typeof callbacks?.onPlayPause === "function") callbacks.onPlayPause();
          break;
        case ACTION_PREV:
          if (typeof callbacks?.onPrev === "function") callbacks.onPrev();
          break;
        case ACTION_NEXT:
          if (typeof callbacks?.onNext === "function") callbacks.onNext();
          break;
        case ACTION_REWIND:
          if (typeof callbacks?.onRewind === "function") callbacks.onRewind(10000);
          break;
        case ACTION_FORWARD:
          if (typeof callbacks?.onForward === "function") callbacks.onForward(10000);
          break;
        case ACTION_LOOP:
          if (typeof callbacks?.onToggleLoop === "function") callbacks.onToggleLoop();
          break;
      }
    });

    return () => {
      subscription.remove();
    };
  } catch (e) {
    return () => {};
  }
}
