// browser-annotations — toolbar click injects the annotation overlay into the
// active tab. The overlay (bh-annotate.js) is the same one the skill/CLI use:
// hover → click → note → Save, then its Copy button puts every note on the
// clipboard as markdown to paste into your AI coding agent.
//
// Uses activeTab + scripting: the click itself grants one-tab injection rights,
// so the extension needs no broad host permissions. Idempotent — re-clicking a
// page that already has the overlay just re-shows it (the overlay dedupes).

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bh-annotate.js"],
    });
    chrome.action.setBadgeText({ tabId: tab.id, text: "●" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#FF5A36" });
  } catch (e) {
    // chrome://, the Web Store, PDF viewer, etc. can't be injected — ignore.
  }
});
