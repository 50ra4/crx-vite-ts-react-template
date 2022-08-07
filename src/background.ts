chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  console.log('listen message');
  sendResponse({ message: 'listen message', request });
});

export {};
