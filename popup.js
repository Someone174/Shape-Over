const button = document.querySelector('#edit-button');
const siteName = document.querySelector('#site-name');
const maskCount = document.querySelector('#mask-count');
const dot = document.querySelector('#status-dot');
const message = document.querySelector('#message');
let tabId;
let siteKey;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  try {
    const url = new URL(tab?.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported');
    siteKey = `shapeover:${url.origin}`;
    siteName.textContent = url.hostname.replace(/^www\./, '');
    const stored = await chrome.storage.local.get(siteKey);
    const shapes = stored[siteKey]?.shapes || [];
    maskCount.textContent = shapes.length ? `${shapes.length} cover${shapes.length === 1 ? '' : 's'} on this site` : 'No covers yet';
    dot.classList.toggle('on', shapes.length > 0);
  } catch {
    siteName.textContent = 'Open a website first';
    maskCount.textContent = 'Works on regular web pages';
    button.disabled = true;
    button.title = 'Open an http or https page to get started';
    button.style.opacity = '.55';
  }
}

button.addEventListener('click', async () => {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHAPEOVER_OPEN' });
    window.close();
  } catch {
    message.textContent = 'Refresh this page, then try again.';
  }
});
button.addEventListener('keydown', event => { if (event.key === 'Enter') button.click(); });
init();
