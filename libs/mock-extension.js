/**
 * mock-extension.js
 * Provides a fake 'chrome' object for previewing extension UIs in a standard browser.
 */

if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.log('FocusTab: Running in Preview Mode (Mock APIs active)');

  const mockStorage = {
    local: JSON.parse(localStorage.getItem('focustab_mock_storage_local') || '{}'),
    session: {}
  };

  window.chrome = {
    runtime: {
      sendMessage: (message, callback) => {
        console.log('[Mock chrome.runtime.sendMessage]', message);
        
        let response = { success: true };
        
        if (message.type === 'START_FOCUS') {
          // Store session in mock session storage
          mockStorage.session.session = {
            ...message.payload,
            startTime: Date.now(),
            attempts: {}
          };
        } else if (message.type === 'GET_SESSION') {
          response = mockStorage.session.session || null;
        } else if (message.type === 'END_FOCUS') {
          mockStorage.session.session = null;
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
          let result = {};
          if (Array.isArray(keys)) {
            keys.forEach(k => result[k] = mockStorage.local[k]);
          } else if (typeof keys === 'string') {
            result[keys] = mockStorage.local[keys];
          } else {
            result = mockStorage.local;
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          Object.assign(mockStorage.local, items);
          localStorage.setItem('focustab_mock_storage_local', JSON.stringify(mockStorage.local));
          if (callback) callback();
          return Promise.resolve();
        }
      },
      session: {
        get: (keys, callback) => {
          let result = {};
          if (Array.isArray(keys)) {
            keys.forEach(k => result[k] = mockStorage.session[k]);
          } else if (typeof keys === 'string') {
            result[keys] = mockStorage.session[keys];
          } else {
            result = mockStorage.session;
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          Object.assign(mockStorage.session, items);
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
