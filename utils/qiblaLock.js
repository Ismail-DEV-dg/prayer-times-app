// Pure lock state-machine for the Qibla light-beam compass.
// Extracted from app/qibla.js so it is unit-testable in Node (the math
// of the Qibla direction itself lives untouched in services/qiblaApi.js).
//
// The machine consumes the beam's on-screen angle (deg, 0 = straight up
// at the Kaaba icon) once per sensor tick and decides:
//   - whether the beam should keep free-tracking,
//   - when the sustained-alignment LOCK engages (beam eases onto the
//     icon and holds ~1.5-2 s),
//   - when the lock releases (timeout, or the user rotates noticeably).
//
// All thresholds are the constants used by the screen. Behavior rules:
//   LOCK:   |align| <= 3° for LOCK_CONSECUTIVE_TICKS in a row AND armed
//           (armed = the beam previously left the wider REARM envelope,
//           so a hold right at the icon can't re-trigger instantly).
//   RELEASE: |align| > RELEASE_DEG (user is rotating away — never feels
//           frozen) or the hold time has elapsed.
//   RE-ARM: after a release the lock triggers again only after the beam
//           leaves |align| > REARM_DEG, preventing lock/unlock flapping
//           when the user hovers near the icon.

export const LOCK_CONSECUTIVE_TICKS = 5; // ~150 ms of sustained alignment
export const LOCK_HOLD_MS = 1600; // aligned state stays locked ~1.5-2 s
export const LOCK_ANIM_MS = 450; // soft fixation ease when the beam locks onto the icon
export const ALIGN_TOL_DEG = 3; // aligned = beam within 3° of the icon
export const RELEASE_DEG = 8; // noticeable rotation during the lock releases it
export const REARM_DEG = 6; // must leave this envelope before re-locking

// Signed shortest circular delta from `from` to `to` (-180..180).
export function signedDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

export function createLockMachine(now = () => Date.now()) {
  return {
    locked: false,
    armed: true,
    consecutive: 0,
    lockUntil: 0,
    // Returns the next state given the current beam screen angle.
    // Pure with respect to inputs (mutates only this machine object).
    tick(screenAngle) {
      const align = signedDelta(screenAngle, 0);
      if (this.locked) {
        if (Math.abs(align) > RELEASE_DEG || now() >= this.lockUntil) {
          this.locked = false;
          this.armed = false; // re-arm only after leaving REARM_DEG
          this.consecutive = 0;
        }
        return this.locked;
      }
      if (Math.abs(align) <= ALIGN_TOL_DEG) {
        this.consecutive += 1;
        if (this.armed && this.consecutive >= LOCK_CONSECUTIVE_TICKS) {
          this.locked = true;
          this.lockUntil = now() + LOCK_HOLD_MS;
          this.consecutive = 0;
        }
      } else {
        this.consecutive = 0;
        if (!this.armed && Math.abs(align) > REARM_DEG) {
          this.armed = true;
        }
      }
      return this.locked;
    },
  };
}
