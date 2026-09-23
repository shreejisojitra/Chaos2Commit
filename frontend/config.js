/**
 * Frontend config — auto-detects API base URL
 * Works whether served from /builder/ or opened directly
 */
(function() {
  // If served from the backend (/builder/...), same origin works
  // If opened as file://, point to the backend explicitly
  const isFile = location.protocol === 'file:';
  const isBuilder = location.pathname.includes('/builder/');
  
  window.ASB_API = isFile ? 'http://127.0.0.1:3847' : (isBuilder ? '' : 'http://127.0.0.1:3847');
  window.ASB_VERSION = '2.0.0';
})();
