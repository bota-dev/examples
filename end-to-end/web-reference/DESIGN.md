# Bota Recordings: common sample app

## Purpose

A familiar optional recording reference for customer developers to run, learn
from and adapt for their own end users. It is a general platform sample/template in repository
Layer 1, inspired by Demo and Bota One. Its user imports audio, chooses a
recording, reads a transcript and summary, and asks about the recording.
This client belongs to the optional **Bota Recordings** references alongside
React Native and Flutter clients. Its reference target is audio input → library → supported playback
→ transcript → general notes → Ask. The two repository layers remain general
platform examples now, then vertical use cases and consumer app types later.
Independent API workflow recipes and small platform SDK starters are the primary
learning paths. This reference shows a coherent app/backend composition; it is
another format within Layer 1, not a prerequisite or another product layer.
The [architecture decision](../../docs/design-decisions/2026-10-12-example-architecture.md)
records this balance. Platform starters may use different normal UI and SDK DTOs.

## Implemented subset and target

| Capability          | Current web implementation                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Audio input         | Import a supported audio file through the customer backend. No microphone capture.                    |
| Library and results | Recording list/detail, explicit transcription, general notes and recording-scoped Ask.                |
| Playback            | Not implemented. The target adds playback only for a supported, authorized audio representation.      |
| Device SDK          | Not integrated. The separate browser connection sample does not make this app a device-sync template. |
| Synthetic mode      | In-process API fixtures and synthetic results; no external upload/provider/device acceptance.         |

The [root roadmap](../../ROADMAP.md) owns the remaining reference and platform work.
Do not describe target features as available controls or add overlapping app
roots to satisfy a coverage count.

## Backend direction

Currently this install root contains its own Node backend and the mobile clients
use a separate shared backend. Sharing concrete recording, processing and Ask
features is planned where a compatible contract reduces duplication among these
optional references. It does not supply a mandatory backend for independent API
or SDK examples. Preserve current cookie/account authentication,
public routes, durable upload/job/Ask journals and webhook acceptance until a
reviewed migration replaces them. Do not import a sibling example's runtime code
or silently point a client at another backend.

Reference reuse should align live responses and synthetic fixtures with the
selected client contract and exact source identities. Independent SDK starters
need no forced common DTO/UI. Shared fixture behavior is a testing and demo
boundary, not proof of live API, provider or physical-device conformance.

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

Keep each integration focused and expose its public calls in README/source.
An integration can span feature, HTTP, auth, verification and durable-state
modules; document the complete import graph needed to adapt it. Do not present
an Ask entry file as a tiny, independently usable integration. Label synthetic
results clearly. Render untrusted transcript/summary/Ask strings as text. Preserve
account/scope fences, action locks and honest uncertain-outcome states. Never
expose API credentials or internal error details in product UI.

The recording reference should remain useful to its end user rather than become
an API Explorer. Its import/playback work is specific to this app and must not
delay qualified iOS/Swift/Kotlin SDK examples. Those examples may teach one direct
public call through a small normal platform harness. Intentional short helper
duplication across copyable roots is acceptable; no global sample framework or
private runtime dependency should be introduced to eliminate it.

Use normal platform UI and published public SDK surfaces for optional device
paths. The [Web SDK contract](https://github.com/bota-dev/app-sdk/tree/v2.0.0-beta.13/frameworks/web)
targets foreground desktop Chromium, a secure context and compatible device
Identity service; API-only browser use and browser Bluetooth have different
boundaries. Existing exact SDK pins stay unchanged in this design revision.
Connection/catalog samples do not establish complete app parity or hardware
acceptance. Vertical workflows and production identity/deployment remain later
or customer-owned work, respectively.
