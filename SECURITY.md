# Security

## Reporting a vulnerability

Do not publish exploit details, credentials, private ticket links or customer information in issues or pull requests.

If GitHub private vulnerability reporting is enabled, use **Security → Report a vulnerability**. If unavailable, contact the [maintainer through GitHub](https://github.com/YadurajManu) to arrange a private channel before sharing sensitive details. No response-time or security-support SLA is currently promised.

Include affected routes/components, the relevant commit, reproduction steps using accounts you control, impact and a suggested fix if available. Keep evidence minimal and redact personal data and tokens.

## Scope and deployment responsibility

Reports against the current development branch (`master`) are welcome. Version-specific support windows have not been established.

Operators are responsible for provider access, backups, HTTPS, secret management and dependency updates. Keep service-account keys, payment credentials, signing secrets and private storage keys outside Git and browser bundles. Rotate exposed credentials at the provider; deleting a visible copy alone does not revoke them.

The license does not grant permission to test deployments or infrastructure you do not own. Use a local environment or obtain authorization from its operator.
