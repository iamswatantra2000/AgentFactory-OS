# Initial threat model

Trust boundaries exist between the browser and gateway, gateway and domain services, and every service and its owned database. Primary risks include IDOR/BOLA, cookie theft, CSRF, XSS, injection, SSRF through future connectors, test-entitlement abuse, denial of service, and secret leakage.

Current controls include strict input validation, secure headers, explicit CORS, request-size limits, correlation IDs, redacted structured logs, isolated database credentials, and a production-denied test-checkout path. Authentication provider integration, distributed rate limiting, service authentication and production secret management remain deployment decisions.
