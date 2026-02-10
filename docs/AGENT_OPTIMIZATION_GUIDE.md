# Agent Optimization Guide

## Tổng quan

Tài liệu này hướng dẫn cách xử lý 3 vấn đề chính khi chạy LLM-based test agent:
1. **Rate Limiting** (429 errors)
2. **Non-deterministic Behavior** (kết quả khác nhau mỗi lần chạy)
3. **Performance Issues** (chậm do nhiều LLM API calls)

---

## 1. Rate Limiting (429 Errors)

### Vấn đề
Gemini API có rate limit, khi chạy nhiều test song song sẽ gặp lỗi 429.

### Giải pháp
Sử dụng **RateLimiter** với exponential backoff:

```typescript
import { RateLimiter, withRetry } from '../utils/agent';

// Tạo rate limiter (15 requests/minute cho free tier)
const rateLimiter = new RateLimiter(15, 3);

// Hoặc dùng decorator
const llmCall = withRetry(async () => {
  return await geminiModel.generateContent(prompt);
}, 3); // Max 3 retries
```

### Config trong test

```typescript
// tests/opensearch-agent.spec.ts
const agentConfig = {
  ...AgentConfigPresets.reliable(), // Có built-in rate limiting
  // Hoặc:
  enableRateLimiter: true,
  requestsPerMinute: 10, // Conservative cho CI
  maxRetries: 5
};
```

### Chạy test với single worker

```bash
# Quan trọng: Chạy với 1 worker để tránh rate limit
npm test -- opensearch-agent.spec.ts --workers=1
```

---

## 2. Non-deterministic Behavior

### Vấn đề
LLM có thể trả về kết quả khác nhau mỗi lần → test flaky.

### Giải pháp A: Decision Cache

```typescript
import { DecisionCache } from '../utils/agent';

const cache = new DecisionCache({
  enabled: true,
  ttl: 60 * 60 * 1000, // 1 hour
  persist: true, // Lưu xuống disk
  deterministicMode: true // SAME input = SAME output
});

// LLM sẽ trả về kết quả giống nhau cho cùng state
const cached = cache.get(state, goalId, iteration, previousActions);
if (cached) {
  return cached; // Reuse decision
}
```

### Giải pháp B: Deterministic Mode

```typescript
// tests/opensearch-agent.spec.ts
const agentConfig = {
  ...AgentConfigPresets.reliable(), // Bật deterministic mode
  deterministicMode: true
};

// Hoặc set environment variable
export AGENT_ENV=ci
npm test
```

### Giải pháp C: Pre-seed Cache (cho stable tests)

```typescript
import { DecisionCache } from '../utils/agent';

const cache = new DecisionCache({ deterministicMode: true });

// Seed với known good decisions
cache.seedWith([
  {
    url: 'https://playground.opensearch.org/app/home',
    goalId: 'opensearch-navigate',
    decision: {
      action: { type: 'click', selector: 'role=button:name=Toggle primary navigation' },
      confidence: 0.95,
      goalAchieved: false
    }
  }
]);
```

---

## 3. Performance Optimization

### Vấn đề
Mỗi iteration cần gọi LLM API → chậm.

### Giải pháp A: Lightweight State Capture

```typescript
const agentConfig = {
  performance: {
    lightweightMode: true, // Bỏ screenshot, chỉ capture DOM
    batchCapture: true, // Capture nhiều states cùng lúc
    cacheState: true // Cache state captures
  }
};
```

### Giải pháp B: Smart Wait

```typescript
import { SmartWait } from '../utils/agent';

// Thay vì cố định wait
await page.waitForTimeout(2000);

// Dùng smart wait
await SmartWait.waitForStability(page, 1000);
await SmartWait.waitForElement(page, 'role=link:name=Discover');
```

### Giải pháp C: Performance Monitoring

```typescript
import { PerformanceMonitor } from '../utils/agent';

const monitor = new PerformanceMonitor();

monitor.record('llm_latency', latency);
monitor.record('iteration_time', iterationTime);

// In report sau test
monitor.printReport();
```

---

## Config Presets

Sử dụng preset phù hợp với use case:

```typescript
import { AgentConfigPresets, getConfigForEnvironment } from '../utils/agent/agentConfig';

// 1. Fast mode - Dev nhanh
...AgentConfigPresets.fast()
// - Aggressive caching
// - Lightweight capture
// - 1 retry only

// 2. Reliable mode - CI/CD
...AgentConfigPresets.reliable()
// - Deterministic mode
// - Conservative rate limiting
// - 5 retries
// - Full logging

// 3. Production mode - Balanced
...AgentConfigPresets.production()
// - Moderate caching
// - Sensible defaults

// 4. Local Dev mode - No rate limits
...AgentConfigPresets.localDev()
// - No rate limiting
// - Fast iteration

// 5. Auto-detect from environment
...getConfigForEnvironment()
// Check AGENT_ENV variable
```

---

## Environment Variables

```bash
# .env file
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.0-flash

# Agent environment
AGENT_ENV=production  # or: fast, reliable, debug, local, ci

# Advanced options
AGENT_DEBUG=true
AGENT_CACHE_TTL=3600000
AGENT_RATE_LIMIT=15
```

---

## Running Tests

### Development (fast iteration)

```bash
# Local dev mode - no rate limiting
AGENT_ENV=local npm test -- opensearch-agent.spec.ts --workers=1
```

### CI/CD (reliable)

```bash
# Reliable mode with deterministic behavior
AGENT_ENV=ci npm test -- opensearch-agent.spec.ts --workers=1 --reporter=junit
```

### Debugging

```bash
# Debug mode with full logging
AGENT_ENV=debug npm test -- opensearch-agent.spec.ts --workers=1
```

---

## Troubleshooting

### Issue: Still getting 429 errors

```bash
# Reduce rate limit further
export AGENT_RATE_LIMIT=5
npm test -- --workers=1
```

### Issue: Tests are flaky (non-deterministic)

```bash
# Enable deterministic mode
export AGENT_ENV=ci
npm test
```

### Issue: Tests too slow

```bash
# Use fast preset
AGENT_ENV=fast npm test
```

### Issue: Cache not working

```bash
# Clear cache
rm -rf test-results/agent/cache/
# Or disable cache temporarily
export AGENT_CACHE_ENABLED=false
```

---

## File Structure

```
utils/agent/
├── index.ts                 # Main exports
├── types.ts                 # Type definitions
├── TestAgent.ts             # Main agent orchestrator
├── LLMDecisionEngine.ts     # LLM integration
├── ActionExecutor.ts        # Playwright execution
├── GoalValidator.ts         # Goal validation
├── BrowserStateCapture.ts   # State capture
├── RateLimiter.ts           # NEW: Rate limiting & retry
├── DecisionCache.ts         # NEW: Decision caching
├── PerformanceOptimizer.ts  # NEW: Performance tools
└── agentConfig.ts           # NEW: Config presets
```

---

## Best Practices

1. **Luôn chạy với `--workers=1`** khi test LLM agent
2. **Sử dụng config preset** thay vì manual config
3. **Enable deterministic mode** cho CI/CD
4. **Monitor performance** để detect regressions
5. **Clear cache** khi đổi test logic
6. **Use appropriate preset** cho môi trường (dev vs prod)
