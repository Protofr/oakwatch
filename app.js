
function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach(function (screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  window.scrollTo(0, 0);

  if (screenId === "prune-check") {
    showPruneRisk();
  }

  if (screenId === "neighborhood-map") {
    showNeighborhoodMap();
  }
}

const navButtons = document.querySelectorAll("[data-target]");
navButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showScreen(button.dataset.target);
  });
});

function getPruneRisk(date) {
  const month = date.getMonth();

  if (month >= 1 && month <= 5) {
    return "high";
  }
  return "low";
}

function getDaysUntilRiskChange(date) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const year = today.getFullYear();
  let nextChange;

  if (getPruneRisk(today) === "high") {
    nextChange = new Date(year, 6, 1);
  } else if (today.getMonth() === 0) {
    nextChange = new Date(year, 1, 1);
  } else {
    nextChange = new Date(year + 1, 1, 1);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((nextChange - today) / msPerDay);
}

function pluralDays(count) {
  return count === 1 ? "1 day" : count + " days";
}

function showPruneRisk() {
  const today = new Date();
  const risk = getPruneRisk(today);
  const daysLeft = getDaysUntilRiskChange(today);

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
        '<h3><span class="risk-icon" aria-hidden="true">⚠️</span> High risk: don\'t prune oaks right now.</h3>' +
        "<p>Sap beetles that carry oak wilt are out in spring, and fresh cuts draw them in.</p>" +
        '<p class="countdown">Safer season starts in ' + pluralDays(daysLeft) + ".</p>" +
        '<p class="paint-reminder">If a branch breaks or a mower nicks the bark, paint over it right away. ' +
        "Any paint works.</p>" +
      "</div>";
  } else {
    card.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> Low risk: good time to prune.</h3>' +
        '<p class="paint-reminder">🖌️ Still paint every cut right away. Any paint works.</p>' +
        '<p class="countdown">Risky season starts again in ' + pluralDays(daysLeft) + ".</p>" +
      "</div>";
  }
}

function runPruneTests() {
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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXKQwrxDhup_fZokS6VwBLrQBh5wdm1vc",
  authDomain: "oakwatch-b03d1.firebaseapp.com",
  projectId: "oakwatch-b03d1",
  storageBucket: "oakwatch-b03d1.firebasestorage.app",
  messagingSenderId: "633740803152",
  appId: "1:633740803152:web:5a505ffcc3f1710968e555"
};

let db = null;
if (FIREBASE_CONFIG.apiKey.startsWith("PASTE")) {
  console.log("Firebase not configured");
} else {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();

  db.collection("reports").limit(1).get()
    .then(function () {
      console.log("Firebase connected");
    })
    .catch(function (error) {
      console.error("Firebase is configured, but the connection failed:", error.message);
    });
}

const REPORT_AREA = { minLat: 29.5, maxLat: 31, minLng: -98.5, maxLng: -97 };

function isInReportArea(lat, lng) {
  return lat > REPORT_AREA.minLat && lat < REPORT_AREA.maxLat &&
         lng > REPORT_AREA.minLng && lng < REPORT_AREA.maxLng;
}

const MAP_CENTER = [30.19, -97.88];
const MAP_ZOOM = 14;

let map = null;
let reportMarkers = [];
let allReports = [];
let reportsLoaded = false;
let draftMarker = null;
let chosenLocation = null;

function showNeighborhoodMap() {
  if (map === null) {
    createMap();
    loadReports();
  } else {
    map.invalidateSize();
  }
}

function createMap() {
  map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.on("click", function (event) {
    if (!reportForm.hidden) {
      setChosenLocation(event.latlng.lat, event.latlng.lng);
    }
  });

  map.on("moveend", updateReportCount);
}

function makePinIcon(type) {
  const symbols = { suspected: "?", confirmed: "!", draft: "+" };
  return L.divIcon({
    className: "report-marker",
    html: '<span class="report-pin pin-' + type + '">' + symbols[type] + "</span>",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

function loadReports() {
  if (db === null) {
    document.getElementById("report-count").textContent =
      "Reports aren't connected yet. Add your Firebase config to app.js.";
    return;
  }

  db.collection("reports").onSnapshot(
    function (snapshot) {
      reportMarkers.forEach(function (marker) {
        marker.remove();
      });
      reportMarkers = [];
      allReports = [];

      snapshot.forEach(function (doc) {
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
        "Couldn't load reports. Try again in a bit.";
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
  const statusText = report.status === "confirmed" ? "Confirmed by an arborist" : "Suspected";
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [];

  let html = '<h3 class="popup-title">' + escapeHtml(report.treeType) + "</h3>";
  html += "<p><strong>Status:</strong> " + statusText + "</p>";
  html += "<p><strong>What they saw:</strong></p><ul>";
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const reportForm = document.getElementById("report-form");
const formError = document.getElementById("form-error");
const mapMessage = document.getElementById("map-message");
const noteBox = document.getElementById("note");
const submitButton = document.getElementById("submit-report-button");

function openReportForm() {
  mapMessage.hidden = true;
  reportForm.hidden = false;
  reportForm.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("open-report-button").addEventListener("click", openReportForm);

document.getElementById("cancel-report-button").addEventListener("click", closeReportForm);

function updateNoteCounter() {
  document.getElementById("note-counter").textContent = noteBox.value.length + " / 200";
}

noteBox.addEventListener("input", updateNoteCounter);

function roundForPrivacy(number) {
  return Math.round(number * 1000) / 1000;
}

function setChosenLocation(lat, lng) {
  chosenLocation = { lat: roundForPrivacy(lat), lng: roundForPrivacy(lng) };

  if (draftMarker === null) {
    draftMarker = L.marker([chosenLocation.lat, chosenLocation.lng], { icon: makePinIcon("draft") }).addTo(map);
  } else {
    draftMarker.setLatLng([chosenLocation.lat, chosenLocation.lng]);
  }

  document.getElementById("location-status").textContent =
    "✓ Pin placed (approximate). Tap the map again to move it.";
}

document.getElementById("use-location-button").addEventListener("click", function () {
  const status = document.getElementById("location-status");

  if (!("geolocation" in navigator)) {
    status.textContent = "Location isn't available here. Tap the map instead.";
    return;
  }

  status.textContent = "Finding your location…";

  navigator.geolocation.getCurrentPosition(
    function (position) {
      setChosenLocation(position.coords.latitude, position.coords.longitude);
      map.setView([chosenLocation.lat, chosenLocation.lng], 16);
    },
    function (error) {
      if (error.code === error.PERMISSION_DENIED) {
        status.textContent =
          "Location is turned off. Just tap the map where the tree is.";
      } else {
        status.textContent =
          "Couldn't find your location. Tap the map where the tree is.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

reportForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const treeTypeInput = reportForm.querySelector('input[name="treeType"]:checked');
  const statusInput = reportForm.querySelector('input[name="status"]:checked');
  const symptomInputs = reportForm.querySelectorAll('input[name="symptoms"]:checked');

  const symptoms = [];
  symptomInputs.forEach(function (input) {
    symptoms.push(input.value);
  });

  const problems = [];
  if (treeTypeInput === null) problems.push("Pick a tree type.");
  if (symptoms.length === 0) problems.push("Check at least one thing you saw.");
  if (chosenLocation === null) {
    problems.push("Tap \"Use My Location\" or tap the map to drop a pin.");
  } else if (!isInReportArea(chosenLocation.lat, chosenLocation.lng)) {
    problems.push("OakWatch only takes reports around Austin. Move the pin closer to Austin.");
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
  submitButton.disabled = true;
  submitButton.textContent = "Saving…";

  const newReport = {
    treeType: treeTypeInput.value,
    symptoms: symptoms,
    status: statusInput.value,
    note: noteBox.value.trim().slice(0, 200),
    lat: chosenLocation.lat,
    lng: chosenLocation.lng,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("reports").add(newReport)
    .then(function () {
      closeReportForm();
      showMapMessage("Thanks! Your report is on the map.");
    })
    .catch(function (error) {
      console.error("Could not save report:", error);
      if (error.code === "permission-denied") {
        showFormError("Your report didn't pass our checks, so it wasn't saved. Look over your answers and try again.");
      } else {
        showFormError("Couldn't save your report. Check your internet and try again.");
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

const NEAR_ME_RADIUS = 500;
let youMarker = null;
let youCircle = null;

function findNearbyReports(lat, lng, radiusMeters, reports) {
  if (reports === undefined) {
    reports = allReports;
  }

  const here = L.latLng(lat, lng);
  const nearby = [];

  reports.forEach(function (report) {
    const meters = here.distanceTo(L.latLng(report.lat, report.lng));
    if (meters <= radiusMeters) {
      nearby.push({ report: report, meters: meters });
    }
  });

  nearby.sort(function (a, b) {
    return a.meters - b.meters;
  });
  return nearby;
}

function roundToNearest50(meters) {
  return Math.round(meters / 50) * 50;
}

function describeDistance(meters) {
  const rounded = roundToNearest50(meters);
  if (rounded === 0) {
    return "less than 50 m";
  }
  return "about " + rounded + " m";
}

const nearMeResult = document.getElementById("near-me-result");

function showNearMeMessage(text, isError) {
  nearMeResult.innerHTML = "";
  const box = document.createElement("div");
  box.className = isError ? "message message-error" : "message";
  box.textContent = text;
  nearMeResult.appendChild(box);
}

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
        "<p>Oak wilt can travel through connected roots, so it's worth having an arborist look at your oaks.</p>" +
        '<p><a href="https://texasoakwilt.org/getting-help/vendors" target="_blank" rel="noopener">Find an oak wilt specialist</a></p>' +
        '<p class="hint">Distances are rough because report locations are rounded for privacy.</p>' +
      "</div>";
  } else {
    nearMeResult.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> No reports within ' + NEAR_ME_RADIUS + " m of you.</h3>" +
        '<p class="paint-reminder">Keep an eye on your oaks, and paint every pruning cut.</p>' +
      "</div>";
  }
}

function showYouDot(lat, lng) {
  if (youMarker !== null) {
    youMarker.remove();
    youCircle.remove();
  }

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
  youMarker.bindPopup("You're about here. This is never saved.");

  map.fitBounds(youCircle.getBounds());
}

document.getElementById("near-me-button").addEventListener("click", function () {
  if (db === null) {
    showNearMeMessage("Reports aren't connected yet. Add your Firebase config to app.js.", true);
    return;
  }
  if (!reportsLoaded) {
    showNearMeMessage("Reports are still loading. Try again in a few seconds.", true);
    return;
  }
  if (!("geolocation" in navigator)) {
    showNearMeMessage("Location isn't available here, so we can't check near you.", true);
    return;
  }

  showNearMeMessage("Finding your location…", false);

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const exactLat = position.coords.latitude;
      const exactLng = position.coords.longitude;

      const nearby = findNearbyReports(exactLat, exactLng, NEAR_ME_RADIUS);
      showNearMeResult(nearby);

      showYouDot(roundForPrivacy(exactLat), roundForPrivacy(exactLng));
    },
    function (error) {
      if (error.code === error.PERMISSION_DENIED) {
        showNearMeMessage(
          "Location is turned off, so we can't check near you. You can still look at the map for reports on your street.",
          true
        );
      } else {
        showNearMeMessage(
          "Couldn't find your location. Try again, or look at the map for your street.",
          true
        );
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function printTestResult(passed, label) {
  console.log((passed ? "PASS" : "FAIL") + "  " + label);
}

function runNearbyTests() {
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

const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/sbME8MtpC/";

const TM_OAK_WILT_CLASS = "Oak wilt";

const TM_MIN_CONFIDENCE = 0.6;

const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js";
const TM_IMAGE_URL = "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js";

const symptomForm = document.getElementById("symptom-form");
const cameraInput = document.getElementById("symptom-photo-camera");
const libraryInput = document.getElementById("symptom-photo-library");
const photoPreview = document.getElementById("photo-preview");
const photoResult = document.getElementById("photo-result");

let tmModel = null;
let photoMatch = false;
let lastAnswers = null;

const SYMPTOM_QUESTIONS = [
  { key: "veins", number: 2 },
  { key: "edges", number: 3 },
  { key: "leafDrop", number: 4 },
  { key: "nearbyDied", number: 5 }
];

function scoreSymptoms(answers) {
  let yesCount = 0;
  SYMPTOM_QUESTIONS.forEach(function (question) {
    if (answers[question.key] === "yes") {
      yesCount = yesCount + 1;
    }
  });

  if (answers.photoMatch === true) {
    yesCount = yesCount + 1;
  }

  if (answers.veins === "yes" || yesCount >= 2) {
    return "several";
  }
  if (yesCount === 1) {
    return "some";
  }
  return "none";
}

function getCheckedValue(name) {
  const checked = symptomForm.querySelector('input[name="' + name + '"]:checked');
  return checked === null ? null : checked.value;
}

cameraInput.addEventListener("change", function () {
  handlePhoto(cameraInput);
});
libraryInput.addEventListener("change", function () {
  handlePhoto(libraryInput);
});

function handlePhoto(input) {
  const file = input.files[0];
  photoMatch = false;
  photoResult.innerHTML = "";
  if (!file) {
    return;
  }

  if (photoPreview.src) {
    URL.revokeObjectURL(photoPreview.src);
  }

  photoPreview.onload = function () {
    if (TM_MODEL_URL === "") {
      showPhotoResult("Photo added.", false);
    } else {
      checkPhotoWithModel();
    }
  };
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.hidden = false;

  input.value = "";
}

function showPhotoResult(text, withDisclaimer) {
  photoResult.innerHTML = "";
  const message = document.createElement("p");
  message.className = "location-status";
  message.textContent = text;
  photoResult.appendChild(message);

  if (withDisclaimer) {
    const disclaimer = document.createElement("p");
    disclaimer.className = "hint";
    disclaimer.textContent = "Not a diagnosis. Only a lab test or an arborist can confirm oak wilt.";
    photoResult.appendChild(disclaimer);
  }
}

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

function loadModel() {
  if (tmModel !== null) {
    return Promise.resolve(tmModel);
  }

  const baseUrl = TM_MODEL_URL.endsWith("/") ? TM_MODEL_URL : TM_MODEL_URL + "/";

  return loadScript(TFJS_URL)
    .then(function () {
      return loadScript(TM_IMAGE_URL);
    })
    .then(function () {
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
      return model.predict(photoPreview);
    })
    .then(function (predictions) {
      predictions.sort(function (a, b) {
        return b.probability - a.probability;
      });
      const top = predictions[0];
      const percent = Math.round(top.probability * 100);

      if (top.className === TM_OAK_WILT_CLASS) {
        photoMatch = top.probability >= TM_MIN_CONFIDENCE;
        showPhotoResult("This looks like oak wilt to our model (" + percent + "% sure).", true);
      } else {
        showPhotoResult("This looks most like \"" + top.className + "\" to our model (" + percent + "% sure).", true);
      }
    })
    .catch(function (error) {
      console.error("Photo check failed:", error);
      showPhotoResult("The photo check didn't work this time. Your answers still count.", false);
    });
}

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

  const missing = [];
  if (answers.treeType === null) missing.push(1);
  SYMPTOM_QUESTIONS.forEach(function (question) {
    if (answers[question.key] === null) missing.push(question.number);
  });

  const symptomError = document.getElementById("symptom-error");
  if (missing.length > 0) {
    symptomError.textContent = "Answer every question first. Still missing: question " + missing.join(", ") + ".";
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
        "<p>Your answers line up with common signs of oak wilt. Get an arborist to look at this tree soon, " +
        "and don't prune it until then.</p>" +
        "<p>Oak wilt spreads through the roots, so putting this tree on the map gives your neighbors a heads-up.</p>" +
      "</div>";
  } else if (score === "some") {
    card.innerHTML =
      '<div class="risk-card risk-medium" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">🔎</span> Some warning signs</h3>' +
        "<p>One of your answers matches a sign of oak wilt. Drought and heat can cause the same thing, " +
        "so keep watching this tree. If it gets worse, call an arborist.</p>" +
      "</div>";
  } else {
    card.innerHTML =
      '<div class="risk-card risk-low" role="status">' +
        '<h3><span class="risk-icon" aria-hidden="true">✅</span> No common warning signs</h3>' +
        "<p>Your answers don't match the usual signs of oak wilt. " +
        "Keep checking your oaks, especially in spring and early summer.</p>" +
      "</div>";
  }

  document.getElementById("result-actions-warning").hidden = (score === "none");
  document.getElementById("result-actions-none").hidden = (score !== "none");

  const result = document.getElementById("symptom-result");
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth" });
}

const CHECKLIST_TO_REPORT_SYMPTOM = {
  veins: "Yellow or brown veins on leaves",
  edges: "Leaves browning from the edges",
  leafDrop: "Sudden leaf drop",
  nearbyDied: "Other"
};

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
}

document.getElementById("report-from-check").addEventListener("click", function () {
  showScreen("neighborhood-map");
  closeReportForm();
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
