# OakWatch Build Log

## October 18, 2026

### What was built
- **App shell:** header, home screen with big buttons, single-page screen switching, Back buttons, footer disclaimer with arborist link.
- **Safe to Prune?:** high/low risk card based on today's date (Feb 1 – Jun 30 = high risk), countdown to the next season change, "Why does this matter?" section, City of Austin source. `getPruneRisk(date)` + `runPruneTests()`.
- **iPhone Home Screen fix:** app fills the whole screen (behind the clock and home bar) using `viewport-fit=cover` and safe-area padding.
- **Neighborhood Map:** Leaflet map of Circle C with OpenStreetMap tiles, reports saved to and loaded live from Firebase Firestore, orange/red markers with popups ("3 days ago"), legend, "X trees reported in this area" count, report form with validation, locations rounded to ~100 m for privacy.
- **Firebase connection check:** console says "Firebase connected" or "Firebase not configured". Form data checked against the Firestore security rules; added an Austin-area check and a clearer error when the rules reject a save.
- **Home screen reorder:** Neighborhood Map first and highlighted, then Symptom Check, then Safe to Prune, plus a one-line pitch.
- **Check near me:** finds reports within 500 m using the phone's location (kept in memory only), shows a warning or all-clear card, and draws a blue dot at a rounded location. `findNearbyReports()` + `runNearbyTests()`.
- **Symptom Check:** 5-question checklist with "what to look for" descriptions, optional photo with an on-device Teachable Machine model (photo never uploaded), three result levels, and a button that pre-fills the map report form. `scoreSymptoms()` + `runSymptomTests()`.
- **About screen:** why I built it, how privacy is protected, sources, credits.

### Firebase connected + tested
- Added the real Firebase config. Console shows "Firebase connected".
- Saved one test report through the form (pin at 30.19, -97.88). It was accepted by the security rules, appeared on the map, the count went to "1 tree reported in this area," and the popup said "Reported just now."
- A second browser tab showed the new report live, without refreshing.
- "Check near me" with a faked location ~200 m away showed "1 reported tree about 200 m from you" and a blue dot at the rounded location.
- Symptom Check → "Report this tree" opened the map with the form pre-filled (tree type, matching symptoms, status Suspected).
- All console tests passed: `runPruneTests()` 4/4, `runNearbyTests()` 7/7, `runSymptomTests()` 8/8.
- Set up git with a `.gitignore` (ignores `.DS_Store`).

### Deployed to GitHub Pages
- Pushed the code to the public repo https://github.com/Protofr/oakwatch and turned on GitHub Pages (main branch, / root).
- Live at **https://protofr.github.io/oakwatch/**. Checked the live site: "Firebase connected" in the console, map loads, and the test report shows.

### AI usage
Claude Code (AI) helped build the home screen, map, near-me warning, and symptom check, wrote the first draft of the Firestore security rules, and helped connect and test Firebase and deploy to GitHub Pages. I created and set up the Firebase project, published the security rules, and tested the app.
