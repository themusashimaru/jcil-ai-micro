# Incident Response Plan

> JCIL.AI Security Incident Response Procedures

**Document Version:** 2.0
**Last Updated:** January 2026
**Owner:** Security Team
**Review Frequency:** Annually

> **January 2026 Update**: Enhanced audit logging capabilities now provide structured security event logging for SIEM integration. See `src/lib/logger.ts` for audit event types including `security.service_role_access`, `auth.login_attempt`, `session.join`, and more.

---

## 1. Purpose

This Incident Response Plan (IRP) establishes procedures for detecting, responding to, and recovering from security incidents affecting JCIL.AI systems, data, or operations. The goal is to minimize impact, preserve evidence, and restore normal operations as quickly as possible.

---

## 2. Scope

This plan applies to:

- All JCIL.AI production systems and infrastructure
- All employee and contractor access
- All customer data and intellectual property
- All third-party integrations (Anthropic, Supabase, Vercel, Stripe)

---

## 3. Incident Classification

### Severity Levels

| Level  | Name     | Description                                       | Response Time        | Examples                                                                        |
| ------ | -------- | ------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| **P1** | Critical | Active breach, data exfiltration, complete outage | Immediate (< 15 min) | Confirmed data breach, ransomware, total service down                           |
| **P2** | High     | Potential breach, significant degradation         | < 1 hour             | Suspicious access patterns, partial outage, vulnerability actively exploited    |
| **P3** | Medium   | Security concern, minor impact                    | < 4 hours            | Failed intrusion attempt, single user compromise, minor service degradation     |
| **P4** | Low      | Informational, no immediate impact                | < 24 hours           | Vulnerability disclosure, policy violation, suspicious but unconfirmed activity |

### Incident Categories

| Category               | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| **Data Breach**        | Unauthorized access to or exfiltration of customer/company data |
| **System Compromise**  | Unauthorized access to systems, malware, ransomware             |
| **Service Disruption** | DDoS, outage, degraded performance                              |
| **Access Violation**   | Unauthorized access attempts, credential compromise             |
| **Vulnerability**      | Discovery of exploitable security weakness                      |
| **Policy Violation**   | Employee/contractor security policy breach                      |

---

## 4. Incident Response Team

### Core Team

| Role                    | Responsibility                                          | Primary          | Backup          |
| ----------------------- | ------------------------------------------------------- | ---------------- | --------------- |
| **Incident Commander**  | Overall coordination, decisions, communications         | CEO/CTO          | Senior Engineer |
| **Technical Lead**      | Investigation, containment, remediation                 | Lead Engineer    | Senior Engineer |
| **Communications Lead** | Internal/external communications, customer notification | CEO              | Operations      |
| **Legal/Compliance**    | Legal guidance, regulatory notification                 | External Counsel | CEO             |

### Contact Information

```
INCIDENT HOTLINE: [Internal emergency contact]
EMAIL: security@jcil.ai
SLACK: #security-incidents (internal)
```

### Escalation Path

```
Engineer Discovers Issue
        │
        ▼
   Is it a security incident?
        │
   YES  │  NO
        │   └──► Normal bug/issue process
        ▼
  Notify Technical Lead
        │
        ▼
   Classify Severity (P1-P4)
        │
   ┌────┴────┐
   │         │
  P1/P2     P3/P4
   │         │
   ▼         ▼
Incident    Technical Lead
Commander   handles directly
notified
immediately
```

---

## 5. Incident Response Phases

### Phase 1: Detection & Identification

**Objective:** Identify and confirm the incident

**Actions:**

1. Receive alert or report
2. Gather initial information:
   - What happened?
   - When was it detected?
   - What systems/data affected?
   - Is it ongoing?
3. Classify severity level
4. Document in incident log
5. Notify appropriate team members

**Detection Sources:**

- Automated monitoring alerts
- Security log analysis
- User/customer reports
- Third-party notifications
- Vulnerability disclosures

### Phase 2: Containment

**Objective:** Limit the scope and impact of the incident

**Immediate Containment (Short-term):**

- Isolate affected systems
- Block malicious IPs/accounts
- Revoke compromised credentials
- Enable enhanced logging

**Actions by Incident Type:**

| Type                      | Containment Actions                                                       |
| ------------------------- | ------------------------------------------------------------------------- |
| **Data Breach**           | Revoke access tokens, rotate API keys, block exfiltration paths           |
| **System Compromise**     | Isolate system, preserve state, block network access                      |
| **DDoS**                  | Enable rate limiting, engage Vercel DDoS protection, block attack sources |
| **Credential Compromise** | Force password reset, revoke sessions, enable MFA                         |

**Evidence Preservation:**

- Capture system state before changes
- Preserve logs (do not delete/modify)
- Document all actions taken
- Screenshot suspicious activity

### Phase 3: Eradication

**Objective:** Remove the threat from the environment

**Actions:**

1. Identify root cause
2. Remove malware/backdoors
3. Patch vulnerabilities
4. Update security controls
5. Verify threat is eliminated

**Verification Checklist:**

- [ ] All compromised accounts identified and secured
- [ ] All malicious code/files removed
- [ ] All exploited vulnerabilities patched
- [ ] All backdoors/persistence mechanisms removed
- [ ] Enhanced monitoring in place

### Phase 4: Recovery

**Objective:** Restore normal operations safely

**Actions:**

1. Restore systems from clean backups if needed
2. Verify system integrity
3. Monitor for re-compromise
4. Gradually restore services
5. Verify customer data integrity

**Recovery Checklist:**

- [ ] Systems restored to known-good state
- [ ] All credentials rotated
- [ ] Security patches applied
- [ ] Monitoring verified working
- [ ] Services tested before full restoration
- [ ] Customer-facing services restored

### Phase 5: Post-Incident

**Objective:** Learn and improve

**Actions:**

1. Conduct post-incident review (within 5 business days)
2. Document lessons learned
3. Update security controls
4. Update this IRP if needed
5. Provide final report to stakeholders

**Post-Incident Review Agenda:**

1. Timeline of events
2. What worked well
3. What could be improved
4. Root cause analysis
5. Action items with owners and deadlines

---

## 6. Communication Procedures

### Internal Communications

| Severity | Notify                      | Method        | Timing          |
| -------- | --------------------------- | ------------- | --------------- |
| P1       | All team members            | Phone + Slack | Immediately     |
| P2       | Technical team + Leadership | Slack + Email | Within 1 hour   |
| P3       | Technical team              | Slack         | Within 4 hours  |
| P4       | Technical lead              | Email         | Within 24 hours |

### External Communications

**Customer Notification Required When:**

- Customer data confirmed accessed/exfiltrated
- Service outage > 4 hours
- Regulatory requirement triggered

**Notification Timeline:**

- Initial notification: Within 72 hours of confirmation
- Detailed notification: Within 30 days
- Final report: After investigation complete

**Notification Template:**

```
Subject: Security Notice from JCIL.AI

Dear [Customer],

We are writing to inform you of a security incident that may have
affected your account/data.

What Happened:
[Brief description]

What Information Was Involved:
[Types of data affected]

What We Are Doing:
[Actions taken]

What You Can Do:
[Recommended actions]

For More Information:
Contact security@jcil.ai

Sincerely,
JCIL.AI Security Team
```

### Regulatory Notification

| Regulation | Requirement                              | Timeline  |
| ---------- | ---------------------------------------- | --------- |
| GDPR       | DPA notification if EU data affected     | 72 hours  |
| CCPA       | AG notification if CA residents affected | Expedient |
| HIPAA      | HHS notification if PHI affected         | 60 days   |

---

## 7. Specific Incident Playbooks

### Playbook: Suspected Data Breach

```
1. IMMEDIATE (0-15 minutes)
   □ Confirm breach indicators
   □ Notify Incident Commander
   □ Preserve evidence (logs, screenshots)

2. CONTAINMENT (15-60 minutes)
   □ Identify affected data/systems
   □ Revoke compromised access
   □ Block exfiltration paths
   □ Rotate affected API keys

3. INVESTIGATION (1-24 hours)
   □ Determine scope of access
   □ Identify data accessed/exfiltrated
   □ Determine attack vector
   □ Identify affected customers

4. NOTIFICATION (24-72 hours)
   □ Prepare customer notification
   □ Notify regulators if required
   □ Prepare public statement if needed

5. REMEDIATION (Ongoing)
   □ Patch vulnerability
   □ Implement additional controls
   □ Monitor for further activity
```

### Playbook: Service Outage

```
1. IMMEDIATE (0-5 minutes)
   □ Confirm outage scope
   □ Check Vercel/Supabase status pages
   □ Notify technical team

2. DIAGNOSIS (5-30 minutes)
   □ Identify root cause
   □ Determine if security-related
   □ If DDoS: Enable enhanced protection

3. RECOVERY (30+ minutes)
   □ Implement fix or failover
   □ Verify service restoration
   □ Monitor for stability

4. COMMUNICATION
   □ Update status page
   □ Notify affected customers
   □ Post-mortem within 5 days
```

### Playbook: Compromised Credentials

```
1. IMMEDIATE
   □ Identify scope (which credentials)
   □ Determine if used maliciously

2. CONTAINMENT
   □ Revoke affected credentials immediately
   □ Force session termination
   □ Rotate API keys if affected

3. INVESTIGATION
   □ Review access logs for abuse
   □ Identify how credentials were compromised
   □ Check for data access/exfiltration

4. RECOVERY
   □ Issue new credentials
   □ Enable/verify MFA
   □ Notify affected users
```

---

## 8. Tools and Resources

### Logging and Monitoring

| System           | Purpose                       | Access             |
| ---------------- | ----------------------------- | ------------------ |
| Vercel Logs      | Application logs, deployments | Vercel Dashboard   |
| Supabase Logs    | Database queries, auth events | Supabase Dashboard |
| Application Logs | Structured security events    | Log aggregator     |

### Key Commands

```bash
# Check recent security events
grep -i "security\|error\|unauthorized" /logs/app.log

# List recent auth failures
# (via Supabase dashboard or API)

# Check rate limit violations
# (via Redis or application logs)
```

### External Resources

| Resource          | Purpose               | Contact               |
| ----------------- | --------------------- | --------------------- |
| Vercel Support    | Infrastructure issues | support.vercel.com    |
| Supabase Support  | Database issues       | supabase.com/support  |
| Anthropic Support | AI service issues     | support@anthropic.com |
| Legal Counsel     | Regulatory guidance   | [External counsel]    |

---

## 9. Training and Testing

### Training Requirements

| Role          | Training                                     | Frequency |
| ------------- | -------------------------------------------- | --------- |
| All Engineers | IRP overview, reporting procedures           | Annually  |
| Incident Team | Full IRP, tabletop exercises                 | Quarterly |
| Leadership    | Communication procedures, decision authority | Annually  |

### Testing Schedule

| Test Type         | Frequency     | Description                       |
| ----------------- | ------------- | --------------------------------- |
| Tabletop Exercise | Quarterly     | Walk through incident scenarios   |
| Technical Drill   | Semi-annually | Simulate actual incident response |
| Full Exercise     | Annually      | End-to-end incident simulation    |

---

## 10. Document Control

| Version | Date     | Author        | Changes         |
| ------- | -------- | ------------- | --------------- |
| 1.0     | Jan 2025 | Security Team | Initial version |

### Review Schedule

- **Next Review:** July 2025
- **Review Trigger:** After any P1/P2 incident, or significant system change

---

## Appendix A: Incident Log Template

```
INCIDENT ID: INC-[YYYY]-[###]
REPORTED BY:
DATE/TIME DETECTED:
DATE/TIME REPORTED:

CLASSIFICATION
- Severity: P1 / P2 / P3 / P4
- Category: [Data Breach / System Compromise / etc.]

DESCRIPTION
[What happened]

AFFECTED SYSTEMS
[List systems]

AFFECTED DATA
[Types and scope]

TIMELINE
[Chronological events]

ACTIONS TAKEN
[Response actions]

ROOT CAUSE
[If determined]

LESSONS LEARNED
[Post-incident]

STATUS: Open / Contained / Resolved / Closed
```

---

## Appendix B: Emergency Contacts

```
Internal:
- Incident Commander: [Phone]
- Technical Lead: [Phone]
- CEO: [Phone]

External:
- Vercel Support: support.vercel.com
- Supabase Support: supabase.com/support
- Legal Counsel: [Contact info]
- Cyber Insurance: [If applicable]
```

---

_This document is confidential and intended for internal use only._
