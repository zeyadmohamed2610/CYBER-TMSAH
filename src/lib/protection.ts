// Protection Script - Basic deterrents only
// Note: This won't stop determined developers, just casual users

(function() {
  'use strict';
  
  // Only in production
  if (import.meta.env.DEV) return;
  
  // Disable console in production
  const disableConsole = () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug', 'table', 'trace'];
    methods.forEach(method => {
      (console as any)[method] = () => {};
    });
  };
  
  // Anti-right-click (context menu)
  const preventContextMenu = () => {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    }, true);
  };
  
  // Anti-F12, Ctrl+Shift+I, Ctrl+U
  const preventDevToolsKeys = () => {
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
    }, true);
  };
  
  // Detect DevTools opening
  const detectDevTools = () => {
    let devtoolsOpen = false;
    
    const check = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          // Redirect or show warning
          console.clear();
          document.body.innerHTML = '<div style="text-align:center;padding:50px;font-family:system-ui;"><h1>Access Denied</h1><p>Developer tools are not allowed.</p></div>';
        }
      } else {
        devtoolsOpen = false;
      }
    };
    
    setInterval(check, 1000);
  };
  
  // Disable text selection
  const disableTextSelection = () => {
    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    }, true);
  };
  
  // Disable drag and drop
  const disableDragDrop = () => {
    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    }, true);
  };
  
  // Initialize protections
  window.addEventListener('load', () => {
    disableConsole();
    preventContextMenu();
    preventDevToolsKeys();
    detectDevTools();
    disableTextSelection();
    disableDragDrop();
    console.clear();
  });
  
})();

export {};
