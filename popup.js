const enable = document.getElementById("enable");
const enabledLabel = document.getElementById("enabled-label");

function refreshEnableCheck() {
    const enabled = enable.checked;
    enabledLabel.innerText = enabled ? "Activé" : "Désactivé";
    return enabled;
}

// When the button is clicked, inject setPageBackgroundColor into current page
enable.addEventListener("click", async (e) => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const enabled = refreshEnableCheck();

    chrome.storage.sync.set({ enabled });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: toggleActivation,
    });
});

// The body of this function will be executed as a content script inside the
// current page
function toggleActivation() {
    chrome.storage.sync.get("enabled", ({ enabled }) => {
        solverEnabled = enabled;
    });
}

chrome.storage.sync.get("enabled", ({ enabled }) => {
    enable.checked = enabled;
    refreshEnableCheck();
});
