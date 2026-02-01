/**
 * FEATURE FLAG TOOL
 * Design and implement feature flags
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designFeatureFlag(config: {
  name: string;
  description?: string;
  type?: 'boolean' | 'percentage' | 'user_segment' | 'ab_test' | 'multivariate';
  targeting?: Record<string, unknown>;
}): Record<string, unknown> {
  const { name, description = '', type = 'boolean', targeting = {} } = config;

  const flagKey = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const baseFlag = {
    key: flagKey,
    name,
    description,
    type,
    enabled: false,
    createdAt: new Date().toISOString(),
    targeting: {
      rules: [],
      defaultValue: type === 'boolean' ? false : null
    }
  };

  const typeConfigs: Record<string, Record<string, unknown>> = {
    boolean: {
      defaultValue: false,
      implementation: `if (featureFlags.isEnabled('${flagKey}')) {
  // New feature code
} else {
  // Old feature code
}`
    },
    percentage: {
      percentage: 0,
      stickyKey: 'userId',
      implementation: `// Gradual rollout
if (featureFlags.isEnabled('${flagKey}', { userId })) {
  // Feature enabled for this user
}`
    },
    user_segment: {
      segments: ['beta_users', 'internal', 'premium'],
      targeting: targeting,
      implementation: `// Targeted rollout
if (featureFlags.isEnabled('${flagKey}', {
  userId,
  userAttributes: { plan: 'premium', country: 'US' }
})) {
  // Feature enabled for matching users
}`
    },
    ab_test: {
      variants: [
        { key: 'control', weight: 50 },
        { key: 'treatment', weight: 50 }
      ],
      trackingKey: 'experiment_exposure',
      implementation: `// A/B Test
const variant = featureFlags.getVariant('${flagKey}', { userId });
analytics.track('experiment_exposure', {
  experiment: '${flagKey}',
  variant
});

if (variant === 'treatment') {
  // Treatment code
} else {
  // Control code
}`
    },
    multivariate: {
      variants: [
        { key: 'variant_a', value: { buttonColor: 'blue' }, weight: 33 },
        { key: 'variant_b', value: { buttonColor: 'green' }, weight: 33 },
        { key: 'variant_c', value: { buttonColor: 'red' }, weight: 34 }
      ],
      implementation: `// Multivariate test
const { key, value } = featureFlags.getVariation('${flagKey}', { userId });
const buttonColor = value.buttonColor;`
    }
  };

  return {
    flag: { ...baseFlag, ...typeConfigs[type] },
    implementation: typeConfigs[type].implementation,
    lifecycle: [
      { phase: 'Development', action: 'Create flag, default off' },
      { phase: 'Testing', action: 'Enable for internal/beta users' },
      { phase: 'Rollout', action: 'Gradual percentage increase' },
      { phase: 'Full Release', action: '100% rollout' },
      { phase: 'Cleanup', action: 'Remove flag, keep winning code' }
    ],
    bestPractices: [
      'Use descriptive flag names',
      'Document flag purpose and owner',
      'Set cleanup reminders',
      'Use consistent naming conventions',
      'Track flag usage metrics'
    ]
  };
}

function generateSDK(language: 'typescript' | 'python' | 'go' | 'java'): Record<string, unknown> {
  const sdks: Record<string, string> = {
    typescript: `import { createHash } from 'crypto';

interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  fallback?: boolean;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'ab_test';
  percentage?: number;
  variants?: Array<{ key: string; weight: number }>;
  targeting?: {
    rules: Array<{
      attribute: string;
      operator: 'equals' | 'contains' | 'in';
      value: unknown;
      result: boolean;
    }>;
  };
}

interface EvaluationContext {
  userId?: string;
  userAttributes?: Record<string, unknown>;
}

export class FeatureFlagClient {
  private flags: Map<string, FeatureFlag> = new Map();
  private fallback: boolean;

  constructor(config: FeatureFlagConfig) {
    this.fallback = config.fallback ?? false;
    Object.entries(config.flags).forEach(([key, flag]) => {
      this.flags.set(key, flag);
    });
  }

  isEnabled(flagKey: string, context: EvaluationContext = {}): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return this.fallback;
    if (!flag.enabled) return false;

    // Check targeting rules
    if (flag.targeting?.rules) {
      for (const rule of flag.targeting.rules) {
        if (this.evaluateRule(rule, context)) {
          return rule.result;
        }
      }
    }

    // Percentage rollout
    if (flag.type === 'percentage' && flag.percentage !== undefined) {
      return this.hashUser(context.userId || '', flagKey) < flag.percentage;
    }

    return flag.enabled;
  }

  getVariant(flagKey: string, context: EvaluationContext = {}): string | null {
    const flag = this.flags.get(flagKey);
    if (!flag?.enabled || !flag.variants) return null;

    const hash = this.hashUser(context.userId || '', flagKey);
    let cumulative = 0;

    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (hash < cumulative) {
        return variant.key;
      }
    }

    return flag.variants[0]?.key || null;
  }

  private hashUser(userId: string, flagKey: string): number {
    const hash = createHash('md5').update(\`\${userId}:\${flagKey}\`).digest('hex');
    return parseInt(hash.slice(0, 8), 16) / 0xffffffff * 100;
  }

  private evaluateRule(
    rule: { attribute: string; operator: string; value: unknown },
    context: EvaluationContext
  ): boolean {
    const attrValue = context.userAttributes?.[rule.attribute];
    switch (rule.operator) {
      case 'equals': return attrValue === rule.value;
      case 'contains': return String(attrValue).includes(String(rule.value));
      case 'in': return Array.isArray(rule.value) && rule.value.includes(attrValue);
      default: return false;
    }
  }
}`,

    python: `import hashlib
from dataclasses import dataclass
from typing import Dict, List, Any, Optional

@dataclass
class FeatureFlag:
    key: str
    enabled: bool
    flag_type: str = 'boolean'
    percentage: Optional[float] = None
    variants: Optional[List[Dict]] = None
    targeting: Optional[Dict] = None

class FeatureFlagClient:
    def __init__(self, flags: Dict[str, FeatureFlag], fallback: bool = False):
        self.flags = flags
        self.fallback = fallback

    def is_enabled(self, flag_key: str, context: Dict = None) -> bool:
        context = context or {}
        flag = self.flags.get(flag_key)

        if not flag:
            return self.fallback
        if not flag.enabled:
            return False

        # Check targeting
        if flag.targeting and 'rules' in flag.targeting:
            for rule in flag.targeting['rules']:
                if self._evaluate_rule(rule, context):
                    return rule.get('result', True)

        # Percentage rollout
        if flag.flag_type == 'percentage' and flag.percentage is not None:
            return self._hash_user(context.get('user_id', ''), flag_key) < flag.percentage

        return flag.enabled

    def get_variant(self, flag_key: str, context: Dict = None) -> Optional[str]:
        context = context or {}
        flag = self.flags.get(flag_key)

        if not flag or not flag.enabled or not flag.variants:
            return None

        hash_val = self._hash_user(context.get('user_id', ''), flag_key)
        cumulative = 0

        for variant in flag.variants:
            cumulative += variant['weight']
            if hash_val < cumulative:
                return variant['key']

        return flag.variants[0]['key'] if flag.variants else None

    def _hash_user(self, user_id: str, flag_key: str) -> float:
        hash_input = f"{user_id}:{flag_key}"
        hash_hex = hashlib.md5(hash_input.encode()).hexdigest()[:8]
        return int(hash_hex, 16) / 0xffffffff * 100

    def _evaluate_rule(self, rule: Dict, context: Dict) -> bool:
        attr_value = context.get('user_attributes', {}).get(rule['attribute'])
        operator = rule.get('operator', 'equals')

        if operator == 'equals':
            return attr_value == rule['value']
        elif operator == 'contains':
            return rule['value'] in str(attr_value)
        elif operator == 'in':
            return attr_value in rule['value']
        return False`,

    go: `package featureflags

import (
	"crypto/md5"
	"encoding/hex"
	"strconv"
)

type FeatureFlag struct {
	Key        string
	Enabled    bool
	Type       string
	Percentage float64
	Variants   []Variant
	Targeting  *Targeting
}

type Variant struct {
	Key    string
	Weight float64
}

type Targeting struct {
	Rules []Rule
}

type Rule struct {
	Attribute string
	Operator  string
	Value     interface{}
	Result    bool
}

type Context struct {
	UserID         string
	UserAttributes map[string]interface{}
}

type Client struct {
	flags    map[string]*FeatureFlag
	fallback bool
}

func NewClient(flags map[string]*FeatureFlag, fallback bool) *Client {
	return &Client{flags: flags, fallback: fallback}
}

func (c *Client) IsEnabled(flagKey string, ctx *Context) bool {
	flag, ok := c.flags[flagKey]
	if !ok {
		return c.fallback
	}
	if !flag.Enabled {
		return false
	}

	if flag.Type == "percentage" && flag.Percentage > 0 {
		userID := ""
		if ctx != nil {
			userID = ctx.UserID
		}
		return c.hashUser(userID, flagKey) < flag.Percentage
	}

	return flag.Enabled
}

func (c *Client) GetVariant(flagKey string, ctx *Context) string {
	flag, ok := c.flags[flagKey]
	if !ok || !flag.Enabled || len(flag.Variants) == 0 {
		return ""
	}

	userID := ""
	if ctx != nil {
		userID = ctx.UserID
	}
	hash := c.hashUser(userID, flagKey)

	var cumulative float64
	for _, variant := range flag.Variants {
		cumulative += variant.Weight
		if hash < cumulative {
			return variant.Key
		}
	}

	return flag.Variants[0].Key
}

func (c *Client) hashUser(userID, flagKey string) float64 {
	h := md5.Sum([]byte(userID + ":" + flagKey))
	hexStr := hex.EncodeToString(h[:4])
	val, _ := strconv.ParseUint(hexStr, 16, 64)
	return float64(val) / float64(0xffffffff) * 100
}`,

    java: `package com.example.featureflags;

import java.security.MessageDigest;
import java.util.*;

public class FeatureFlagClient {
    private final Map<String, FeatureFlag> flags;
    private final boolean fallback;

    public FeatureFlagClient(Map<String, FeatureFlag> flags, boolean fallback) {
        this.flags = flags;
        this.fallback = fallback;
    }

    public boolean isEnabled(String flagKey, EvaluationContext context) {
        FeatureFlag flag = flags.get(flagKey);
        if (flag == null) return fallback;
        if (!flag.isEnabled()) return false;

        if ("percentage".equals(flag.getType()) && flag.getPercentage() != null) {
            String userId = context != null ? context.getUserId() : "";
            return hashUser(userId, flagKey) < flag.getPercentage();
        }

        return flag.isEnabled();
    }

    public String getVariant(String flagKey, EvaluationContext context) {
        FeatureFlag flag = flags.get(flagKey);
        if (flag == null || !flag.isEnabled() || flag.getVariants() == null) {
            return null;
        }

        String userId = context != null ? context.getUserId() : "";
        double hash = hashUser(userId, flagKey);
        double cumulative = 0;

        for (Variant variant : flag.getVariants()) {
            cumulative += variant.getWeight();
            if (hash < cumulative) {
                return variant.getKey();
            }
        }

        return flag.getVariants().get(0).getKey();
    }

    private double hashUser(String userId, String flagKey) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest((userId + ":" + flagKey).getBytes());
            long val = 0;
            for (int i = 0; i < 4; i++) {
                val = (val << 8) | (digest[i] & 0xff);
            }
            return (double) val / 0xffffffffL * 100;
        } catch (Exception e) {
            return 0;
        }
    }
}`
  };

  return {
    sdk: sdks[language],
    usage: generateUsageExample(language),
    integration: getIntegrationGuide(language)
  };
}

function generateUsageExample(language: string): string {
  const examples: Record<string, string> = {
    typescript: `// Initialize client
const client = new FeatureFlagClient({
  flags: {
    new_checkout: {
      key: 'new_checkout',
      enabled: true,
      type: 'percentage',
      percentage: 25
    }
  }
});

// Check flag
if (client.isEnabled('new_checkout', { userId: 'user123' })) {
  renderNewCheckout();
} else {
  renderOldCheckout();
}`,
    python: `# Initialize client
client = FeatureFlagClient(
    flags={
        'new_checkout': FeatureFlag(
            key='new_checkout',
            enabled=True,
            flag_type='percentage',
            percentage=25
        )
    }
)

# Check flag
if client.is_enabled('new_checkout', {'user_id': 'user123'}):
    render_new_checkout()
else:
    render_old_checkout()`,
    go: `// Initialize client
client := NewClient(map[string]*FeatureFlag{
    "new_checkout": {
        Key:        "new_checkout",
        Enabled:    true,
        Type:       "percentage",
        Percentage: 25,
    },
}, false)

// Check flag
if client.IsEnabled("new_checkout", &Context{UserID: "user123"}) {
    renderNewCheckout()
} else {
    renderOldCheckout()
}`,
    java: `// Initialize client
Map<String, FeatureFlag> flags = new HashMap<>();
flags.put("new_checkout", new FeatureFlag("new_checkout", true, "percentage", 25.0, null));
FeatureFlagClient client = new FeatureFlagClient(flags, false);

// Check flag
if (client.isEnabled("new_checkout", new EvaluationContext("user123"))) {
    renderNewCheckout();
} else {
    renderOldCheckout();
}`
  };
  return examples[language] || examples.typescript;
}

function getIntegrationGuide(_language: string): string[] {
  return [
    '1. Install the feature flag SDK',
    '2. Initialize client at app startup',
    '3. Create flags in your configuration',
    '4. Use isEnabled() for boolean checks',
    '5. Use getVariant() for A/B tests',
    '6. Track flag evaluations for analytics',
    '7. Clean up old flags regularly'
  ];
}

function rolloutStrategy(config: {
  flagKey: string;
  startPercentage?: number;
  endPercentage?: number;
  steps?: number;
  interval?: string;
}): Record<string, unknown> {
  const {
    flagKey,
    startPercentage = 0,
    endPercentage = 100,
    steps = 5,
    interval = '1 day'
  } = config;

  const stepSize = (endPercentage - startPercentage) / steps;
  const rolloutPlan = Array.from({ length: steps + 1 }, (_, i) => ({
    step: i,
    percentage: Math.round(startPercentage + (stepSize * i)),
    timing: i === 0 ? 'Start' : `After ${i} ${interval}${i > 1 ? 's' : ''}`
  }));

  return {
    flagKey,
    rolloutPlan,
    monitoring: {
      metrics: [
        'Error rate',
        'Latency p95',
        'Conversion rate',
        'User feedback'
      ],
      rollbackThresholds: {
        errorRateIncrease: '> 2%',
        latencyIncrease: '> 50%',
        conversionDrop: '> 10%'
      }
    },
    safetyMeasures: [
      'Monitor key metrics at each step',
      'Wait for stable metrics before next step',
      'Have rollback plan ready',
      'Communicate with stakeholders',
      'Document issues and resolutions'
    ],
    automation: `// Automated rollout script
async function executeRollout() {
  const plan = ${JSON.stringify(rolloutPlan)};

  for (const step of plan) {
    await updateFlagPercentage('${flagKey}', step.percentage);
    console.log(\`Rolled out to \${step.percentage}%\`);

    if (step.step < plan.length - 1) {
      await waitForStableMetrics('${interval}');

      if (await hasRegressions()) {
        await rollback('${flagKey}');
        throw new Error('Rollback triggered due to regressions');
      }
    }
  }

  console.log('Rollout complete!');
}`
  };
}

function evaluateRules(context: {
  userId: string;
  attributes: Record<string, unknown>;
  rules: Array<{
    attribute: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
    value: unknown;
    result: boolean;
  }>;
}): Record<string, unknown> {
  const { userId, attributes, rules } = context;

  const evaluations = rules.map(rule => {
    const attrValue = attributes[rule.attribute];
    let matches = false;

    switch (rule.operator) {
      case 'equals':
        matches = attrValue === rule.value;
        break;
      case 'not_equals':
        matches = attrValue !== rule.value;
        break;
      case 'contains':
        matches = String(attrValue).includes(String(rule.value));
        break;
      case 'in':
        matches = Array.isArray(rule.value) && rule.value.includes(attrValue);
        break;
      case 'greater_than':
        matches = Number(attrValue) > Number(rule.value);
        break;
      case 'less_than':
        matches = Number(attrValue) < Number(rule.value);
        break;
    }

    return {
      rule: `${rule.attribute} ${rule.operator} ${JSON.stringify(rule.value)}`,
      attributeValue: attrValue,
      matches,
      wouldReturn: matches ? rule.result : null
    };
  });

  const matchingRule = evaluations.find(e => e.matches);

  return {
    userId,
    attributes,
    evaluations,
    result: matchingRule ? matchingRule.wouldReturn : 'default (no rules matched)',
    explanation: matchingRule
      ? `Rule matched: ${matchingRule.rule}`
      : 'No rules matched, returning default value'
  };
}

export const featureFlagTool: UnifiedTool = {
  name: 'feature_flag',
  description: 'Feature Flag: design, sdk, rollout_strategy, evaluate_rules',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['design', 'sdk', 'rollout_strategy', 'evaluate_rules'] },
      config: { type: 'object' },
      language: { type: 'string' },
      context: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeFeatureFlag(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'design':
        result = designFeatureFlag(args.config || {
          name: 'New Checkout Flow',
          type: 'percentage',
          description: 'Gradual rollout of redesigned checkout'
        });
        break;
      case 'sdk':
        result = generateSDK(args.language || 'typescript');
        break;
      case 'rollout_strategy':
        result = rolloutStrategy(args.config || {
          flagKey: 'new_checkout',
          startPercentage: 5,
          endPercentage: 100,
          steps: 5,
          interval: '1 day'
        });
        break;
      case 'evaluate_rules':
        result = evaluateRules(args.context || {
          userId: 'user123',
          attributes: { plan: 'premium', country: 'US', age: 25 },
          rules: [
            { attribute: 'plan', operator: 'equals', value: 'enterprise', result: true },
            { attribute: 'country', operator: 'in', value: ['US', 'CA'], result: true },
            { attribute: 'age', operator: 'greater_than', value: 21, result: true }
          ]
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isFeatureFlagAvailable(): boolean { return true; }
