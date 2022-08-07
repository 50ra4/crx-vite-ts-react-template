chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  console.log('listen message', request);
  sendResponse({ message: 'send response from background', request });
});

export {};
