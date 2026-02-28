# Security Policy

## Supported Versions

This project currently supports security fixes for the latest `master` branch.

## Reporting a Vulnerability

If you discover a security vulnerability:

1. Do not open a public issue.
2. Use GitHub Security Advisories for this repository:
   - Repository -> Security -> Advisories -> Report a vulnerability
3. Include:
   - Affected component(s)
   - Reproduction steps or proof of concept
   - Impact assessment
   - Suggested mitigation (if known)

You can expect:

- Initial acknowledgment within 5 business days
- Ongoing status updates during triage/remediation
- Coordinated disclosure after a fix is available

## Antivirus False Positives

Unsigned, low-prevalence desktop binaries can be flagged by heuristic/ML scanners (including Windows Defender) even when clean.

Project mitigations:

- Desktop scan defaults to known game library locations only.
- Optional code-signing support exists in CI (`build-desktop.yml`) when certificate secrets are configured.
- CI publishes `SHA256SUMS.txt` with desktop artifacts.

If a release is flagged:

1. Verify the binary hash against `SHA256SUMS.txt`.
2. Build locally from source and compare behavior.
3. Submit the file to Microsoft as a suspected false positive:
   - https://www.microsoft.com/wdsi/filesubmission
