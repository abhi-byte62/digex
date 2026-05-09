/**
 * mock-extension.js
 * Provides a fake 'chrome' object for previewing extension UIs in a standard browser.
 */

if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.log('FocusTab: Running in Preview Mode (Mock APIs active)');

  window.chrome = {
    runtime: {
      sendMessage: (message, callback) => {
        console.log('[Mock chrome.runtime.sendMessage]', message);
        
        let response = { success: true };
        
        if (message.type === 'GET_SESSION') {
          response = null; // No session active by default in preview
        }
        
        if (callback) {
          setTimeout(() => callback(response), 10);
        }
        return Promise.resolve(response);
      },
      onMessage: {
        addListener: () => {}
      }
    },
    storage: {
      local: {
        get: (keys, callback) => {
          const data = JSON.parse(localStorage.getItem('focustab_mock_storage') || '{}');
          let result = {};
          if (Array.isArray(keys)) {
            keys.forEach(k => result[k] = data[k]);
          } else if (typeof keys === 'string') {
            result[keys] = data[keys];
          } else {
            result = data;
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          const data = JSON.parse(localStorage.getItem('focustab_mock_storage') || '{}');
          Object.assign(data, items);
          localStorage.setItem('focustab_mock_storage', JSON.stringify(data));
          if (callback) callback();
          return Promise.resolve();
        }
      }
    },
    tabs: {
      create: (params) => {
        console.log('[Mock chrome.tabs.create]', params);
        window.open(params.url, '_blank');
      },
      query: (params, callback) => {
        if (callback) callback([{ id: 1, url: window.location.href }]);
      }
    },
    alarms: {
      create: () => {},
      clear: () => {}
    }
  };
}
