**Addis Ababa Science and Technology University**

**Department of Software Engineering**

**Computer System Security**

**Project One**

**Students must select their own project titles; no two titles may be the same. Submit your work by December 7, 2026.**

**Project features: I**

**Security Features Specification**

**1. Access Control and Authentication**

**1.1 Role-Based Access Control (RBAC)**

- Define roles based on job responsibilities and organizational hierarchy.

- Assign **least-privilege** permissions to each role based on required tasks.

- Implement a mechanism for assigning, modifying, and revoking roles.

- Support dynamic role change requests with a documented approval workflow.

- Enforce **separation of duties** so that no single user can both request and approve a privileged role change.

- Maintain an audit trail for all role assignments and changes.

- Review role assignments periodically (e.g., quarterly) to remove stale access.

**1.2 Identification and Registration**

- Design a secure user registration form that collects only necessary information.

- Implement **email or mobile phone verification** before account activation.

- Use **CAPTCHA** (e.g., reCAPTCHA v3) to prevent automated fake account creation while remaining user-friendly.

- Allow users to securely update and manage their profiles.

- Support **biometric authentication** where applicable, with a secure fallback method.

- Implement secure **account recovery** (identity verification before password reset).

**1.3 Password Authentication**

- **Password policies:** Enforce minimum length (e.g., 12+ characters), complexity, and checks against common/breached password lists (e.g., Have I Been Pwned). Provide user guidance on creating strong passwords.

- **Password hashing:** Use modern, salted hashing algorithms such as **Argon2id, bcrypt, or scrypt**. Never store plaintext passwords. Salting prevents **rainbow-table attacks**.

- **Account lockout policy:** Lock accounts temporarily after a defined number of failed login attempts (e.g., 5) to mitigate **brute-force attacks**, with a defined lockout duration and unlock procedure.

- **Secure password transmission:** Enforce **HTTPS/TLS** for all authentication traffic. Never send passwords in URL parameters or logs.

- **Password change:** Provide a secure password change and reset flow with identity verification.

- **Rate limiting:** Apply rate limiting on login and password-reset endpoints.

**1.4 Token-Based Authentication and Session Management**

- Implement token-based authentication (e.g., **JWT** or opaque tokens).

- Store tokens securely (e.g., **HttpOnly, Secure cookies**; avoid localStorage for sensitive tokens).

- Set **short token expiration** and implement **refresh tokens with rotation**.

- Support **token revocation** and secure logout.

- Enforce **session timeout** and **idle timeout**.

- Protect against **session fixation** and **CSRF** (e.g., anti-CSRF tokens, SameSite cookies).

**1.5 Multi-Factor Authentication (MFA)**

- Require username/password as the first factor.

- Implement at least one additional factor: **TOTP** (e.g., Google Authenticator), push notification, hardware token, or biometrics.

- Provide secure **MFA enrollment**, **backup codes**, and **account recovery** procedures.

**2. Audit Trails and Logging**

**2.1 User Activity Logging**

- Log all user activities, including **username, timestamp, IP address, and action performed**.

- Capture authentication events (success/failure), authorization decisions, and data changes.

- Log access to sensitive resources and administrative actions.

**2.2 System Event Logging**

- Log critical system events: **startup, shutdown, configuration changes, service failures, and security alerts**.

**2.3 Log Protection and Integrity**

- **Encrypt stored logs** to protect sensitive information.

- Implement **tamper-evident logging** (append-only storage, cryptographic hashing, or write-once storage).

- Restrict log access to authorized personnel only.

**2.4 Centralized Logging and Monitoring**

- Aggregate logs in a **centralized system** (e.g., SIEM) for easier monitoring and correlation.

- Define **log retention policies** in line with legal and operational requirements.

- Monitor dashboards for security-relevant trends.

**2.5 Alerting Mechanisms**

- Implement alerting for **critical events and anomalies** (e.g., multiple failed logins, privilege escalation, unusual data access, configuration changes).

- Route alerts to responsible teams with clear **escalation procedures**.

**3. Data Backups**

- **Regular backups:** Schedule automated **full and incremental** backups according to a defined **RPO/RTO**.

- **Backup encryption:** Encrypt backups **at rest and in transit**.

- **Offsite and immutable copies:** Follow the **3-2-1 rule** (3 copies, 2 media types, 1 offsite) and keep at least one **immutable** copy to resist ransomware.

- **Access control:** Restrict backup access to authorized administrators only.

- **Restoration testing:** Periodically test backup restoration to verify integrity and recoverability.

- **Audit logging:** Log all backup and restore operations.

- **Secure disposal:** Securely wipe or destroy backup media at end of life.

**4. Application and Data Security Controls**

**4.1 Input Validation and Output Encoding**

- Validate all input on the **server side** (never rely on client-side validation alone).

- Use **parameterized queries** to prevent SQL injection.

- Apply **output encoding** to prevent cross-site scripting (XSS).

- Enforce allow-lists for file uploads (type, size, content).

**4.2 Secure Error Handling**

- Return **generic error messages** to users; never expose stack traces, database errors, or internal paths.

- Log detailed errors internally for debugging.

**4.3 Security Headers**

- Enable **HSTS**, **Content Security Policy (CSP)**, **X-Content-Type-Options**, **X-Frame-Options**, and **Referrer-Policy**.

**4.4 Data Protection**

- Encrypt sensitive data **at rest** (databases, file storage) and **in transit** (TLS 1.2+, preferably TLS 1.3).

- Classify data (public, internal, confidential, restricted) and apply controls accordingly.

- Mask or pseudonymize personal data in non-production environments.

- Define **data retention and secure deletion** policies.

**4.5 API and Endpoint Security**

- Authenticate and authorize **every API request**.

- Apply **rate limiting** and **input size limits** on APIs.

- Use **mutual TLS (mTLS)** for service-to-service communication where appropriate.

- Document and restrict exposed endpoints.

**5. Secure Development and Testing**

**5.1 Secure Coding Practices**

- Follow secure coding standards (e.g., **OWASP ASVS**, **OWASP Top 10**).

- Conduct **peer code reviews** with a security focus.

- Avoid hard-coded credentials and insecure defaults.

**5.2 Security Testing**

- Perform **static application security testing (SAST)** and **dynamic application security testing (DAST)**.

- Conduct **dependency scanning** for known vulnerabilities.

- Perform **penetration testing** before major releases.

- Integrate security checks into the **CI/CD pipeline**.

**5.3 Secure Deployment**

- Use **staging environments** for testing before production deployment.

- Maintain **version control** and reproducible builds.

- Implement **rollback procedures** and verified backups before deployment.

**6. Incident Response and Business Continuity**

**6.1 Incident Response Plan**

- Define roles and responsibilities for incident handling.

- Establish procedures for **detection, containment, eradication, recovery, and post-incident review**.

- Maintain contact lists and escalation paths.

**6.2 Business Continuity and Disaster Recovery**

- Define **RPO and RTO** for critical systems.

- Document and test **disaster recovery procedures**.

- Maintain redundant infrastructure where required.

**6.3 Security Awareness Training**

- Train users on phishing, password hygiene, MFA, and incident reporting.

- Run periodic awareness campaigns and simulated phishing tests.

**8. Compliance and Governance**

- Identify applicable legal and regulatory requirements (e.g., data protection laws).

- Maintain **security policies** and **acceptable use policies**.

- Conduct **periodic security reviews and audits**.

- Track and remediate identified risks using a **risk register**.

- Document **change management** procedures for security-relevant changes
