# Runbook: Security Incident & Data Breach Containment

## 1. Trigger Conditions
- Unauthorized exfiltration of user database records or PII detected.
- WAF alert indicating SQL injection probe success or unauthorized DB credential usage.

## 2. Immediate Containment
1. Rotate all PostgreSQL database credentials, JWT signing secrets, and session cookie secrets immediately.
2. Terminate all active trader and admin sessions via global Redis token revocation.
3. Isolate affected microservice pods.
4. Trigger regulatory notification protocol (POPIA / GDPR compliance officer notification within statutory timeline).
5. Initiate forensic snapshot of database access logs and audit hash chain verification.
