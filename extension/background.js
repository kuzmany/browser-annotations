// browser-annotations — the toolbar button (and Alt+Shift+A) toggles the annotation
// overlay on/off for the current tab; Alt+Shift+C copies notes as markdown, Alt+Shift+J
// as JSON. Per-tab on/off state lives in chrome.storage.session.
//
// activeTab + scripting → the click/shortcut itself grants one-tab injection rights,
// so no broad host permissions. If a page can't be injected (chrome://, the Web Store,
// PDF viewer, view-source:), a red "!" badge + title say so instead of failing silently.

const DEFAULT_TITLE = "Toggle annotations (browser-annotations) — Alt+Shift+A";

function badge(tabId, text, color) {
  chrome.action.setBadgeText({ tabId, text: text || "" });
  if (text) chrome.action.setBadgeBackgroundColor({ tabId, color: color || "#10A37F" });
}
function setTitle(tabId, t) {
  chrome.action.setTitle({ tabId, title: t || DEFAULT_TITLE });
}

async function stateMap() {
  return (await chrome.storage.session.get("on")).on || {};
}
async function setState(tabId, on) {
  const m = await stateMap();
  if (on) m[tabId] = true; else delete m[tabId];
  await chrome.storage.session.set({ on: m });
}

async function enable(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["bh-annotate.js"] });
  await setState(tabId, true);
  badge(tabId, "●", "#10A37F"); setTitle(tabId);
}
async function disable(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => { try { window.__bhAnno && window.__bhAnno.destroy && window.__bhAnno.destroy(); } catch (e) {} },
  });
  await setState(tabId, false);
  badge(tabId, ""); setTitle(tabId);
}

// Run an overlay public method in the page (Alt+Shift+C / Alt+Shift+J). The injected
// function can only reach window.__bhAnno (the public API), not the overlay's closures.
function callOverlay(tabId, method) {
  return chrome.scripting.executeScript({
    target: { tabId },
    args: [method],
    func: (m) => { try { const a = window.__bhAnno; if (a && a[m]) a[m](); } catch (e) {} },
  });
}

// toolbar click / Alt+Shift+A (via "_execute_action") → toggle on/off
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  const on = (await stateMap())[tab.id];
  try {
    if (on) await disable(tab.id); else await enable(tab.id);
  } catch (e) {
    // chrome://, Web Store, PDF, view-source: — can't inject. Say so, don't fail silently.
    badge(tab.id, "!", "#B00020");
    setTitle(tab.id, "Can't annotate this page (chrome:// / Web Store / PDF / view-source)");
  }
});

// Alt+Shift+C → copy markdown · Alt+Shift+J → copy JSON (both via the overlay's flash)
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (!tab || tab.id == null) return;
  try {
    if (cmd === "copy-annotations") await callOverlay(tab.id, "copy");
    else if (cmd === "copy-annotations-json") await callOverlay(tab.id, "copyJson");
  } catch (e) {}
});

// reset state on reload/navigation and tab close → next toggle injects fresh
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") { setState(tabId, false); badge(tabId, ""); setTitle(tabId); }
});
chrome.tabs.onRemoved.addListener((tabId) => { setState(tabId, false); });
