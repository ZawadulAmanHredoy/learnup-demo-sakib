/**
 * Backend origin for REST + Socket.IO.
 *
 * Phones join over the venue Wi-Fi, so `localhost` would point at the phone
 * itself. Default to the host that served the page (port 5000), and allow an
 * explicit override with VITE_SERVER_URL for deployments behind a proxy.
 */
const envUrl = import.meta.env.VITE_SERVER_URL;

export const SERVER_URL = envUrl
  ? envUrl.replace(/\/$/, '')
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export const API_BASE = `${SERVER_URL}/api`;
