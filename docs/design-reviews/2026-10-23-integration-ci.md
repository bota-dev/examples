# Repository integration check

The acceptance basis is the current repository design: independent public API
quickstarts and the integrated Recordings backend retain their existing public
contracts, authorization and durable recovery. This change exposes existing
behavioral coverage on every pull request through one stable check; it adds no
application behavior, SDK upgrade or live cloud/device operation.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Exercise actual integrations | The aggregate runner executes existing Node API, shared backend contract, Web HTTP/server and mobile backend suites, including real localhost HTTP and SQLite persistence | matched |
| Preserve independent install roots and guards | The workflow uses the frozen Web host install; root/mobile install chains and all existing workflows are unchanged | matched |
| Expose evidence on every PR | `Integration tests` has no path filter and retains JUnit for 90 days | matched |
| Preserve authorization and uncertain outcomes | Existing ownership rejection, mixed-credential, peer-intent, GET-only recovery, signed webhook and integrity cases remain in the selected suites | matched |
| Distinguish evidence levels | Synthetic upstream fixtures and local hosts prove source integration only; live cloud, browser UI, native/device and publication gates remain separate | matched |

Run `npm ci --prefix end-to-end/web-reference` and `npm run test:integration`
on Node 22.23.2 or newer. The runner discovers the existing test files in its
explicit install-independent suite families. Platform-specific suites and the
changed example's own checks remain required. Windows skips Unix filesystem
permission/symlink cases according to their existing guards; Linux CI supplies
that platform's results. Test reports and exact hosted run receipts identify
the code actually tested. Current runs do not establish that historical merges
were tested before approval or merge.
