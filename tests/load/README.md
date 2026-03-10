# Load Testing

Performance and load testing for JCIL.AI using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Running Tests

### Quick Smoke Test

```bash
k6 run tests/load/k6-load-test.js --env SCENARIO=smoke
```

### Full Load Test

```bash
k6 run tests/load/k6-load-test.js
```

### Custom Configuration

```bash
# Run against staging
k6 run tests/load/k6-load-test.js --env BASE_URL=https://staging.jcil.ai

# Custom duration and users
k6 run --vus 50 --duration 5m tests/load/k6-load-test.js

# Run specific scenario
k6 run tests/load/k6-load-test.js --env SCENARIO=stress
```

## Test Scenarios

| Scenario | Description | Duration | Max VUs |
|----------|-------------|----------|---------|
| **smoke** | Basic functionality check | 30s | 1 |
| **load** | Normal traffic simulation | 9m | 50 |
| **stress** | Find breaking point | 23m | 150 |
| **spike** | Sudden traffic surge | ~6m | 100 |

## Thresholds

Tests fail if these aren't met:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 2000ms | 95% of requests under 2 seconds |
| `http_req_failed` | rate < 5% | Less than 5% HTTP errors |
| `errors` | rate < 5% | Less than 5% custom errors |
| `health_check_duration` | p(95) < 500ms | Health checks under 500ms |

## Interpreting Results

### Good Results

```
✓ http_req_duration............: avg=245ms  p(95)=890ms
✓ http_req_failed..............: 0.12%
✓ errors.......................: 0.08%
```

### Warning Signs

- `http_req_duration` p(95) > 1500ms - Performance degrading
- `http_req_failed` > 2% - Too many errors
- Increasing error rate over time - System struggling

### Red Flags

- `http_req_failed` > 5% - System under severe stress
- `http_req_duration` p(95) > 5000ms - Unacceptable latency
- Timeouts increasing - Connection issues

## Output Files

After running tests:

- `tests/load/summary.json` - Detailed metrics in JSON format

## CI/CD Integration

Add to your pipeline:

```yaml
# GitHub Actions example
- name: Run load tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: tests/load/k6-load-test.js
    flags: --env BASE_URL=${{ secrets.STAGING_URL }}
```

## Recommended Test Schedule

| Test | When | Purpose |
|------|------|---------|
| Smoke | Every deployment | Verify basic functionality |
| Load | Weekly | Baseline performance |
| Stress | Monthly | Capacity planning |
| Spike | Before major launches | Prepare for traffic surges |

## Troubleshooting

### "socket: too many open files"

```bash
ulimit -n 10000
```

### Connection refused

- Verify BASE_URL is correct
- Check if server is running
- Verify firewall/security group settings

### High error rates

- Check server logs
- Verify rate limiting configuration
- Check database connection pool
