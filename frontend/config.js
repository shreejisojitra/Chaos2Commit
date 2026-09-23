/**
 * Frontend configuration
 * When served via /builder/* (same origin as backend), API_BASE = ''
 * For standalone dev (open file directly), set API_BASE to backend URL.
 */
window.ASB_CONFIG = {
  API_BASE: '',  // Empty = same origin (correct when served via /builder/)
  VERSION: '2.0.0',
};
