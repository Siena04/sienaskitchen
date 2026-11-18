/*
 * Siena's Kitchen advertising switch
 *
 * Leave enabled as false until AdSense has approved your live site and you have
 * enabled its Google-certified consent message for EEA, UK and Swiss visitors.
 * Your bank, tax and identity details stay in your AdSense account — never put
 * them in this file or anywhere on the website.
 */
const AD_CONFIG = Object.freeze({
  // Set to true during AdSense's site review after you have added your publisher ID.
  // This loads Google's site-connection script but does not show either ad rail.
  connectSiteForReview: false,
  enabled: false,
  publisherId: "", // Example: ca-pub-1234567890123456
  slots: {
    leftRail: "", // Ad unit ID from AdSense (digits only)
    rightRail: "", // Ad unit ID from AdSense (digits only)
  },
});

function isValidPublisherId(value) {
  return /^ca-pub-\d{10,}$/.test(String(value || "").trim());
}

function isValidSlotId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function addAdScript(publisherId) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  script.crossOrigin = "anonymous";
  document.head.append(script);
}

function mountAd(rail, slotId) {
  const unit = document.createElement("ins");
  unit.className = "adsbygoogle";
  unit.style.display = "block";
  unit.dataset.adClient = AD_CONFIG.publisherId;
  unit.dataset.adSlot = slotId;
  unit.dataset.adFormat = "auto";
  unit.dataset.fullWidthResponsive = "false";
  rail.append(unit);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (error) {
    // Ad blockers can prevent ads from loading; the rest of the site still works.
    console.warn("Unable to load advertising unit.", error);
  }
}

function initialiseAdvertising() {
  const { connectSiteForReview, enabled, publisherId, slots } = AD_CONFIG;
  if (!isValidPublisherId(publisherId) || (!connectSiteForReview && !enabled)) {
    return;
  }

  addAdScript(publisherId);
  if (!enabled) {
    return;
  }

  const rails = Array.from(document.querySelectorAll("[data-ad-rail]"));
  const validRails = rails.filter((rail) => isValidSlotId(slots[rail.dataset.adRail]));
  if (!validRails.length) {
    return;
  }

  document.body.classList.add("ads-enabled");
  validRails.forEach((rail) => mountAd(rail, slots[rail.dataset.adRail]));
}

document.addEventListener("DOMContentLoaded", initialiseAdvertising);
