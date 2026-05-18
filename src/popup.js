const fields = [
  "enabled",
  "kufarEnabled",
  "showAsterisk",
  "useCompactRounding"
];

const rateElement = document.getElementById("rate");
const refreshButton = document.getElementById("refreshRate");

init();

async function init() {
  const settings = await sendMessage({ type: "GET_SETTINGS" });
  if (settings.ok) {
    for (const field of fields) {
      document.getElementById(field).checked = Boolean(settings.settings[field]);
    }
  }

  for (const field of fields) {
    document.getElementById(field).addEventListener("change", saveSettings);
  }

  refreshButton.addEventListener("click", () => loadRate(true));
  loadRate(false);
}

async function saveSettings() {
  const settings = {};
  for (const field of fields) {
    settings[field] = document.getElementById(field).checked;
  }

  await sendMessage({ type: "SAVE_SETTINGS", settings });
}

async function loadRate(forceRefresh) {
  refreshButton.disabled = true;
  try {
    const response = await sendMessage({ type: "GET_RATE", forceRefresh });
    if (!response.ok) {
      throw new Error(response.error);
    }
    rateElement.textContent = `1 USD = ${response.rate} BYN`;
  } catch (error) {
    rateElement.textContent = "Курс недоступен";
  } finally {
    refreshButton.disabled = false;
  }
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}
