'use strict';

// Keeping the app on its hosted GitHub Pages origin also keeps Cloudflare CORS,
// login sessions, and localStorage behavior consistent with the web application.
const APP_URL = 'https://rjimsbanzon-netizen.github.io/Procurement-System/';
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_PATH = new URL(APP_URL).pathname;

function isAppUrl(candidate) {
  try {
    const target = new URL(candidate);
    return target.protocol === 'https:' &&
      target.origin === APP_ORIGIN &&
      !target.username && !target.password &&
      (target.pathname === APP_PATH.slice(0, -1) || target.pathname.startsWith(APP_PATH));
  } catch {
    return false;
  }
}

function isExternalUrl(candidate) {
  try {
    const target = new URL(candidate);
    return target.protocol === 'https:' && !target.username && !target.password && !isAppUrl(candidate);
  } catch {
    return false;
  }
}

module.exports = { APP_URL, isAppUrl, isExternalUrl };
