# Disaster Recovery Drill Template

> JCIL.AI Recovery Testing Documentation

---

## Drill Overview

| Field | Value |
|-------|-------|
| **Drill ID** | DR-[YYYY]-[###] |
| **Date** | [Date] |
| **Type** | Database Recovery / Full Recovery / Tabletop |
| **Participants** | [Names] |
| **Conductor** | [Name] |

---

## Pre-Drill Checklist

### Preparation (Complete Before Drill)

- [ ] Notify all participants of drill date/time
- [ ] Confirm access to backup systems
- [ ] Document current production state
- [ ] Prepare test environment (if applicable)
- [ ] Have rollback plan ready
- [ ] Notify customers if any impact expected

### Environment Verification

- [ ] Production systems stable
- [ ] Backups verified available
- [ ] Team members available
- [ ] Communication channels working

---

## Drill Scenarios

### Scenario A: Database Point-in-Time Recovery

**Objective:** Verify ability to restore database to a specific point in time

**Steps:**

1. **Document Current State**
   ```sql
   -- Record current counts
   SELECT COUNT(*) as user_count FROM users;
   SELECT COUNT(*) as conversation_count FROM conversations;
   SELECT MAX(created_at) as latest_record FROM messages;
   ```

   Results:
   - User count: _______
   - Conversation count: _______
   - Latest record: _______

2. **Initiate Recovery** (in test environment)
   - Log into Supabase Dashboard
   - Navigate to Database > Backups
   - Select recovery point: _______
   - Start recovery: [Time: ______]

3. **Monitor Recovery**
   - Recovery started: _______
   - Recovery completed: _______
   - Total duration: _______

4. **Verify Recovery**
   ```sql
   -- Verify data integrity
   SELECT COUNT(*) as user_count FROM users;
   SELECT COUNT(*) as conversation_count FROM conversations;
   ```

   Results match expected: [ ] Yes [ ] No

5. **Document Issues**
   - Issue 1: _______
   - Issue 2: _______

---

### Scenario B: Application Redeployment

**Objective:** Verify ability to redeploy application from Git

**Steps:**

1. **Verify Git Access**
   ```bash
   git clone https://github.com/themusashimaru/jcil-ai-micro.git
   cd jcil-ai-micro
   git log -1
   ```

   Latest commit: _______
   Access verified: [ ] Yes [ ] No

2. **Verify Environment Variables**
   - All required variables documented: [ ] Yes [ ] No
   - Backup of variables available: [ ] Yes [ ] No

3. **Test Deployment** (to preview/staging)
   - Deployment started: _______
   - Deployment completed: _______
   - Build successful: [ ] Yes [ ] No

4. **Verify Functionality**
   - [ ] Homepage loads
   - [ ] Authentication works
   - [ ] Chat API responds
   - [ ] Database connection works
   - [ ] Redis connection works

---

### Scenario C: API Key Rotation

**Objective:** Verify ability to rotate all API keys without downtime

**Steps:**

1. **Generate New Keys** (do NOT revoke old ones yet)
   - [ ] ANTHROPIC_API_KEY_1 (new): Generated
   - [ ] PERPLEXITY_API_KEY (new): Generated
   - [ ] Other keys as needed

2. **Update Environment**
   - [ ] Add new keys to Vercel
   - [ ] Trigger redeployment
   - [ ] Verify deployment successful

3. **Test New Keys**
   - [ ] Chat API working with new Anthropic key
   - [ ] Search working with new Perplexity key

4. **Revoke Old Keys**
   - [ ] Old keys revoked
   - [ ] Verify no service disruption

**Total Rotation Time:** _______

---

## Drill Execution Log

| Time | Action | Result | Notes |
|------|--------|--------|-------|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |

---

## Metrics

### Recovery Time

| Metric | Target | Actual | Met? |
|--------|--------|--------|------|
| Time to start recovery | < 15 min | | |
| Database recovery time | < 1 hour | | |
| Application redeployment | < 30 min | | |
| Full service restoration | < 2 hours | | |

### Recovery Point

| Metric | Target | Actual | Met? |
|--------|--------|--------|------|
| Data loss window | < 24 hours | | |
| Transaction loss | 0 | | |

---

## Issues Encountered

### Issue 1
- **Description:**
- **Impact:**
- **Resolution:**
- **Action Item:**

### Issue 2
- **Description:**
- **Impact:**
- **Resolution:**
- **Action Item:**

---

## Post-Drill Review

### What Went Well

1.
2.
3.

### What Needs Improvement

1.
2.
3.

### Action Items

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| | | | |
| | | | |
| | | | |

---

## Drill Results

### Overall Assessment

- [ ] **PASSED** - All objectives met, RTO/RPO achieved
- [ ] **PASSED WITH ISSUES** - Objectives met but improvements needed
- [ ] **FAILED** - Critical objectives not met, remediation required

### Recommendations

1.
2.
3.

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Drill Conductor | | | |
| Technical Lead | | | |
| Security Lead | | | |

---

## Appendix: Quick Commands

### Database Backup Verification

```sql
-- Check backup status (via Supabase Dashboard)
-- Navigate to: Project > Database > Backups

-- Verify data integrity after restore
SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM conversations) as conversations,
  (SELECT COUNT(*) FROM messages) as messages,
  (SELECT MAX(created_at) FROM messages) as latest_message;
```

### Application Health Check

```bash
# Check deployment status
curl -I https://jcil.ai/api/health

# Verify API response
curl https://jcil.ai/api/user/is-admin

# Check recent logs (via Vercel Dashboard)
```

### Redis Verification

```bash
# Check Redis connection (via application logs)
# Look for: "[Queue] Slot acquired" or "[Cache] Redis get"
```

---

## Drill Schedule

| Quarter | Drill Type | Scheduled Date | Status |
|---------|------------|----------------|--------|
| Q1 2025 | Database Recovery | | |
| Q2 2025 | Full Recovery | | |
| Q3 2025 | Tabletop Exercise | | |
| Q4 2025 | API Key Rotation | | |

---

*Template Version: 1.0*
*Last Updated: January 2025*
