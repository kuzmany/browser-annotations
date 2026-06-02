// browser-annotations — the toolbar button (and Alt+Shift+A) toggles the annotation
// overlay on/off for the current tab; Alt+Shift+C copies all notes as markdown.
//
// Per-tab on/off state lives in chrome.storage.session (survives the service worker
// going idle). Toggling off calls the overlay's destroy(); pins persist in
// localStorage, so they reappear when you toggle back on. A page reload/navigation
// resets the state so the next toggle injects a fresh overlay.
//
// activeTab + scripting → the click/shortcut itself grants one-tab injection rights,
// so no broad host permissions are needed.

function badge(tabId, on) {
  chrome.action.setBadgeText({ tabId, text: on ? "●" : "" });
  if (on) chrome.action.setBadgeBackgroundColor({ tabId, color: "#FF5A36" });
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
  badge(tabId, true);
}
async function disable(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => { try { window.__bhAnno && window.__bhAnno.destroy && window.__bhAnno.destroy(); } catch (e) {} },
  });
  await setState(tabId, false);
  badge(tabId, false);
}

// toolbar click  /  Alt+Shift+A (via "_execute_action") → toggle on/off
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  const on = (await stateMap())[tab.id];
  try { on ? await disable(tab.id) : await enable(tab.id); } catch (e) { /* chrome://, store, etc. */ }
});

// Alt+Shift+C → copy all notes as markdown (uses the overlay's public markdown())
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== "copy-annotations" || !tab || tab.id == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          if (!window.__bhAnno) return;
          var md = window.__bhAnno.markdown();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md).catch(function () {});
          } else {
            var ta = document.createElement("textarea");
            ta.value = md; ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
            document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
          }
        } catch (e) {}
      },
    });
  } catch (e) {}
});

// reset state on reload/navigation and tab close → next toggle injects fresh
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") { setState(tabId, false); badge(tabId, false); }
});
chrome.tabs.onRemoved.addListener((tabId) => { setState(tabId, false); });
