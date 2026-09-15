/**
 * Shared with ControlChime (the five-minute countdown alert) and the mute
 * button's own unmute confirmation, so both paths play the exact same file
 * the same way rather than each rolling their own Audio() call.
 */
const CHIME_URL = "/sounds/airplane-chime.wav";

/**
 * Plays the Neste kontroll chime. A fresh Audio instance per call (rather
 * than one shared/reused element) so an overlapping UT/INN chime, or a
 * manual test play from the mute button, never has to fight over one
 * playback position.
 */
export function playChime() {
  try {
    void new Audio(CHIME_URL).play().catch(() => {
      // Browsers block audio.play() unless it happens synchronously inside
      // a real user gesture (a click handler, not a useEffect that merely
      // runs *because of* one) — nothing useful to do about that here.
    });
  } catch {
    // A missing/broken audio element should never break the board.
  }
}
