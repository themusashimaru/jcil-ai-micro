# Business Continuity Plan

> JCIL.AI Disaster Recovery and Business Continuity Procedures

**Document Version:** 1.0
**Last Updated:** January 2025
**Owner:** Operations Team
**Review Frequency:** Annually

---

## 1. Purpose

This Business Continuity Plan (BCP) ensures JCIL.AI can maintain critical operations during and after a disaster or major disruption. It defines recovery objectives, procedures, and responsibilities.

---

## 2. Scope

This plan covers:
- Production application and infrastructure
- Customer data and conversations
- Payment processing systems
- Authentication services
- AI processing capabilities

---

## 3. Recovery Objectives

### Recovery Time Objective (RTO)

Maximum acceptable downtime before business impact becomes critical.

| System | RTO | Priority |
|--------|-----|----------|
| Authentication | 1 hour | Critical |
| Chat API | 2 hours | Critical |
| Payment Processing | 4 hours | High |
| Admin Dashboard | 8 hours | Medium |
| Code Lab | 8 hours | Medium |
| Document Generation | 24 hours | Low |

### Recovery Point Objective (RPO)

Maximum acceptable data loss measured in time.

| Data Type | RPO | Backup Frequency |
|-----------|-----|------------------|
| User accounts | 1 hour | Real-time replication |
| Conversations | 24 hours | Daily backup |
| Payment records | 0 (no loss) | Real-time via Stripe |
| Code Lab sessions | 24 hours | Daily backup |
| System logs | 7 days | Daily backup |

---

## 4. Critical Systems Inventory

### Infrastructure Components

| Component | Provider | Criticality | Failover |
|-----------|----------|-------------|----------|
| Application Hosting | Vercel | Critical | Multi-region automatic |
| Database | Supabase | Critical | Point-in-time recovery |
| Redis Cache | Upstash | High | In-memory fallback |
| AI Provider | Anthropic | Critical | Dual-pool API keys |
| Payments | Stripe | High | Stripe-managed redundancy |
| Code Sandbox | E2B | Medium | Graceful degradation |

### Dependencies

```
JCIL.AI Application
├── Vercel (Hosting)
│   └── Status: status.vercel.com
├── Supabase (Database + Auth)
│   └── Status: status.supabase.com
├── Anthropic (AI)
│   └── Status: status.anthropic.com
├── Upstash (Redis)
│   └── Status: status.upstash.com
├── Stripe (Payments)
│   └── Status: status.stripe.com
└── E2B (Sandboxing)
    └── Status: e2b.dev/status
```

---

## 5. Disaster Scenarios

### Scenario 1: Cloud Provider Outage (Vercel)

**Impact:** Application inaccessible
**Likelihood:** Low
**RTO:** 2-4 hours

**Response:**
1. Confirm outage via status.vercel.com
2. Communicate to customers via email/social
3. Monitor for resolution
4. Vercel handles failover automatically

**Alternative (if prolonged > 24 hours):**
- Deploy to backup provider (Netlify/Railway)
- Update DNS to point to backup

### Scenario 2: Database Outage (Supabase)

**Impact:** All data operations fail
**Likelihood:** Low
**RTO:** 1-2 hours

**Response:**
1. Confirm outage via status.supabase.com
2. Enable read-only mode if possible
3. Supabase handles failover
4. Point-in-time recovery available

**Recovery:**
```bash
# Supabase provides automated recovery
# Access via Supabase Dashboard > Database > Backups
# Restore to point-in-time within retention window
```

### Scenario 3: AI Provider Outage (Anthropic)

**Impact:** Chat functionality degraded
**Likelihood:** Low
**RTO:** Immediate failover

**Response:**
1. Dual-pool API keys provide automatic failover
2. If complete outage, return user-friendly message
3. Queue requests for retry

**Automatic Handling:**
```typescript
// Already implemented in codebase
Primary Pool → Rate limited? → Fallback Pool → All exhausted? → User message
```

### Scenario 4: Data Breach

**Impact:** Customer trust, regulatory
**Likelihood:** Low
**RTO:** Containment < 1 hour

**Response:**
1. Follow Incident Response Plan
2. Contain breach immediately
3. Assess data impact
4. Notify customers within 72 hours
5. Notify regulators as required

### Scenario 5: Ransomware

**Impact:** Complete system compromise
**Likelihood:** Very Low
**RTO:** 4-24 hours

**Response:**
1. Isolate affected systems
2. Do NOT pay ransom
3. Restore from clean backups
4. Rotate all credentials
5. Conduct forensic investigation

**Recovery:**
- Supabase: Restore from daily backup
- Vercel: Redeploy from Git (source of truth)
- Redis: Ephemeral, rebuild automatically

### Scenario 6: Key Personnel Unavailable

**Impact:** Delayed response
**Likelihood:** Medium
**RTO:** N/A

**Mitigation:**
- Document all procedures (this document)
- Cross-train team members
- Maintain updated contact list
- Use password manager with emergency access

---

## 6. Backup Procedures

### Database Backups (Supabase)

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Automatic | Daily | 7 days | Supabase infrastructure |
| Point-in-time | Continuous | 7 days | Supabase infrastructure |
| Manual export | Weekly | 30 days | Secure offsite storage |

**Manual Backup Procedure:**
```bash
# Export database via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql

# Store securely (encrypted)
gpg -c backup_$(date +%Y%m%d).sql
# Upload to secure storage
```

### Application Code

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Git repository | Real-time | Permanent | GitHub |
| Deployment snapshots | Per deploy | 30 days | Vercel |

**Code is always recoverable from Git.**

### Secrets and Configuration

| Type | Storage | Backup |
|------|---------|--------|
| API Keys | Vercel Environment | Password manager |
| Database credentials | Vercel Environment | Password manager |
| Encryption keys | Vercel Environment | Secure offsite |

---

## 7. Recovery Procedures

### Procedure 1: Database Recovery

**When to use:** Data corruption, accidental deletion, ransomware

**Steps:**
1. Log into Supabase Dashboard
2. Navigate to Database > Backups
3. Select recovery point (before incident)
4. Click "Restore"
5. Verify data integrity
6. Update application if schema changed

**Verification:**
```sql
-- Check user count
SELECT COUNT(*) FROM users;

-- Check recent conversations
SELECT COUNT(*) FROM conversations
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Verify no data corruption
SELECT * FROM users LIMIT 10;
```

### Procedure 2: Full Application Recovery

**When to use:** Complete infrastructure failure, starting fresh

**Steps:**
1. **Verify Git access**
   ```bash
   git clone https://github.com/themusashimaru/jcil-ai-micro.git
   ```

2. **Set up new Vercel project**
   - Connect to Git repository
   - Configure environment variables from backup

3. **Restore database**
   - Create new Supabase project (or restore existing)
   - Run migrations
   - Restore data from backup

4. **Configure DNS**
   - Update DNS to point to new deployment
   - Verify SSL certificates

5. **Verify functionality**
   - Test authentication
   - Test chat functionality
   - Test payment processing
   - Test admin functions

### Procedure 3: API Key Rotation

**When to use:** Suspected key compromise, regular rotation

**Steps:**
1. Generate new keys from provider dashboards
2. Update Vercel environment variables
3. Trigger redeployment
4. Verify functionality
5. Revoke old keys

**Key Rotation Checklist:**
- [ ] ANTHROPIC_API_KEY (and numbered variants)
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] ENCRYPTION_KEY (requires data re-encryption)
- [ ] E2B_API_KEY
- [ ] PERPLEXITY_API_KEY

---

## 8. Communication Plan

### Internal Communication

| Event | Channel | Audience | Timing |
|-------|---------|----------|--------|
| Outage detected | Slack #incidents | Tech team | Immediate |
| Major incident | Phone + Slack | All team | < 15 min |
| Status update | Slack | All team | Every 30 min |
| Resolution | Email + Slack | All team | Upon resolution |

### External Communication

| Event | Channel | Audience | Timing |
|-------|---------|----------|--------|
| Outage > 1 hour | Email + Status page | Affected customers | < 1 hour |
| Data breach | Email | All customers | < 72 hours |
| Scheduled maintenance | Email | All customers | 48 hours prior |
| Resolution | Email + Status page | Affected customers | Upon resolution |

### Communication Templates

**Outage Notification:**
```
Subject: JCIL.AI Service Disruption

We are currently experiencing a service disruption affecting [affected services].

Our team is actively working to resolve this issue.

Current Status: Investigating / Identified / Fixing
Estimated Resolution: [Time if known]

We apologize for any inconvenience and will provide updates every 30 minutes.

- JCIL.AI Team
```

**Resolution Notification:**
```
Subject: JCIL.AI Service Restored

The service disruption affecting [affected services] has been resolved.

Duration: [Start time] to [End time]
Root Cause: [Brief description]
Prevention: [What we're doing to prevent recurrence]

Thank you for your patience.

- JCIL.AI Team
```

---

## 9. Testing Schedule

### Test Types

| Test | Frequency | Description | Owner |
|------|-----------|-------------|-------|
| Backup verification | Monthly | Verify backups are complete and restorable | Engineering |
| Recovery drill | Quarterly | Practice database restoration | Engineering |
| Tabletop exercise | Semi-annually | Walk through disaster scenarios | All team |
| Full DR test | Annually | Complete recovery to alternate environment | Engineering |

### Test Documentation

Each test must document:
- Date and participants
- Scenario tested
- Steps performed
- Issues encountered
- Time to recovery
- Lessons learned
- Action items

---

## 10. Roles and Responsibilities

### During Normal Operations

| Role | Responsibility |
|------|----------------|
| Engineering | Monitor systems, maintain backups, update procedures |
| Operations | Manage vendor relationships, maintain documentation |
| Leadership | Approve budget, review test results, strategic decisions |

### During an Incident

| Role | Responsibility |
|------|----------------|
| Incident Commander | Overall coordination, final decisions |
| Technical Lead | Investigation, recovery execution |
| Communications | Customer and stakeholder updates |

---

## 11. Vendor Contacts

| Vendor | Support Channel | SLA |
|--------|-----------------|-----|
| Vercel | support.vercel.com | Pro plan SLA |
| Supabase | supabase.com/support | Pro plan SLA |
| Anthropic | support@anthropic.com | Enterprise support |
| Stripe | stripe.com/support | 24/7 support |
| Upstash | upstash.com/support | Pro plan SLA |

---

## 12. Document Maintenance

### Review Triggers

- After any disaster or major incident
- After significant infrastructure changes
- After adding new critical systems
- Annually (minimum)

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Operations | Initial version |

---

## Appendix A: Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERGENCY QUICK REFERENCE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ASSESS THE SITUATION                                        │
│     □ What systems are affected?                                │
│     □ Is customer data at risk?                                 │
│     □ What is the business impact?                              │
│                                                                  │
│  2. NOTIFY THE TEAM                                             │
│     □ Slack: #incidents                                         │
│     □ Phone: Incident Commander                                 │
│                                                                  │
│  3. CHECK PROVIDER STATUS PAGES                                 │
│     □ status.vercel.com                                         │
│     □ status.supabase.com                                       │
│     □ status.anthropic.com                                      │
│                                                                  │
│  4. FOLLOW APPROPRIATE PLAYBOOK                                 │
│     □ Database issue → Procedure 1                              │
│     □ Full recovery → Procedure 2                               │
│     □ Key compromise → Procedure 3                              │
│                                                                  │
│  5. COMMUNICATE                                                 │
│     □ Internal updates every 30 min                             │
│     □ Customer notification if > 1 hour                         │
│                                                                  │
│  6. DOCUMENT EVERYTHING                                         │
│     □ Timeline of events                                        │
│     □ Actions taken                                             │
│     □ Lessons learned                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Recovery Checklist

```
PRE-RECOVERY
□ Incident contained
□ Root cause identified (if possible)
□ Recovery approach approved
□ Team assembled

DATABASE RECOVERY
□ Identify recovery point
□ Initiate Supabase restore
□ Verify data integrity
□ Test application connectivity

APPLICATION RECOVERY
□ Verify Git repository accessible
□ Redeploy to Vercel
□ Verify environment variables
□ Test all critical functions

POST-RECOVERY
□ Monitor for issues
□ Communicate resolution
□ Document incident
□ Schedule post-mortem
□ Update procedures if needed
```

---

*This document is confidential and intended for internal use only.*
