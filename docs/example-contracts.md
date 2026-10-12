# Integration rules for example changes

These are current contributor requirements. Read the selected example's README
and public contract for its exact supported behavior. The [architecture](../ARCHITECTURE.md)
owns system boundaries; this document retains the operation-specific safeguards
that must survive curation and backend consolidation.

## Public integration and application scope

- Use public `/v1/*` contracts; the credential-free health probe uses `/health`.
  SDK methods must exist in the exact published package consumed by the sample.
  Do not fill a missing facade with private transports, custom crypto or an
  unofficial wrapper SDK.
- Bota keys stay on the backend. Browser cookies and mobile app tokens authorize
  an application principal; the server derives its project/end-user mapping.
  A fixed-user local service requires a separate app token and explicit deployment
  limits. The unauthenticated legacy service is not a customer backend template.
- Verify resource ownership and exact source links before releasing content.
  Optional owner fields alone do not authorize an Ask session: retain membership
  in the owner-filtered directory. Citation recording/source scope stays exact.
- Use synthetic or consented audio. Keep secrets, signed URLs, grants, provider
  payloads and unrelated profile/content fields out of logs and fixtures.

## Writes, jobs and journals

- Persist intent before sending a write; preserve immutable scope and resource
  identities across restart. Unknown outcomes permit the documented GET-only
  reconciliation, never automatic resubmission or journal deletion to force a
  fresh operation. Transcription/summary creation can replace an existing result.
- An end-user external ID lookup is read-only. Reuse of that external ID cannot
  replace a saved end-user identity. Ask creation/title changes retain exact
  session membership, private title material and pre-write intent.
- Keep cloud intent and native capture stores separate. Preserve journal paths,
  account/key anchors, native operation IDs and unresolved locks during migration.
  A new auth or storage adapter must not reinterpret a pending operation's owner.
- Preserve current single-process recording arbitration and cross-journal
  checks. They do not establish exactly-once behavior against multiple service
  instances, external writers or provider-side effects.
- Observe known jobs with bounded GETs. Timeout/read failure does not authorize
  another model call. General notes remain source-linked `tmpl_general_notes`
  output; custom summaries retain their saved prompt/provider/source.
- Separate upload verification from processing. Test projects with explicit
  transcription creation must disable automatic transcription for that workflow.
  Webhook events signal a state refresh, not an instruction to start processing.

## Reads and observations

- Retain a fixed authorized owner/source filter on every cursor page, cap traversal
  and label incomplete/non-atomic output. Cloud snapshots do not prove live radio
  availability, physical execution, integrity or current device state.
- The current Node end-user device inventory is one bounded GET: the tracked
  backend does not honor documented offset pagination for that filter. Command
  history is bounded newest-first without cursors. Do not invent paging loops.
- Configuration inheritance/source labels are not provider approval, field-level
  provenance or firmware application. Preserve numeric-min/ordered-max rules,
  zero-sentinel caveats and array-index behavior; do not add consumer enforcement
  or defaults to metadata readers.
- Job/recording/summary snapshots retain exact project, owner and source fences.
  Aggregate fleet/health output grants no queue, sustained uptime or device proof.
- Command observers retain exact target and available owner/generation evidence;
  never fetch pending delivery or expose command grants, parameters or results.
  Current-owner reads and timestamp cutoffs cannot prove historical authorization.
- OTA readers preserve exact assignment/release identity. Metadata `applied`
  does not prove physical installation. Firmware discovery/download performs no
  signing, installation or hardware compatibility qualification.
- Encrypted-session observation preserves revision and complete-observation
  fences. Its current GET requires `recordings:write` for restricted keys;
  surrounding ownership reads need their read scopes. Status grants no cleanup
  authority.

## Downloads, playback and exports

- Original-download recipes request stored bytes without conversion/decryption.
  URL issuance alone proves neither object existence nor upload acceptance.
  Any expected SHA-256 comes from an independently trusted fixture.
- Keep Bota/API credentials off storage requests, reject redirects, bound bytes
  and retain each recipe's exact independently trusted storage-host policy.
  Publish private local files without overwrite; clean incomplete output and
  recheck ownership. Windows directory privacy requires operator-managed ACLs.
- Firmware bytes match API-declared original BIN metadata; that check grants
  no device installation authority.
- Transcript/summary/Ask exports require completed, exactly linked, authorized
  sources. Escape Markdown and HTML text, transform CSV string cells before
  quoting, and preserve ordered timestamp semantics for SRT/WebVTT. HTML exports
  have no scripts/external resources. NDJSON is a local format, not an API promise.
- New app playback must select an authorized, actually playable source through
  the public download/export contract. Treat encrypted originals and unsupported
  media as unavailable; do not decrypt in app JavaScript or use a generated URL
  as proof of working playback. Signed media access is short-lived and not logged
  or persisted as a durable credential.

## Webhook acceptance

- Verify signatures over the exact raw bytes and timestamp under the documented
  HMAC contract before parsing/acknowledging. Commit a durable deduplicated inbox
  entry before acknowledgment; an in-memory Set is not a replacement.
- Treat event content as untrusted and refresh the current authorized resource.
  Receipt storage must not expose unrelated content or replay a processing write.

## Device and asynchronous application lifecycle

- Select devices through configured identity and public SDK read-back. Advertising
  names are insufficient. Already-provisioned Android beta.13 flows require a fresh,
  connection-fenced public pairing-state read: snapshot `isProvisioned` defaults
  to false and cannot establish that gate. False/error means pairing unconfirmed.
- Public pairing state does not replace server ownership, binding generation or
  encrypted-upload authorization. Target binding is prepare/provision/confirm
  with protected material and exact-attempt abort/recovery; raw-token legacy
  provisioning is a compatibility gap.
- App SDK owns transport, bytes, encrypted material, receipt verification and
  source cleanup. Native host callbacks own scoped HTTP authorization. Preserve
  exact recording/binding identity, fresh idle/no-active-upload admission and
  SDK acknowledgment before native cleanup/device confirmation.
- Legacy `uploaded`, API job success or cloud session status alone grants no
  device deletion. Loss of BLE does not prove WiFi/4G upload stopped or authorize
  concurrent fallback. Metadata catalogs never transfer/delete audio.
- Fence late results to current connection, session, source and selection. Clear
  stale state on observed stream failure/termination/loss; omitted native
  callbacks remain an acceptance gap. Keep transport recovery in the SDK.
- Preserve cancellation ordering, draining subscriptions/actions/finalizers,
  awaited SDK destruction and replacement-admission gates. Failed final cleanup
  blocks a replacement session. Flutter late Futures cannot overwrite a newer
  disconnection. Explicit disconnect clears UI in `finally` and retains failure.
- Keep native capture upload material out of JavaScript/Dart. Flutter connection/
  status grants no encrypted-sync authority. Missing public pairing/catalog/
  encrypted-v2 interfaces are blockers, not invitations to invent private APIs.
- Unbind/deprovision is non-destructive and is not factory reset. Authorized device
  writes require the relevant runbook and exact action/generation gates first.
  No destructive automatic cleanup of unrelated recordings/devices.

## Dependency and evidence boundaries

Mandatory dependency guards and consumer tests are specified in
[AGENTS.md](../AGENTS.md#preserve-dependency-guards) and their linked remediation
documents. Preserve distinct Android app IDs, platform minimums and native
toolchain gates recorded in each manifest/README/workflow. Root migration/native
build evidence cannot qualify another sample or a new SDK pin.

Source review, syntax, mocks, build, live API and physical acceptance are separate.
Record exact versions, source and hardware in the
[implementation review](independent-examples-review.md); no older phone test
qualifies a newly changed application. Public contributors may use the linked
public contracts without access to internal Bota repositories.
