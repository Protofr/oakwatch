// ===================================================
// PART 1: SCREEN SWITCHING
// ===================================================

// Hide every screen, then show the one with the given id.
function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach(function (screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  // Jump back to the top so the new screen starts at its beginning
  window.scrollTo(0, 0);

  // Refresh the risk info every time someone opens the prune screen
  if (screenId === "prune-check") {
    showPruneRisk();
  }

  // Set up the map the first time someone opens the map screen
  if (screenId === "neighborhood-map") {
    showNeighborhoodMap();
  }
}

// Find every button that has a data-target and make it open that screen.
const navButtons = document.querySelectorAll("[data-target]");
navButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showScreen(button.dataset.target);
  });
});


// ===================================================
// PART 2: SAFE TO PRUNE?
// ===================================================

// Returns "high" or "low" for the given date.
// High risk: February 1 through June 30. Low risk: July 1 through January 31.
function getPruneRisk(date) {
  const month = date.getMonth(); // 0 = January, 1 = February, ... 11 = December

  if (month >= 1 && month <= 5) {  // February (1) through June (5)
    return "high";
  }
  return "low";
}

// Returns how many days until the risk level switches.
function getDaysUntilRiskChange(date) {
  // Use midnight so the time of day doesn't throw off the count
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const year = today.getFullYear();
  let nextChange;

  if (getPruneRisk(today) === "high") {
    // High season ends on July 1 this year
    nextChange = new Date(year, 6, 1);
  } else if (today.getMonth() === 0) {
    // It's January, so high season starts February 1 this year
    nextChange = new Date(year, 1, 1);
  } else {
    // It's July–December, so high season starts February 1 next year
    nextChange = new Date(year + 1, 1, 1);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  // Math.round handles the odd 23- or 25-hour day from daylight saving time
  return Math.round((nextChange - today) / msPerDay);
}

// Turns a number like 1 into "1 day" and 5 into "5 days"
function pluralDays(count) {
  return count === 1 ? "1 day" : count + " days";
}

// Builds the risk card and puts it on the page.
function showPruneRisk() {
  const today = new Date();
  const risk = getPruneRisk(today);
  const daysLeft = getDaysUntilRiskChange(today);

  // Example: "Sunday, October 18, 2026"
  const dateText = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  document.getElementById("today-date").textContent = "Today is " + dateText + ".";

  const card = document.getElementById("risk-card");

  if (risk === "high") {
    card.innerHTML =
      '<div class="risk-card risk-high" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">⚠️</span> High risk: Avoid pruning or wounding oaks right now.</h3>' +
        "<p>In spring, sap beetles that spread the oak wilt fungus are most active. " +
        "They are attracted to fresh cuts and wounds on oak trees.</p>" +
        '<p class="countdown">Lower-risk season starts in ' + pluralDays(daysLeft) + ".</p>" +
        '<p class="paint-reminder">If a tree is wounded by accident (storm damage, mower, etc.), ' +
        "paint the wound immediately. Any paint works.</p>" +
      "</div>";
  } else {
    card.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> Lower risk: Best time to prune oaks.</h3>' +
        '<p class="paint-reminder">🖌️ Paint every pruning cut and wound immediately. Any paint works.</p>' +
        '<p class="countdown">High-risk season starts in ' + pluralDays(daysLeft) + ".</p>" +
      "</div>";
  }
}


// ===================================================
// TESTS
// Open the browser console and type:  runPruneTests()
// ===================================================
function runPruneTests() {
  // Reminder: JavaScript months start at 0, so new Date(2026, 1, 1) is FEBRUARY 1.
  const tests = [
    { label: "Feb 1",  date: new Date(2026, 1, 1),  expected: "high" },
    { label: "Jun 30", date: new Date(2026, 5, 30), expected: "high" },
    { label: "Jul 1",  date: new Date(2026, 6, 1),  expected: "low" },
    { label: "Jan 31", date: new Date(2026, 0, 31), expected: "low" }
  ];

  tests.forEach(function (test) {
    const result = getPruneRisk(test.date);
    const passed = result === test.expected;
    console.log(
      (passed ? "PASS" : "FAIL") + "  " + test.label +
      " → got " + result + ", expected " + test.expected +
      " (risk changes in " + pluralDays(getDaysUntilRiskChange(test.date)) + ")"
    );
  });
}


// ===================================================
// PART 3: NEIGHBORHOOD MAP
// ===================================================

// ----- Firebase setup -----
// Paste the config from your Firebase project here (see the setup steps).
// This is NOT a secret password. It just tells Firebase which project to talk to.
// Your security rules are what keep the data safe.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXKQwrxDhup_fZokS6VwBLrQBh5wdm1vc",
  authDomain: "oakwatch-b03d1.firebaseapp.com",
  projectId: "oakwatch-b03d1",
  storageBucket: "oakwatch-b03d1.firebasestorage.app",
  messagingSenderId: "633740803152",
  appId: "1:633740803152:web:5a505ffcc3f1710968e555"
};

// Only connect to Firebase if the config has been filled in
let db = null;
if (FIREBASE_CONFIG.apiKey.startsWith("PASTE")) {
  console.log("Firebase not configured");
} else {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();

  // Connection check: ask the server for just 1 report. If that works, we're really connected.
  db.collection("reports").limit(1).get()
    .then(function () {
      console.log("Firebase connected");
    })
    .catch(function (error) {
      console.error("Firebase is configured, but the connection failed:", error.message);
    });
}

// These limits MUST match the lat/lng limits in your Firestore security rules.
// We check them here too, so people get a clear message instead of a confusing save error.
const REPORT_AREA = { minLat: 29.5, maxLat: 31, minLng: -98.5, maxLng: -97 };

function isInReportArea(lat, lng) {
  return lat > REPORT_AREA.minLat && lat < REPORT_AREA.maxLat &&
         lng > REPORT_AREA.minLng && lng < REPORT_AREA.maxLng;
}

// ----- Map settings -----
const MAP_CENTER = [30.19, -97.88]; // Circle C area, Southwest Austin
const MAP_ZOOM = 14;

let map = null;          // the Leaflet map (created the first time the screen opens)
let reportMarkers = [];  // markers for every saved report
let allReports = [];     // the report data itself, used by "Check near me"
let reportsLoaded = false; // becomes true once the first list arrives from Firestore
let draftMarker = null;  // the green pin while someone fills out the form
let chosenLocation = null; // { lat, lng } picked for the new report

// Called every time the map screen is shown
function showNeighborhoodMap() {
  if (map === null) {
    createMap();
    loadReports();
  } else {
    // Leaflet measures its box when it's created. If the screen was hidden and
    // shown again, this tells Leaflet to measure again so the map isn't cut off.
    map.invalidateSize();
  }
}

function createMap() {
  // L is Leaflet. This draws a map inside <div id="map">.
  map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);

  // The map picture is made of small square images called "tiles" from OpenStreetMap.
  // OpenStreetMap requires us to credit them (the "attribution").
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Tapping the map while the form is open places the report pin there
  map.on("click", function (event) {
    if (!reportForm.hidden) {
      setChosenLocation(event.latlng.lat, event.latlng.lng);
    }
  });

  // Update the count whenever the person moves or zooms the map
  map.on("moveend", updateReportCount);
}

// Makes a round marker icon. type is "suspected", "confirmed", or "draft".
function makePinIcon(type) {
  const symbols = { suspected: "?", confirmed: "!", draft: "+" };
  return L.divIcon({
    className: "report-marker",
    html: '<span class="report-pin pin-' + type + '">' + symbols[type] + "</span>",
    iconSize: [32, 32],
    iconAnchor: [16, 16],   // the center of the circle sits on the location
    popupAnchor: [0, -16]   // popups open just above the circle
  });
}

// ----- Reading reports from Firestore -----
function loadReports() {
  if (db === null) {
    document.getElementById("report-count").textContent =
      "Reports aren't connected yet. Add your Firebase config to app.js.";
    return;
  }

  // onSnapshot runs now AND again every time anyone adds a report,
  // so the map updates live without refreshing the page.
  db.collection("reports").onSnapshot(
    function (snapshot) {
      // Remove the old markers, then draw the fresh list
      reportMarkers.forEach(function (marker) {
        marker.remove();
      });
      reportMarkers = [];
      allReports = [];

      snapshot.forEach(function (doc) {
        // "estimate" fills in a time for brand-new reports the server hasn't stamped yet
        const report = doc.data({ serverTimestamps: "estimate" });
        allReports.push(report);
        addReportMarker(report);
      });

      reportsLoaded = true;
      updateReportCount();
    },
    function (error) {
      console.error("Could not load reports:", error);
      document.getElementById("report-count").textContent =
        "Sorry, we couldn't load reports right now. Please try again later.";
    }
  );
}

function addReportMarker(report) {
  const type = report.status === "confirmed" ? "confirmed" : "suspected";
  const marker = L.marker([report.lat, report.lng], { icon: makePinIcon(type) });
  marker.bindPopup(buildPopupHtml(report));
  marker.addTo(map);
  reportMarkers.push(marker);
}

function buildPopupHtml(report) {
  // escapeHtml stops anyone from sneaking code into the page through the note box
  const statusText = report.status === "confirmed" ? "Confirmed by an arborist" : "Suspected";
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [];

  let html = '<h3 class="popup-title">' + escapeHtml(report.treeType) + "</h3>";
  html += "<p><strong>Status:</strong> " + statusText + "</p>";
  html += "<p><strong>Signs seen:</strong></p><ul>";
  symptoms.forEach(function (symptom) {
    html += "<li>" + escapeHtml(symptom) + "</li>";
  });
  html += "</ul>";
  if (report.note) {
    html += "<p><strong>Note:</strong> " + escapeHtml(report.note) + "</p>";
  }
  if (report.createdAt) {
    html += "<p><em>Reported " + timeAgo(report.createdAt.toDate()) + "</em></p>";
  }
  return html;
}

// Counts the reports inside the part of the map you can currently see
function updateReportCount() {
  if (map === null || db === null) {
    return;
  }
  const visibleArea = map.getBounds();
  let count = 0;
  reportMarkers.forEach(function (marker) {
    if (visibleArea.contains(marker.getLatLng())) {
      count = count + 1;
    }
  });
  const word = count === 1 ? "tree" : "trees";
  document.getElementById("report-count").textContent =
    count + " " + word + " reported in this area.";
}

// Turns a date into friendly text like "3 days ago"
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
  if (days < 365) return months + (months === 1 ? " month ago" : " months ago");
  return years + (years === 1 ? " year ago" : " years ago");
}

// Replaces special characters so text is shown as text, never run as code
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ----- The report form -----
const reportForm = document.getElementById("report-form");
const formError = document.getElementById("form-error");
const mapMessage = document.getElementById("map-message");
const noteBox = document.getElementById("note");
const submitButton = document.getElementById("submit-report-button");

// Show the form. (Also used by Symptom Check's "Report this tree" button.)
function openReportForm() {
  mapMessage.hidden = true;
  reportForm.hidden = false;
  reportForm.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("open-report-button").addEventListener("click", openReportForm);

document.getElementById("cancel-report-button").addEventListener("click", closeReportForm);

// Live character counter for the note
function updateNoteCounter() {
  document.getElementById("note-counter").textContent = noteBox.value.length + " / 200";
}

noteBox.addEventListener("input", updateNoteCounter);

// PRIVACY: We round to 3 decimal places before saving. Each 0.001 degree is roughly
// 100 meters, so the pin lands somewhere on the block, not on a specific house.
// Rounding happens BEFORE saving, so the exact location is never stored anywhere.
function roundForPrivacy(number) {
  return Math.round(number * 1000) / 1000;
}

function setChosenLocation(lat, lng) {
  chosenLocation = { lat: roundForPrivacy(lat), lng: roundForPrivacy(lng) };

  // Show the green pin at the ROUNDED spot, so people see exactly what will be shared
  if (draftMarker === null) {
    draftMarker = L.marker([chosenLocation.lat, chosenLocation.lng], { icon: makePinIcon("draft") }).addTo(map);
  } else {
    draftMarker.setLatLng([chosenLocation.lat, chosenLocation.lng]);
  }

  document.getElementById("location-status").textContent =
    "✓ Location set (approximate). Tap the map again to move it.";
}

document.getElementById("use-location-button").addEventListener("click", function () {
  const status = document.getElementById("location-status");

  if (!("geolocation" in navigator)) {
    status.textContent = "Your browser can't share location. Please tap the map instead.";
    return;
  }

  status.textContent = "Finding your location…";

  navigator.geolocation.getCurrentPosition(
    // Success
    function (position) {
      setChosenLocation(position.coords.latitude, position.coords.longitude);
      map.setView([chosenLocation.lat, chosenLocation.lng], 16);
    },
    // Failure: explain what happened in plain words
    function (error) {
      if (error.code === error.PERMISSION_DENIED) {
        status.textContent =
          "Location permission was turned off. No problem! Just tap the map where the tree is.";
      } else {
        status.textContent =
          "We couldn't find your location. Please tap the map where the tree is.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

reportForm.addEventListener("submit", function (event) {
  // Stop the browser from reloading the page (the normal form behavior)
  event.preventDefault();

  const treeTypeInput = reportForm.querySelector('input[name="treeType"]:checked');
  const statusInput = reportForm.querySelector('input[name="status"]:checked');
  const symptomInputs = reportForm.querySelectorAll('input[name="symptoms"]:checked');

  // Turn the checked boxes into a list of their text, like ["Sudden leaf drop"]
  const symptoms = [];
  symptomInputs.forEach(function (input) {
    symptoms.push(input.value);
  });

  // Validation: collect every problem so we can show them all at once
  const problems = [];
  if (treeTypeInput === null) problems.push("Please choose a tree type.");
  if (symptoms.length === 0) problems.push("Please check at least one thing you see.");
  if (chosenLocation === null) {
    problems.push("Please tap \"Use my location\" or tap the map to place a pin.");
  } else if (!isInReportArea(chosenLocation.lat, chosenLocation.lng)) {
    // The security rules would reject this, so explain it before trying
    problems.push("OakWatch only accepts reports in the Austin area. Please place the pin closer to Austin.");
  }

  if (problems.length > 0) {
    showFormError(problems.join(" "));
    return;
  }

  if (db === null) {
    showFormError("Reports aren't connected yet. Add your Firebase config to app.js.");
    return;
  }

  formError.hidden = true;
  submitButton.disabled = true;   // stops double-taps from saving twice
  submitButton.textContent = "Saving…";

  // Only these fields are saved. No names, emails, or addresses.
  const newReport = {
    treeType: treeTypeInput.value,
    symptoms: symptoms,
    status: statusInput.value,
    note: noteBox.value.trim().slice(0, 200),
    lat: chosenLocation.lat,
    lng: chosenLocation.lng,
    // The server fills in the real time, so a wrong phone clock can't affect it
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("reports").add(newReport)
    .then(function () {
      closeReportForm();
      showMapMessage("Thank you! Your report was added to the map.");
    })
    .catch(function (error) {
      console.error("Could not save report:", error);
      if (error.code === "permission-denied") {
        // The security rules said no. This usually means the rules and this code don't match.
        showFormError("Sorry, your report didn't pass our safety checks, so it wasn't saved. Please check your answers and try again.");
      } else {
        showFormError("Sorry, your report couldn't be saved. Please check your internet connection and try again.");
      }
    })
    .finally(function () {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Report";
    });
});

function showFormError(text) {
  formError.textContent = text;
  formError.hidden = false;
}

function showMapMessage(text) {
  mapMessage.textContent = text;
  mapMessage.hidden = false;
  mapMessage.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Hide the form and clear everything so the next report starts fresh
function closeReportForm() {
  reportForm.reset();
  reportForm.hidden = true;
  formError.hidden = true;
  chosenLocation = null;
  updateNoteCounter();
  document.getElementById("location-status").textContent = "No location chosen yet.";
  if (draftMarker !== null) {
    draftMarker.remove();
    draftMarker = null;
  }
}


// ===================================================
// PART 4: CHECK NEAR ME
// ===================================================

const NEAR_ME_RADIUS = 500; // meters
let youMarker = null;       // the blue "you are about here" dot
let youCircle = null;       // the 500 m circle around it

// Returns the reports within radiusMeters of (lat, lng), closest first.
// Each item looks like: { report: { ...report data... }, meters: 312.4 }
// "reports" is optional. Tests pass in a fake list; normally we use the reports loaded from Firestore.
function findNearbyReports(lat, lng, radiusMeters, reports) {
  if (reports === undefined) {
    reports = allReports;
  }

  const here = L.latLng(lat, lng);
  const nearby = [];

  reports.forEach(function (report) {
    // distanceTo is the exact same math map.distance() uses: the real distance
    // across the curved Earth, in meters. Using it means this works even before the map exists.
    const meters = here.distanceTo(L.latLng(report.lat, report.lng));
    if (meters <= radiusMeters) {
      nearby.push({ report: report, meters: meters });
    }
  });

  // Sort so the smallest distance comes first
  nearby.sort(function (a, b) {
    return a.meters - b.meters;
  });
  return nearby;
}

// 312 → 300, 337 → 350. Report locations are already approximate, so exact meters would be misleading.
function roundToNearest50(meters) {
  return Math.round(meters / 50) * 50;
}

// Turns meters into friendly text like "about 300 m"
function describeDistance(meters) {
  const rounded = roundToNearest50(meters);
  if (rounded === 0) {
    return "less than 50 m";
  }
  return "about " + rounded + " m";
}

const nearMeResult = document.getElementById("near-me-result");

// Shows a plain message (like "Finding your location…") or a red error message
function showNearMeMessage(text, isError) {
  nearMeResult.innerHTML = "";
  const box = document.createElement("div");
  box.className = isError ? "message message-error" : "message";
  box.textContent = text;
  nearMeResult.appendChild(box);
}

// Builds the red warning card or the green "all clear" card
function showNearMeResult(nearby) {
  if (nearby.length > 0) {
    const closest = describeDistance(nearby[0].meters);
    let headline;
    if (nearby.length === 1) {
      headline = "1 reported tree " + closest + " from you.";
    } else {
      headline = nearby.length + " reported trees within " + NEAR_ME_RADIUS + " m of you. The closest is " + closest + " away.";
    }

    nearMeResult.innerHTML =
      '<div class="risk-card risk-high" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">⚠️</span> ' + headline + "</h3>" +
        "<p>Oak wilt can spread through connected roots. Consider having a qualified arborist check your oaks.</p>" +
        '<p><a href="https://texasoakwilt.org/getting-help/vendors" target="_blank" rel="noopener">Find an oak wilt specialist</a></p>' +
        '<p class="hint">Distances are approximate, because report locations are rounded for privacy.</p>' +
      "</div>";
  } else {
    nearMeResult.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> No reports within ' + NEAR_ME_RADIUS + " m of you.</h3>" +
        '<p class="paint-reminder">Keep an eye on your oaks and paint every pruning cut.</p>' +
      "</div>";
  }
}

// Draws the blue dot and the 500 m circle. lat/lng here are already ROUNDED.
function showYouDot(lat, lng) {
  if (youMarker !== null) {
    youMarker.remove();
    youCircle.remove();
  }

  // A light dashed circle showing the area we checked
  youCircle = L.circle([lat, lng], {
    radius: NEAR_ME_RADIUS,
    color: "#1a73e8",
    weight: 2,
    dashArray: "6 6",
    fillOpacity: 0.06
  }).addTo(map);

  youMarker = L.circleMarker([lat, lng], {
    radius: 10,
    color: "white",
    weight: 3,
    fillColor: "#1a73e8",
    fillOpacity: 1
  }).addTo(map);
  youMarker.bindPopup("You are about here (approximate). Your location is never saved.");

  // Zoom so the whole 500 m circle fits on screen
  map.fitBounds(youCircle.getBounds());
}

document.getElementById("near-me-button").addEventListener("click", function () {
  if (db === null) {
    showNearMeMessage("Reports aren't connected yet. Add your Firebase config to app.js.", true);
    return;
  }
  if (!reportsLoaded) {
    showNearMeMessage("Reports are still loading. Please try again in a moment.", true);
    return;
  }
  if (!("geolocation" in navigator)) {
    showNearMeMessage("Your browser can't share location, so we can't check near you.", true);
    return;
  }

  showNearMeMessage("Finding your location…", false);

  navigator.geolocation.getCurrentPosition(
    // Success
    function (position) {
      // PRIVACY: the exact location only lives inside this function, in memory.
      // We use it for the distance math, then it's gone. It's never saved, sent, or shown.
      const exactLat = position.coords.latitude;
      const exactLng = position.coords.longitude;

      const nearby = findNearbyReports(exactLat, exactLng, NEAR_ME_RADIUS);
      showNearMeResult(nearby);

      // Only the ROUNDED location (about 100 m) is drawn on the map
      showYouDot(roundForPrivacy(exactLat), roundForPrivacy(exactLng));
    },
    // Failure: explain what happened in plain words
    function (error) {
      if (error.code === error.PERMISSION_DENIED) {
        showNearMeMessage(
          "Location permission was turned off, so we can't check near you. You can still look at the map for reports on your street.",
          true
        );
      } else {
        showNearMeMessage(
          "We couldn't find your location. Please try again, or look at the map for reports on your street.",
          true
        );
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// Prints one test line, like "PASS  finds 2 reports within 500 m"
function printTestResult(passed, label) {
  console.log((passed ? "PASS" : "FAIL") + "  " + label);
}

// Open the browser console and type:  runNearbyTests()
function runNearbyTests() {
  // A test point in Circle C, plus fake reports at known distances.
  // 0.001 degrees of latitude is about 111 m.
  const home = { lat: 30.19, lng: -97.88 };
  const fakeReports = [
    { name: "C (about 1.1 km north)", lat: 30.2, lng: -97.88 },
    { name: "B (about 330 m south)", lat: 30.187, lng: -97.88 },
    { name: "A (about 110 m north)", lat: 30.191, lng: -97.88 }
  ];

  const result = findNearbyReports(home.lat, home.lng, 500, fakeReports);

  printTestResult(result.length === 2, "finds 2 reports within 500 m (got " + result.length + ")");
  printTestResult(result[0].report.name.startsWith("A"), "closest report comes first");
  printTestResult(describeDistance(result[0].meters) === "about 100 m",
    "A rounds to about 100 m (got " + describeDistance(result[0].meters) + ")");
  printTestResult(describeDistance(result[1].meters) === "about 350 m",
    "B rounds to about 350 m (got " + describeDistance(result[1].meters) + ")");
  printTestResult(findNearbyReports(home.lat, home.lng, 50, fakeReports).length === 0,
    "nothing within 50 m");
  printTestResult(findNearbyReports(home.lat, home.lng, 500, []).length === 0,
    "no reports at all gives an empty list");
  printTestResult(describeDistance(20) === "less than 50 m", "20 m shows as \"less than 50 m\"");
}


// ===================================================
// PART 5: SYMPTOM CHECK
// ===================================================

// ----- Teachable Machine settings -----
// Paste your model's link from Teachable Machine (Export Model → Upload → copy the link).
// It looks like "https://teachablemachine.withgoogle.com/models/abc123XYZ/".
// Leave it empty ("") to skip the AI photo check.
const TM_MODEL_URL = "";

// The class name you used for oak wilt photos when training. It must match exactly.
const TM_OAK_WILT_CLASS = "Oak wilt";

// How sure the model must be (0.6 = 60%) before the photo counts toward the result
const TM_MIN_CONFIDENCE = 0.6;

// Teachable Machine's library only works with this older TensorFlow.js version, so both are pinned
const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js";
const TM_IMAGE_URL = "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js";

const symptomForm = document.getElementById("symptom-form");
const photoInput = document.getElementById("symptom-photo");
const photoPreview = document.getElementById("photo-preview");
const photoResult = document.getElementById("photo-result");

let tmModel = null;      // the loaded AI model (loaded once, then reused)
let photoMatch = false;  // true if the model is fairly sure the photo looks like oak wilt
let lastAnswers = null;  // the most recent checklist answers, used to pre-fill the report form

// The 4 symptom questions, in order, with their question numbers
const SYMPTOM_QUESTIONS = [
  { key: "veins", number: 2 },
  { key: "edges", number: 3 },
  { key: "leafDrop", number: 4 },
  { key: "nearbyDied", number: 5 }
];

// answers looks like: { veins: "yes", edges: "no", leafDrop: "notsure", nearbyDied: "no", photoMatch: false }
// Returns "several", "some", or "none".
function scoreSymptoms(answers) {
  let yesCount = 0;
  SYMPTOM_QUESTIONS.forEach(function (question) {
    if (answers[question.key] === "yes") {
      yesCount = yesCount + 1;
    }
  });

  // A confident photo match counts like one more "Yes"
  if (answers.photoMatch === true) {
    yesCount = yesCount + 1;
  }

  // Vein symptoms are the clearest sign of oak wilt, so they count as "several" by themselves
  if (answers.veins === "yes" || yesCount >= 2) {
    return "several";
  }
  if (yesCount === 1) {
    return "some";
  }
  return "none";
}

// Returns the value of the checked radio button in a group, or null if none is checked
function getCheckedValue(name) {
  const checked = symptomForm.querySelector('input[name="' + name + '"]:checked');
  return checked === null ? null : checked.value;
}

// ----- Step 2: the photo -----
photoInput.addEventListener("change", function () {
  const file = photoInput.files[0];
  photoMatch = false;
  photoResult.innerHTML = "";
  if (!file) {
    return;
  }

  // createObjectURL makes a temporary link to the photo that only works on this phone.
  // Nothing is uploaded. We free the old link first so it doesn't waste memory.
  if (photoPreview.src) {
    URL.revokeObjectURL(photoPreview.src);
  }

  // Wait for the picture to finish loading before the model looks at it
  photoPreview.onload = function () {
    if (TM_MODEL_URL === "") {
      showPhotoResult("Photo saved for your reference.", false);
    } else {
      checkPhotoWithModel();
    }
  };
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.hidden = false;
});

// Shows text under the photo. withDisclaimer adds the "not a diagnosis" line.
function showPhotoResult(text, withDisclaimer) {
  photoResult.innerHTML = "";
  const message = document.createElement("p");
  message.className = "location-status";
  message.textContent = text;
  photoResult.appendChild(message);

  if (withDisclaimer) {
    const disclaimer = document.createElement("p");
    disclaimer.className = "hint";
    disclaimer.textContent = "This is not a diagnosis. Only a lab test or qualified arborist can confirm oak wilt.";
    photoResult.appendChild(disclaimer);
  }
}

// Adds a <script> tag to the page and waits for it to finish loading
function loadScript(url) {
  return new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = url;
    script.onload = resolve;
    script.onerror = function () {
      reject(new Error("Couldn't load " + url));
    };
    document.head.appendChild(script);
  });
}

// Loads TensorFlow.js, Teachable Machine, and your model, but only the first time.
// Waiting until someone actually adds a photo keeps the app fast for everyone else.
function loadModel() {
  if (tmModel !== null) {
    return Promise.resolve(tmModel);
  }

  // Make sure the link ends with "/" so we can add the file names to it
  const baseUrl = TM_MODEL_URL.endsWith("/") ? TM_MODEL_URL : TM_MODEL_URL + "/";

  return loadScript(TFJS_URL)
    .then(function () {
      return loadScript(TM_IMAGE_URL);
    })
    .then(function () {
      // tmImage comes from the Teachable Machine library we just loaded
      return tmImage.load(baseUrl + "model.json", baseUrl + "metadata.json");
    })
    .then(function (model) {
      tmModel = model;
      return model;
    });
}

function checkPhotoWithModel() {
  showPhotoResult("Checking your photo…", false);

  loadModel()
    .then(function (model) {
      // The model looks at the photo right here on the phone
      return model.predict(photoPreview);
    })
    .then(function (predictions) {
      // predictions looks like: [{ className: "Oak wilt", probability: 0.72 }, { className: "Healthy", probability: 0.28 }]
      predictions.sort(function (a, b) {
        return b.probability - a.probability;
      });
      const top = predictions[0];
      const percent = Math.round(top.probability * 100);

      if (top.className === TM_OAK_WILT_CLASS) {
        photoMatch = top.probability >= TM_MIN_CONFIDENCE;
        showPhotoResult("Our model thinks this looks similar to oak wilt symptoms (" + percent + "% match).", true);
      } else {
        showPhotoResult("Our model thinks this looks most similar to \"" + top.className + "\" (" + percent + "% match).", true);
      }
    })
    .catch(function (error) {
      console.error("Photo check failed:", error);
      showPhotoResult("We couldn't run the photo check right now. Your checklist answers still work.", false);
    });
}

// ----- Step 3: the result -----
symptomForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const answers = {
    treeType: getCheckedValue("sc-treeType"),
    veins: getCheckedValue("sc-veins"),
    edges: getCheckedValue("sc-edges"),
    leafDrop: getCheckedValue("sc-leafDrop"),
    nearbyDied: getCheckedValue("sc-nearbyDied"),
    photoMatch: photoMatch
  };

  // Validation: every question needs an answer ("Not sure" is fine)
  const missing = [];
  if (answers.treeType === null) missing.push(1);
  SYMPTOM_QUESTIONS.forEach(function (question) {
    if (answers[question.key] === null) missing.push(question.number);
  });

  const symptomError = document.getElementById("symptom-error");
  if (missing.length > 0) {
    symptomError.textContent = "Please answer every question. Still missing: question " + missing.join(", ") + ".";
    symptomError.hidden = false;
    return;
  }
  symptomError.hidden = true;

  lastAnswers = answers;
  showSymptomResult(scoreSymptoms(answers));
});

function showSymptomResult(score) {
  const card = document.getElementById("symptom-result-card");

  if (score === "several") {
    card.innerHTML =
      '<div class="risk-card risk-high" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">⚠️</span> Several warning signs</h3>' +
        "<p>Your answers match common signs of oak wilt. Have a qualified arborist look at this tree soon. " +
        "Until then, don't prune or wound it.</p>" +
        "<p>Oak wilt spreads through connected roots, so reporting this tree helps your neighbors check their oaks too.</p>" +
      "</div>";
  } else if (score === "some") {
    card.innerHTML =
      '<div class="risk-card risk-medium" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">🔎</span> Some warning signs</h3>' +
        "<p>One of your answers matches a sign of oak wilt. Drought, heat, and other tree problems can look similar, " +
        "so keep watching this tree. If it gets worse, or you're worried, have a qualified arborist take a look.</p>" +
      "</div>";
  } else {
    card.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> No common warning signs</h3>' +
        "<p>Your answers don't match the most common signs of oak wilt. That's good news! " +
        "Keep checking your oaks, especially in spring and early summer.</p>" +
      "</div>";
  }

  // Show the right buttons for this result
  document.getElementById("result-actions-warning").hidden = (score === "none");
  document.getElementById("result-actions-none").hidden = (score !== "none");

  const result = document.getElementById("symptom-result");
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth" });
}

// Matches each checklist "Yes" to a checkbox on the map's report form.
// "Nearby oaks died" has no matching checkbox, so we tick "Other" and explain it in the note.
const CHECKLIST_TO_REPORT_SYMPTOM = {
  veins: "Yellow or brown veins on leaves",
  edges: "Leaves browning from the edges",
  leafDrop: "Sudden leaf drop",
  nearbyDied: "Other"
};

// The checklist says "Other", but the report form (and security rules) call it "Other oak"
const CHECKLIST_TO_REPORT_TREE = {
  "Live oak": "Live oak",
  "Red oak": "Red oak",
  "Other": "Other oak",
  "Not sure": "Not sure"
};

function prefillReportForm(answers) {
  const treeValue = CHECKLIST_TO_REPORT_TREE[answers.treeType];
  reportForm.querySelector('input[name="treeType"][value="' + treeValue + '"]').checked = true;

  Object.keys(CHECKLIST_TO_REPORT_SYMPTOM).forEach(function (key) {
    if (answers[key] === "yes") {
      const value = CHECKLIST_TO_REPORT_SYMPTOM[key];
      reportForm.querySelector('input[name="symptoms"][value="' + value + '"]').checked = true;
    }
  });

  if (answers.nearbyDied === "yes") {
    noteBox.value = "Nearby oaks have died recently.";
    updateNoteCounter();
  }
  // Status is left as "Suspected" (the form's default)
}

document.getElementById("report-from-check").addEventListener("click", function () {
  showScreen("neighborhood-map");
  closeReportForm();   // start from a clean form
  openReportForm();
  prefillReportForm(lastAnswers);
});

document.getElementById("start-over-button").addEventListener("click", function () {
  symptomForm.reset();
  if (photoPreview.src) {
    URL.revokeObjectURL(photoPreview.src);
  }
  photoPreview.removeAttribute("src");
  photoPreview.hidden = true;
  photoResult.innerHTML = "";
  photoMatch = false;
  lastAnswers = null;
  document.getElementById("symptom-error").hidden = true;
  document.getElementById("symptom-result").hidden = true;
  window.scrollTo(0, 0);
});

// Open the browser console and type:  runSymptomTests()
function runSymptomTests() {
  const tests = [
    { label: "all No", answers: { veins: "no", edges: "no", leafDrop: "no", nearbyDied: "no" }, expected: "none" },
    { label: "all Not sure", answers: { veins: "notsure", edges: "notsure", leafDrop: "notsure", nearbyDied: "notsure" }, expected: "none" },
    { label: "only veins Yes", answers: { veins: "yes", edges: "no", leafDrop: "no", nearbyDied: "no" }, expected: "several" },
    { label: "only edges Yes", answers: { veins: "no", edges: "yes", leafDrop: "no", nearbyDied: "no" }, expected: "some" },
    { label: "only nearby died Yes", answers: { veins: "no", edges: "no", leafDrop: "no", nearbyDied: "yes" }, expected: "some" },
    { label: "edges + leaf drop Yes", answers: { veins: "no", edges: "yes", leafDrop: "yes", nearbyDied: "no" }, expected: "several" },
    { label: "only photo match", answers: { veins: "no", edges: "no", leafDrop: "no", nearbyDied: "no", photoMatch: true }, expected: "some" },
    { label: "photo match + edges Yes", answers: { veins: "no", edges: "yes", leafDrop: "no", nearbyDied: "no", photoMatch: true }, expected: "several" }
  ];

  tests.forEach(function (test) {
    const result = scoreSymptoms(test.answers);
    printTestResult(result === test.expected, test.label + " → got " + result + ", expected " + test.expected);
  });
}
