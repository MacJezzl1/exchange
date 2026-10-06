# Compliance & Regulatory Architecture

## 1. Regulatory Framework & Jurisdiction Strategy

The Platform separates the **non-custodial trading path** from the **fiat custody path**, enabling modular phased rollouts matching jurisdiction-specific licensing status.

### 1.1 South Africa (Initial Wedge)
- **Financial Sector Conduct Authority (FSCA)**:
  - Cryptographic assets are declared financial products under FAIS.
  - Crypto Asset Service Provider (CASP) license is required for custodial crypto and intermediary broker services.
  - Non-custodial matching where users retain keys in on-chain vaults reduces direct custody exposure, but order routing and fiat on/off ramps require CASP and FIC registration.
- **Financial Intelligence Centre (FIC)**:
  - Mandatory registration as an Accountable Institution (Item 22 of Schedule 1 to the FIC Act).
  - Implementation of a Risk Management and Compliance Programme (RMCP).
  - Customer Due Diligence (CDD / FICA KYC), screening against targeted financial sanctions (UN / TFS), and reporting of suspicious and unusual transactions (Section 29 STR/SAR).
  - Cash Threshold Reporting (CTR) and compliance with the FATF Travel Rule for crypto transfers above statutory limits.
- **POPIA (Protection of Personal Information Act)**:
  - Lawful processing of Personal Identifiable Information (PII).
  - Field-level AES-256 encryption of user identity documents.
  - Role-based masked data access for customer support with logged unmasking.

### 1.2 Non-Custodial Core vs. Custodial Fiat Separation
```
+------------------------------------+------------------------------------+
| NON-CUSTODIAL TRADING PATH         | CUSTODIAL FIAT RAILS PATH          |
+------------------------------------+------------------------------------+
| - Users self-custody funds in vault| - Partnered with licensed banks    |
| - EIP-712 off-chain signed orders  | - Instant EFT & Mobile Money rails |
| - On-chain batch settlement proofs | - Strict KYC (L1-L3) & Sanctions   |
| - Can launch globally on testnet   | - Gated strictly per jurisdiction  |
|   without regional banking licenses|   once local regulatory license is |
|                                    |   formally granted.                |
+------------------------------------+------------------------------------+
```
