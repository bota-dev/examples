# React Native client moved

The complete Android client now lives at
[Bota Recordings / React Native](../../recordings/clients/react-native/README.md).
Follow that README for setup, native checks and copy boundaries. This old entry
is a documentation link, not an install root.

The original move preserved SDK beta.13; the client now pins public beta.20.
It retains the app identity, dependency guards and `8787`
origin defaults. The [mobile backend](../backend/README.md) keeps its original
launch base and journals; use the [combined setup](../../recordings/README.md)
without resetting retained native captures or rewriting journal scope.
