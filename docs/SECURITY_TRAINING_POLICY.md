# Security Awareness Training Policy

> JCIL.AI Employee Security Training Program

**Document Version:** 1.0
**Last Updated:** January 2025
**Owner:** Security Team
**Review Frequency:** Annually

---

## 1. Purpose

This policy establishes security awareness training requirements for all JCIL.AI team members. The goal is to ensure everyone understands their role in protecting customer data and company assets.

---

## 2. Scope

This policy applies to:
- All employees (full-time and part-time)
- Contractors with system access
- Third-party developers
- Anyone with access to customer data or production systems

---

## 3. Training Requirements

### 3.1 New Hire Training

**Timeline:** Complete within first 7 days of employment

| Module | Duration | Required For |
|--------|----------|--------------|
| Security Fundamentals | 30 min | All |
| Data Handling | 20 min | All |
| Access Management | 15 min | All |
| Incident Reporting | 15 min | All |
| Developer Security | 45 min | Engineers only |

### 3.2 Annual Refresher Training

**Timeline:** Complete annually (anniversary of hire date)

| Module | Duration | Required For |
|--------|----------|--------------|
| Security Updates | 20 min | All |
| Threat Landscape | 15 min | All |
| Policy Review | 15 min | All |
| Phishing Awareness | 15 min | All |

### 3.3 Role-Based Training

| Role | Additional Training |
|------|---------------------|
| Engineers | Secure coding, OWASP Top 10, code review |
| DevOps | Infrastructure security, secrets management |
| Leadership | Incident command, regulatory requirements |
| Support | Customer data handling, social engineering |

---

## 4. Training Content

### Module 1: Security Fundamentals

**Topics:**
- Why security matters at JCIL.AI
- Our security principles and values
- Overview of threats facing AI companies
- Shared responsibility model
- Reporting security concerns

**Key Takeaways:**
1. Security is everyone's responsibility
2. When in doubt, ask the security team
3. No question is too small
4. Report suspicious activity immediately

### Module 2: Data Handling

**Topics:**
- Data classification (Public, Internal, Confidential, Restricted)
- Customer data protection requirements
- PII handling and GDPR basics
- Data minimization principles
- Secure data disposal

**Key Takeaways:**
1. Only access data you need for your job
2. Never share customer data externally
3. Don't store customer data on personal devices
4. Report data incidents immediately

**Data Classification Quick Reference:**

| Classification | Examples | Handling |
|----------------|----------|----------|
| Public | Marketing content, blog posts | No restrictions |
| Internal | Internal docs, architecture | Don't share externally |
| Confidential | Customer data, API keys | Encryption required |
| Restricted | Payment data, credentials | Maximum protection |

### Module 3: Access Management

**Topics:**
- Strong password requirements
- Multi-factor authentication (required)
- Principle of least privilege
- Account sharing prohibition
- Access request process

**Requirements:**
- [ ] MFA enabled on all accounts
- [ ] Unique passwords per service
- [ ] Password manager required
- [ ] Never share credentials
- [ ] Report lost/stolen devices immediately

### Module 4: Incident Reporting

**Topics:**
- What constitutes a security incident
- How to report incidents
- What information to include
- Escalation procedures
- Post-incident expectations

**Report To:** security@jcil.ai or Slack #security-incidents

**What to Report:**
- Suspicious emails or phishing attempts
- Unauthorized access attempts
- Lost or stolen devices
- Accidental data exposure
- Unusual system behavior
- Policy violations observed

### Module 5: Developer Security (Engineers Only)

**Topics:**
- Secure coding practices
- OWASP Top 10 vulnerabilities
- Input validation requirements
- Secret management
- Dependency security
- Code review for security
- Security testing

**Key Practices:**
1. Validate all user input (use Zod schemas)
2. Never commit secrets to Git
3. Use parameterized queries
4. Review dependencies for vulnerabilities
5. Follow secure code review checklist

---

## 5. Phishing Awareness

### Recognizing Phishing

**Red Flags:**
- Urgent or threatening language
- Requests for credentials or sensitive data
- Unexpected attachments
- Mismatched sender addresses
- Suspicious links (hover to check)
- Poor grammar or spelling

### What To Do

**If you receive a suspicious email:**
1. Don't click any links
2. Don't download attachments
3. Don't reply
4. Report to security@jcil.ai
5. Delete the email

**If you clicked a phishing link:**
1. Disconnect from network immediately
2. Report to security@jcil.ai
3. Change affected passwords
4. Don't feel embarrassed - report it!

---

## 6. Physical Security

### Device Security

- [ ] Screen lock enabled (< 5 min timeout)
- [ ] Full disk encryption enabled
- [ ] Remote wipe capability enabled
- [ ] Strong device password/biometrics
- [ ] Keep devices with you or locked

### Working Remotely

- Use VPN when on public WiFi
- Don't work on sensitive data in public
- Be aware of shoulder surfing
- Secure home network
- Separate work and personal devices

---

## 7. Social Engineering

### Common Tactics

| Tactic | Example | Defense |
|--------|---------|---------|
| Pretexting | "I'm from IT, I need your password" | Verify identity, never share passwords |
| Baiting | "Free USB drive in parking lot" | Never use unknown devices |
| Tailgating | Following someone through a door | Challenge unknown individuals |
| Quid Pro Quo | "Help with this and I'll help you" | Verify through official channels |

### Defense Principles

1. **Verify** - Confirm identity through known channels
2. **Question** - Be skeptical of unusual requests
3. **Report** - Notify security of attempts
4. **Protect** - Never share sensitive information

---

## 8. Training Tracking

### Completion Records

| Information Tracked | Retention |
|---------------------|-----------|
| Training completed | 3 years |
| Completion date | 3 years |
| Score/assessment | 3 years |
| Acknowledgments | 3 years |

### Training Record Template

```
Employee: [Name]
Role: [Title]
Start Date: [Date]

TRAINING RECORD
───────────────────────────────────────
Module                    Date    Score
───────────────────────────────────────
Security Fundamentals     [Date]  Pass
Data Handling             [Date]  Pass
Access Management         [Date]  Pass
Incident Reporting        [Date]  Pass
Developer Security        [Date]  Pass
───────────────────────────────────────

Annual Refresher
───────────────────────────────────────
Year    Date Completed    Score
───────────────────────────────────────
2025    [Date]           Pass
───────────────────────────────────────

Signature: ________________________
Date: ____________________________
```

---

## 9. Acknowledgment

All team members must acknowledge this policy:

```
SECURITY TRAINING ACKNOWLEDGMENT

I, _________________________, acknowledge that I have:

□ Completed all required security awareness training
□ Read and understood the security policies
□ Understand my responsibility to protect customer data
□ Know how to report security incidents
□ Will complete annual refresher training

I understand that failure to comply with security policies
may result in disciplinary action.

Signature: ________________________
Date: ____________________________
```

---

## 10. Non-Compliance

### Consequences

| Violation | First Occurrence | Repeat |
|-----------|------------------|--------|
| Training not completed | Reminder + deadline | Access suspended |
| Minor policy violation | Verbal warning | Written warning |
| Serious violation | Written warning | Termination |
| Intentional data breach | Termination | Legal action |

### Appeals

Team members may appeal consequences to leadership within 5 business days.

---

## 11. Resources

### Quick Reference Cards

**Security Contact:**
- Email: security@jcil.ai
- Slack: #security-incidents
- Emergency: [Phone number]

**Report Phishing:**
Forward suspicious emails to security@jcil.ai

**Password Manager:**
[Company-approved password manager]

### Additional Resources

- OWASP Top 10: owasp.org/Top10
- Phishing Quiz: phishingquiz.withgoogle.com
- Security Blog: [Internal resource]

---

## 12. Policy Review

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Security Team | Initial version |

**Next Review:** January 2026

---

## Appendix A: Training Schedule Template

```
QUARTERLY TRAINING SCHEDULE

Q1 (Jan-Mar)
- New hire training (as needed)
- Phishing simulation exercise
- Developer security workshop

Q2 (Apr-Jun)
- Annual refresher (anniversaries in Q2)
- Security policy review
- Incident response tabletop

Q3 (Jul-Sep)
- Annual refresher (anniversaries in Q3)
- Social engineering awareness
- Password hygiene reminder

Q4 (Oct-Nov)
- Annual refresher (anniversaries in Q4)
- Year-end security review
- Policy updates for new year
```

---

## Appendix B: Security Checklist

### Daily
- [ ] Lock screen when away
- [ ] Check for suspicious emails
- [ ] Report anything unusual

### Weekly
- [ ] Review access logs (if applicable)
- [ ] Check for software updates
- [ ] Backup important work

### Monthly
- [ ] Review account access
- [ ] Check for unused applications
- [ ] Review shared file permissions

### Annually
- [ ] Complete refresher training
- [ ] Update emergency contacts
- [ ] Review and clean up old files
- [ ] Verify backup restoration works

---

*This document is confidential and intended for internal use only.*
