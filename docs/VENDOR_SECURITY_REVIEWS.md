# Vendor Security Reviews

> JCIL.AI Third-Party Vendor Security Assessment

**Document Version:** 1.0
**Last Updated:** January 2025
**Owner:** Security Team
**Review Frequency:** Annually

---

## 1. Purpose

This document provides security assessments of all third-party vendors that process, store, or have access to JCIL.AI customer data or critical infrastructure. Vendor security is reviewed annually and upon significant changes.

---

## 2. Vendor Risk Classification

| Risk Level   | Criteria                                     | Review Frequency      |
| ------------ | -------------------------------------------- | --------------------- |
| **Critical** | Processes customer data, core infrastructure | Annually + on changes |
| **High**     | Access to systems, payment processing        | Annually              |
| **Medium**   | Development tools, monitoring                | Every 2 years         |
| **Low**      | No data access, replaceable services         | As needed             |

---

## 3. Critical Vendor Assessments

### 3.1 Anthropic (AI Provider)

| Attribute          | Details                                         |
| ------------------ | ----------------------------------------------- |
| **Service**        | Claude AI API (Haiku 4.5, Sonnet 4.6, Opus 4.5) |
| **Risk Level**     | Critical                                        |
| **Data Processed** | User prompts, conversation content              |
| **Last Review**    | January 2025                                    |

#### Compliance & Certifications

| Certification  | Status       | Verified |
| -------------- | ------------ | -------- |
| SOC 2 Type II  | ✅ Certified | Jan 2025 |
| HIPAA Eligible | ✅ Yes       | Jan 2025 |
| GDPR Compliant | ✅ Yes       | Jan 2025 |

#### Security Controls

| Control               | Implementation                         |
| --------------------- | -------------------------------------- |
| **Data Handling**     | API inputs not used for training       |
| **Encryption**        | TLS 1.2+ in transit, AES-256 at rest   |
| **Access Control**    | API key authentication, rate limiting  |
| **Data Retention**    | 30-day log retention, configurable     |
| **Incident Response** | 24/7 security team, public status page |

#### Why We Chose Anthropic

- **Industry-leading AI safety** with Constitutional AI
- **No training on customer data** - explicit policy
- **SOC 2 Type II certified** infrastructure
- **HIPAA eligible** for healthcare data
- **Transparent research** and safety publications

#### Risk Assessment

| Risk           | Likelihood | Impact | Mitigation                 |
| -------------- | ---------- | ------ | -------------------------- |
| Data breach    | Low        | High   | SOC 2 controls, encryption |
| Service outage | Low        | Medium | Dual-pool API keys         |
| Model safety   | Very Low   | Medium | Constitutional AI, testing |

**Overall Risk: LOW**

---

### 3.2 Supabase (Database & Authentication)

| Attribute          | Details                                      |
| ------------------ | -------------------------------------------- |
| **Service**        | PostgreSQL database, authentication, storage |
| **Risk Level**     | Critical                                     |
| **Data Processed** | All customer data, credentials               |
| **Last Review**    | January 2025                                 |

#### Compliance & Certifications

| Certification  | Status              | Verified |
| -------------- | ------------------- | -------- |
| SOC 2 Type II  | ✅ Certified        | Jan 2025 |
| HIPAA Eligible | ✅ Yes (Enterprise) | Jan 2025 |
| GDPR Compliant | ✅ Yes              | Jan 2025 |

#### Security Controls

| Control            | Implementation                          |
| ------------------ | --------------------------------------- |
| **Encryption**     | TLS in transit, AES-256 at rest         |
| **Access Control** | Row-Level Security, role-based access   |
| **Backup**         | Daily automatic, point-in-time recovery |
| **Network**        | VPC isolation, SSL-only connections     |
| **Monitoring**     | Real-time logging, anomaly detection    |

#### Data Residency

- Primary: AWS US regions
- Backups: Encrypted, same region
- GDPR: EU region available if needed

#### Risk Assessment

| Risk           | Likelihood | Impact   | Mitigation             |
| -------------- | ---------- | -------- | ---------------------- |
| Data breach    | Low        | Critical | RLS, encryption, SOC 2 |
| Data loss      | Very Low   | Critical | Daily backups, PITR    |
| Service outage | Low        | High     | Multi-AZ, failover     |

**Overall Risk: LOW**

---

### 3.3 Vercel (Application Hosting)

| Attribute          | Details                                       |
| ------------------ | --------------------------------------------- |
| **Service**        | Application hosting, edge network, serverless |
| **Risk Level**     | Critical                                      |
| **Data Processed** | Application code, environment secrets         |
| **Last Review**    | January 2025                                  |

#### Compliance & Certifications

| Certification  | Status       | Verified |
| -------------- | ------------ | -------- |
| SOC 2 Type II  | ✅ Certified | Jan 2025 |
| GDPR Compliant | ✅ Yes       | Jan 2025 |
| ISO 27001      | ✅ Certified | Jan 2025 |

#### Security Controls

| Control            | Implementation                            |
| ------------------ | ----------------------------------------- |
| **Encryption**     | TLS 1.3, automatic HTTPS                  |
| **Secrets**        | Encrypted environment variables           |
| **DDoS**           | Edge-level protection included            |
| **Access Control** | Team-based permissions, SSO available     |
| **Deployment**     | Immutable deployments, rollback available |

#### Risk Assessment

| Risk           | Likelihood | Impact | Mitigation                        |
| -------------- | ---------- | ------ | --------------------------------- |
| Code exposure  | Very Low   | High   | Encrypted storage, access control |
| DDoS attack    | Medium     | Medium | Built-in protection               |
| Service outage | Low        | High   | Global edge, redundancy           |

**Overall Risk: LOW**

---

### 3.4 Stripe (Payment Processing)

| Attribute          | Details                                 |
| ------------------ | --------------------------------------- |
| **Service**        | Payment processing, subscriptions       |
| **Risk Level**     | High                                    |
| **Data Processed** | Payment information (handled by Stripe) |
| **Last Review**    | January 2025                            |

#### Compliance & Certifications

| Certification   | Status       | Verified |
| --------------- | ------------ | -------- |
| PCI DSS Level 1 | ✅ Certified | Jan 2025 |
| SOC 2 Type II   | ✅ Certified | Jan 2025 |
| GDPR Compliant  | ✅ Yes       | Jan 2025 |

#### Security Controls

| Control        | Implementation                        |
| -------------- | ------------------------------------- |
| **Card Data**  | Never touches our servers (Stripe.js) |
| **Encryption** | End-to-end encryption                 |
| **Fraud**      | Radar fraud detection                 |
| **Webhooks**   | Signature verification                |

#### Data Flow

```
Customer → Stripe.js → Stripe Servers → Webhook to JCIL.AI
                                              │
                                              ▼
                                    Only subscription status
                                    (no card data)
```

**We never see or store payment card data.**

#### Risk Assessment

| Risk          | Likelihood | Impact | Mitigation                  |
| ------------- | ---------- | ------ | --------------------------- |
| Payment fraud | Low        | Medium | Stripe Radar                |
| Data breach   | Very Low   | Low    | No card data on our systems |

**Overall Risk: VERY LOW**

---

## 4. High-Risk Vendor Assessments

### 4.1 Upstash (Redis Cache)

| Attribute          | Details                          |
| ------------------ | -------------------------------- |
| **Service**        | Serverless Redis                 |
| **Risk Level**     | High                             |
| **Data Processed** | Rate limits, cache, session data |
| **Last Review**    | January 2025                     |

#### Compliance & Certifications

| Certification | Status       | Verified |
| ------------- | ------------ | -------- |
| SOC 2 Type II | ✅ Certified | Jan 2025 |

#### Security Controls

| Control        | Implementation                    |
| -------------- | --------------------------------- |
| **Encryption** | TLS in transit, encrypted at rest |
| **Access**     | Token-based authentication        |
| **Isolation**  | Per-database isolation            |

#### Data Stored

- Rate limiting counters (no PII)
- Cache entries (ephemeral)
- Queue state (request IDs only)

**Note:** Fallback to in-memory if unavailable.

**Overall Risk: LOW**

---

### 4.2 E2B (Code Sandbox)

| Attribute          | Details                     |
| ------------------ | --------------------------- |
| **Service**        | Sandboxed code execution    |
| **Risk Level**     | High                        |
| **Data Processed** | User code, execution output |
| **Last Review**    | January 2025                |

#### Security Controls

| Control       | Implementation                 |
| ------------- | ------------------------------ |
| **Isolation** | Per-execution VM isolation     |
| **Network**   | No egress to external networks |
| **Cleanup**   | Automatic after execution      |
| **Limits**    | CPU, memory, time limits       |

#### Risk Assessment

| Risk           | Likelihood | Impact | Mitigation      |
| -------------- | ---------- | ------ | --------------- |
| Code escape    | Very Low   | Medium | VM isolation    |
| Resource abuse | Low        | Low    | Limits enforced |

**Overall Risk: LOW**

---

### 4.3 Perplexity (Web Search)

| Attribute          | Details               |
| ------------------ | --------------------- |
| **Service**        | AI-powered web search |
| **Risk Level**     | Medium                |
| **Data Processed** | Search queries        |
| **Last Review**    | January 2025          |

#### Security Controls

| Control            | Implementation                      |
| ------------------ | ----------------------------------- |
| **Encryption**     | TLS in transit                      |
| **Data Retention** | Query logs (standard API retention) |

#### Data Flow

- Only search queries sent
- No customer PII included
- Results cached locally

**Overall Risk: LOW**

---

## 5. Medium-Risk Vendors

### 5.1 GitHub (Source Control)

| Attribute      | Details                       |
| -------------- | ----------------------------- |
| **Service**    | Git repository hosting        |
| **Compliance** | SOC 2 Type II                 |
| **Data**       | Source code, no customer data |

**Risk: LOW**

### 5.2 Dependabot (Vulnerability Scanning)

| Attribute    | Details                           |
| ------------ | --------------------------------- |
| **Service**  | Dependency vulnerability scanning |
| **Provider** | GitHub (included)                 |
| **Data**     | Package manifests only            |

**Risk: VERY LOW**

---

## 6. Vendor Security Requirements

All critical and high-risk vendors must meet:

| Requirement           | Minimum Standard            |
| --------------------- | --------------------------- |
| Encryption in Transit | TLS 1.2+                    |
| Encryption at Rest    | AES-256 or equivalent       |
| Access Control        | Role-based, least privilege |
| Compliance            | SOC 2 Type II or equivalent |
| Incident Response     | Documented process          |
| Data Processing       | Clear DPA available         |

---

## 7. Vendor Management Process

### New Vendor Onboarding

1. Complete security questionnaire
2. Review certifications and compliance
3. Assess data access requirements
4. Review DPA/contract terms
5. Document in this register
6. Approve by Security Lead

### Annual Review

1. Verify certifications still valid
2. Review any security incidents
3. Assess continued business need
4. Update risk assessment
5. Document review date

### Vendor Offboarding

1. Revoke all access/API keys
2. Confirm data deletion
3. Obtain deletion confirmation
4. Update this register
5. Archive for 7 years

---

## 8. Data Processing Agreements

| Vendor    | DPA Status | Location                    |
| --------- | ---------- | --------------------------- |
| Anthropic | ✅ Signed  | Enterprise agreement        |
| Supabase  | ✅ Signed  | Terms of Service            |
| Vercel    | ✅ Signed  | Terms of Service            |
| Stripe    | ✅ Signed  | Connected Account Agreement |
| Upstash   | ✅ Signed  | Terms of Service            |

---

## 9. Subprocessor List

For GDPR compliance, our subprocessors are:

| Subprocessor | Purpose             | Location   |
| ------------ | ------------------- | ---------- |
| Anthropic    | AI processing       | USA        |
| Supabase     | Database hosting    | USA (AWS)  |
| Vercel       | Application hosting | Global CDN |
| Stripe       | Payment processing  | USA        |
| Upstash      | Caching             | USA        |
| E2B          | Code execution      | USA        |

---

## 10. Review History

| Date     | Reviewer      | Changes                      |
| -------- | ------------- | ---------------------------- |
| Jan 2025 | Security Team | Initial comprehensive review |

**Next Review Due:** January 2026

---

## Appendix: Vendor Contact Information

| Vendor    | Security Contact       |
| --------- | ---------------------- |
| Anthropic | security@anthropic.com |
| Supabase  | security@supabase.io   |
| Vercel    | security@vercel.com    |
| Stripe    | security@stripe.com    |
| Upstash   | security@upstash.com   |

---

_This document is confidential and intended for internal use only._
