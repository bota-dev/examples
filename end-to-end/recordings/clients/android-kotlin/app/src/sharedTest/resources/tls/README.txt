These generated, self-signed PKCS12 fixtures and their private keys are public
synthetic test data. Password: synthetic-only. Never use them in an application,
server, trust store, or live environment. All four keys were generated for this
example with JDK17 keytool and have no external identity or authority.

localhost: CN=localhost, DNS SAN=localhost (trusted test peer).
foreign: CN=foreign.invalid, no SAN (trusted chain, incorrect DNS identity).
ip-missing-san: CN=127.0.0.1, no SAN (trusted chain, missing required IP SAN).
untrusted: CN=localhost, DNS SAN=localhost (not in the test trust store).

Only test code loads these fixtures or changes the test process SSLContext.
Production uses the unchanged system trust and HTTPS endpoint checks.
