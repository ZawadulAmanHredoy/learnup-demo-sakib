/**
 * LocalStorage session persistence (ADR-006, Tracker REL-02).
 * The server-issued UUID v4 lives under `sessionToken`; room/team metadata
 * sits alongside it so a refresh can rejoin without re-typing anything.
 */

const TOKEN_KEY = 'sessionToken';
const META_KEY = 'learnup_player_session';
const SOUND_KEY = 'learnup_sound_muted';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function loadSession() {
  return safe(() => {
    const sessionToken = localStorage.getItem(TOKEN_KEY);
    const meta = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (!sessionToken || !meta?.pin) return null;
    return { ...meta, sessionToken };
  });
}

export function saveSession({ pin, sessionToken, participantId, teamName, institution }) {
  safe(() => {
    localStorage.setItem(TOKEN_KEY, sessionToken);
    localStorage.setItem(META_KEY, JSON.stringify({ pin, participantId, teamName, institution }));
  });
}

export function clearSession() {
  safe(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(META_KEY);
  });
}

export function loadSoundMuted() {
  return safe(() => localStorage.getItem(SOUND_KEY) === '1', false);
}

export function saveSoundMuted(muted) {
  safe(() => localStorage.setItem(SOUND_KEY, muted ? '1' : '0'));
}
