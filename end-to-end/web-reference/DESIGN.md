# Bota Recordings: common sample app

## Purpose

A familiar recording app for customer developers to run, learn from and adapt
for their own end users. It is a general platform sample/template in repository
Layer 1, inspired by Demo and Bota One. Its user imports audio, chooses a
recording, reads a transcript and summary, and asks about the recording.
This web implementation uses the public API through a Node backend. It has no
device SDK, microphone capture or audio playback.

## Experience

- Compact header: **Bota Recordings**, **Sample app** badge, demo/live indicator
  and account/sign-out controls.
- Recording library: title, date, duration and concise state in each row;
  **Upload audio** and Refresh actions. Show the actual selected file before upload.
- Recording detail: title/metadata, then **Transcript**, **Summary** and **Ask**
  tabs. Display one feature at a time with explicit processing actions.
- Short loading, empty, pending and failure states. Use a simple selection prompt
  before a recording is opened; no hero or oversized blank illustration.
- Narrow screens show the library or the selected detail with a Back action.
  Keyboard users can select tabs and return to the library.
- **Activity** is a secondary, initially collapsed panel for saved-operation
  GET reconciliation and webhook metadata. It never resends a write or displays
  recovered answer content.

Use white/gray surfaces, system sans-serif text, modest spacing, clear buttons,
visible focus and useful contrast. Avoid editorial headlines or ornamental
metadata. Keep API endpoints, documentation links and source recipes in README
and code, outside everyday recording controls.

## Boundaries

Keep each integration in its own small feature file. Label synthetic results
clearly. Render untrusted transcript/summary/Ask strings as text. Preserve
account/scope fences, action locks and honest uncertain-outcome states. Never
expose API credentials or internal error details in product UI.

The common recording journey is also the direction for mobile/native templates,
using their normal platform UI and supported public SDK surfaces. Existing
connection/catalog samples are focused examples, not complete app parity.
Vertical workflows and production identity/deployment remain outside this sample.
