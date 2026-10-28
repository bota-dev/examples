import Combine
import Foundation

@MainActor final class RecordingsModel: ObservableObject {
    enum Mode: String { case sample = "Sample · synthetic", live = "Live" }
    @Published private(set) var mode: Mode?
    @Published private(set) var recordings: [Recording] = []
    @Published private(set) var hasMore = false
    @Published private(set) var selectedID: String?
    @Published private(set) var detail: Recording?
    @Published private(set) var transcript: Transcript?
    @Published private(set) var notes: Notes?
    @Published private(set) var busy = false
    @Published private(set) var retiring = false
    @Published private(set) var cleanupBlocked = false
    @Published private(set) var message: String?

    private var api: LibraryAPI?
    // App-level ownership survives window recreation and completed Task capture release.
    private var quarantinedAPI: LibraryAPI?
    private var epoch = 0
    private var selection = 0
    private var work: Task<Void, Never>?
    private var retirement: Task<Void, Never>?
    private var retiringEpoch: Int?
    private let liveFactory: @Sendable (String, String) throws -> LibraryAPI

    init(liveFactory: @escaping @Sendable (String, String) throws -> LibraryAPI = { try LibraryAPI.live(origin: $0, token: $1) }) {
        self.liveFactory = liveFactory
    }
    var canOpen: Bool { api == nil && !retiring && !cleanupBlocked }

    func openSample() {
        guard canOpen else { return }
        do { open(try Sample.api(), mode: .sample) }
        catch { message = LibraryFailure.invalidResponse.message }
    }
    func openLive(origin: String, token: String) {
        guard canOpen else { return }
        do { open(try liveFactory(origin, token), mode: .live) }
        catch { message = LibraryFailure.configuration.message }
    }
    private func open(_ api: LibraryAPI, mode: Mode) {
        self.api = api
        self.mode = mode
        epoch += 1
        refresh()
    }
    private func clearSelection() {
        selectedID = nil; detail = nil; transcript = nil; notes = nil
    }
    func refresh() {
        guard let api, !retiring, !cleanupBlocked else { return }
        selection += 1
        clearSelection()
        recordings = []; hasMore = false; message = nil; busy = true
        let generation = epoch, revision = selection, previous = work
        previous?.cancel()
        work = Task { [weak self] in
            await previous?.value
            guard let self, self.current(generation, revision) else { return }
            do {
                try Task.checkCancellation()
                let page = try await api.list()
                guard self.current(generation, revision), !Task.isCancelled else { return }
                self.recordings = page.data; self.hasMore = page.hasMore; self.busy = false
            } catch { self.failed(error, generation, revision) }
        }
    }
    func select(_ id: String) {
        guard let api, recordings.contains(where: { $0.id == id }), !retiring, !cleanupBlocked else { return }
        selection += 1
        clearSelection()
        selectedID = id; message = nil; busy = true
        let generation = epoch, revision = selection, previous = work
        previous?.cancel()
        work = Task { [weak self] in
            await previous?.value
            guard let self, self.current(generation, revision, id) else { return }
            do {
                try Task.checkCancellation()
                let detail = try await api.detail(id)
                guard self.current(generation, revision, id), !Task.isCancelled else { return }
                let transcripts = try await api.transcripts(id)
                guard self.current(generation, revision, id), !Task.isCancelled else { return }
                let transcript = transcripts.first { $0.status == .completed }
                var notes: Notes?
                if let transcript {
                    let summaries = try await api.summaries(transcript.id, id)
                    guard self.current(generation, revision, id), !Task.isCancelled else { return }
                    notes = summaries.first { $0.status == .completed }?.output
                }
                // Publish a verified snapshot together; a failed notes read cannot leave older content visible.
                self.detail = detail; self.transcript = transcript; self.notes = notes; self.busy = false
            } catch { self.failed(error, generation, revision) }
        }
    }
    func back() {
        guard api != nil, !retiring else { return }
        selection += 1
        clearSelection(); message = nil; busy = true
        let generation = epoch, revision = selection, previous = work
        previous?.cancel()
        work = Task { [weak self] in
            await previous?.value
            guard let self, self.current(generation, revision) else { return }
            self.busy = false
        }
    }
    func refreshSelection() {
        if let selectedID { select(selectedID) } else { refresh() }
    }
    private func current(_ generation: Int, _ revision: Int, _ id: String? = nil) -> Bool {
        epoch == generation && selection == revision && api != nil && !retiring && (id == nil || selectedID == id)
    }
    private func failed(_ error: any Error, _ generation: Int, _ revision: Int) {
        // Cleanup failure belongs to the session even if a newer selection fenced its content.
        if error as? LibraryFailure == .cleanup,
           (epoch == generation && api != nil) || retiringEpoch == generation {
            cleanupBlocked = true
            message = LibraryFailure.cleanup.message
            if api != nil { retire(message: LibraryFailure.cleanup.message) }
            return
        }
        if epoch == generation, api != nil, error as? LibraryFailure == .unauthorized {
            retire(message: LibraryFailure.unauthorized.message)
            return
        }
        guard current(generation, revision), !(error is CancellationError) else { return }
        detail = nil; transcript = nil; notes = nil; busy = false
        message = (error as? LibraryFailure ?? .network).message
    }
    func retire(message: String? = nil) {
        guard api != nil || work != nil else { return }
        retiringEpoch = epoch
        epoch += 1; selection += 1
        let previous = work, previousRetirement = retirement, closing = api
        api = nil; work = nil; mode = nil
        recordings = []; hasMore = false; clearSelection()
        busy = false; retiring = true; self.message = message
        previous?.cancel()
        // Revoke the actor-held token and cancel its URLSession while the reader joins.
        let close = Task { () -> Bool in
            do { try await closing?.close(); return true }
            catch { return false }
        }
        retirement = Task { [weak self] in
            await previousRetirement?.value
            await previous?.value
            if !(await close.value) {
                self?.cleanupBlocked = true
                self?.message = LibraryFailure.cleanup.message
            }
            if self?.cleanupBlocked == true { self?.quarantinedAPI = closing }
            self?.retiringEpoch = nil
            self?.retiring = false
        }
    }
    // Internal join points let synthetic tests prove completion rather than sleep.
    func waitForReads() async { await work?.value }
    func waitForRetirement() async { await retirement?.value }
}
