/**
 * SMART CONTRACT TOOL
 * Solidity analysis, generation, and gas optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const GAS_COSTS = {
  SSTORE_NEW: 20000,
  SSTORE_UPDATE: 5000,
  SLOAD: 800,
  CALL: 700,
  CREATE: 32000,
  LOG: 375,
  LOG_TOPIC: 375,
  LOG_DATA: 8,
  MEMORY: 3,
  SHA3: 30,
  SHA3_WORD: 6
};

function analyzeContract(code: string): Record<string, unknown> {
  const issues: Array<{ severity: string; issue: string; line?: number; suggestion: string }> = [];

  // Check for reentrancy vulnerability
  if (code.includes('.call{') && code.includes('value:')) {
    const hasReentrancyGuard = code.includes('nonReentrant') || code.includes('ReentrancyGuard');
    if (!hasReentrancyGuard) {
      issues.push({
        severity: 'critical',
        issue: 'Potential reentrancy vulnerability',
        suggestion: 'Use ReentrancyGuard or checks-effects-interactions pattern'
      });
    }
  }

  // Check for unchecked external calls
  if (code.match(/\.call\{.*\}\([^)]*\)/) && !code.includes('require(success')) {
    issues.push({
      severity: 'high',
      issue: 'Unchecked external call return value',
      suggestion: 'Always check call return: (bool success,) = addr.call{...}(); require(success);'
    });
  }

  // Check for tx.origin usage
  if (code.includes('tx.origin')) {
    issues.push({
      severity: 'high',
      issue: 'tx.origin used for authorization',
      suggestion: 'Use msg.sender instead of tx.origin for authorization'
    });
  }

  // Check for floating pragma
  if (code.match(/pragma solidity \^/)) {
    issues.push({
      severity: 'medium',
      issue: 'Floating pragma version',
      suggestion: 'Lock pragma version: pragma solidity 0.8.20;'
    });
  }

  // Check for missing visibility
  const functions = code.match(/function\s+\w+\s*\([^)]*\)\s*(?!public|private|internal|external)/g);
  if (functions && functions.length > 0) {
    issues.push({
      severity: 'medium',
      issue: 'Functions without explicit visibility',
      suggestion: 'Always specify visibility: public, private, internal, or external'
    });
  }

  // Check for integer overflow (pre-0.8.0)
  if (code.match(/pragma solidity 0\.[0-7]/) && !code.includes('SafeMath')) {
    issues.push({
      severity: 'critical',
      issue: 'Potential integer overflow in Solidity < 0.8.0',
      suggestion: 'Use SafeMath or upgrade to Solidity >= 0.8.0'
    });
  }

  // Check for selfdestruct
  if (code.includes('selfdestruct') || code.includes('suicide')) {
    issues.push({
      severity: 'high',
      issue: 'Contract can be destroyed',
      suggestion: 'Ensure selfdestruct is protected with proper access control'
    });
  }

  // Check for block.timestamp manipulation
  if (code.includes('block.timestamp') && (code.includes('random') || code.includes('lottery'))) {
    issues.push({
      severity: 'high',
      issue: 'block.timestamp used for randomness',
      suggestion: 'Use Chainlink VRF or commit-reveal scheme for randomness'
    });
  }

  return {
    issues,
    summary: {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    },
    secure: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0
  };
}

function estimateGas(code: string): Record<string, unknown> {
  let estimatedGas = 21000; // Base transaction cost
  const breakdown: Record<string, number> = {};

  // Count storage operations
  const sstoreNew = (code.match(/\s+\w+\s*=\s*[^=]/g) || []).length;
  const sload = (code.match(/storage\./g) || []).length + (code.match(/\[\w+\]/g) || []).length;

  breakdown.storageNew = sstoreNew * GAS_COSTS.SSTORE_NEW;
  breakdown.storageLoad = sload * GAS_COSTS.SLOAD;
  estimatedGas += breakdown.storageNew + breakdown.storageLoad;

  // Count external calls
  const calls = (code.match(/\.call\{|\.transfer\(|\.send\(/g) || []).length;
  breakdown.externalCalls = calls * GAS_COSTS.CALL;
  estimatedGas += breakdown.externalCalls;

  // Count events
  const events = (code.match(/emit\s+\w+/g) || []).length;
  breakdown.events = events * GAS_COSTS.LOG;
  estimatedGas += breakdown.events;

  // Count hashing
  const hashes = (code.match(/keccak256|sha256/g) || []).length;
  breakdown.hashing = hashes * GAS_COSTS.SHA3;
  estimatedGas += breakdown.hashing;

  return {
    estimatedGas,
    breakdown,
    costAt50Gwei: `${(estimatedGas * 50 / 1e9).toFixed(6)} ETH`,
    costAt100Gwei: `${(estimatedGas * 100 / 1e9).toFixed(6)} ETH`,
    optimizationTips: [
      sstoreNew > 3 ? 'Consider batching storage writes' : null,
      sload > 5 ? 'Cache storage variables in memory' : null,
      calls > 2 ? 'Minimize external calls' : null
    ].filter(Boolean)
  };
}

function optimizeGas(code: string): Record<string, unknown> {
  const optimizations: Array<{ original: string; optimized: string; savings: string }> = [];

  // Replace memory with calldata for read-only params
  if (code.includes('memory') && code.includes('external')) {
    optimizations.push({
      original: 'function foo(string memory data) external',
      optimized: 'function foo(string calldata data) external',
      savings: '~200-2000 gas per call'
    });
  }

  // Use ++i instead of i++
  if (code.includes('i++')) {
    optimizations.push({
      original: 'for (uint i = 0; i < length; i++)',
      optimized: 'for (uint i = 0; i < length; ++i)',
      savings: '~5 gas per iteration'
    });
  }

  // Cache array length
  if (code.match(/for.*\.length/)) {
    optimizations.push({
      original: 'for (uint i = 0; i < array.length; i++)',
      optimized: 'uint len = array.length; for (uint i = 0; i < len; ++i)',
      savings: '~100 gas per iteration (SLOAD avoided)'
    });
  }

  // Use custom errors
  if (code.includes('require(') && code.includes('"')) {
    optimizations.push({
      original: 'require(condition, "Error message")',
      optimized: 'if (!condition) revert CustomError();',
      savings: 'Deployment: ~200 gas per string character'
    });
  }

  // Pack storage variables
  if (code.match(/uint256\s+\w+;\s*uint256/)) {
    optimizations.push({
      original: 'uint256 a; uint256 b; // 2 slots',
      optimized: 'uint128 a; uint128 b; // 1 slot',
      savings: '20000 gas (1 SSTORE instead of 2)'
    });
  }

  return {
    optimizations,
    generalTips: [
      'Use uint256 instead of smaller uints (unless packing)',
      'Make variables immutable or constant when possible',
      'Use events instead of storage for historical data',
      'Batch operations to amortize base gas costs',
      'Use unchecked blocks for arithmetic that cannot overflow'
    ]
  };
}

function generateContract(config: {
  name: string;
  type: 'erc20' | 'erc721' | 'erc1155' | 'basic' | 'upgradeable';
  features?: string[];
}): string {
  const { name, type, features = [] } = config;

  const templates: Record<string, string> = {
    erc20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
${features.includes('pausable') ? 'import "@openzeppelin/contracts/security/Pausable.sol";' : ''}
${features.includes('burnable') ? 'import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";' : ''}

contract ${name} is ERC20, Ownable${features.includes('pausable') ? ', Pausable' : ''}${features.includes('burnable') ? ', ERC20Burnable' : ''} {
    constructor(uint256 initialSupply) ERC20("${name}", "${name.substring(0, 4).toUpperCase()}") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    ${features.includes('mintable') ? `function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }` : ''}

    ${features.includes('pausable') ? `function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        super._update(from, to, amount);
    }` : ''}
}`,

    erc721: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${name} is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("${name}", "${name.substring(0, 4).toUpperCase()}") Ownable(msg.sender) {}

    function safeMint(address to, string memory uri) external onlyOwner {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}`,

    basic: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ${name} is Ownable, ReentrancyGuard {
    // Events
    event ActionPerformed(address indexed user, uint256 value);

    // State variables
    mapping(address => uint256) public balances;

    constructor() Ownable(msg.sender) {}

    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
        emit ActionPerformed(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}`
  };

  return templates[type] || templates.basic;
}

function calculateTokenomics(config: {
  totalSupply: number;
  distribution: Record<string, number>;
  vestingMonths?: number;
}): Record<string, unknown> {
  const { totalSupply, distribution, vestingMonths = 24 } = config;

  // Validate distribution sums to 100
  const totalPercent = Object.values(distribution).reduce((a, b) => a + b, 0);

  const allocations = Object.entries(distribution).map(([category, percent]) => ({
    category,
    percent,
    tokens: totalSupply * (percent / 100),
    monthlyUnlock: vestingMonths > 0 ? (totalSupply * (percent / 100)) / vestingMonths : totalSupply * (percent / 100)
  }));

  return {
    totalSupply,
    distributionValid: Math.abs(totalPercent - 100) < 0.01,
    allocations,
    vestingSchedule: {
      months: vestingMonths,
      monthlyRelease: totalSupply / vestingMonths,
      tgeUnlock: totalSupply * 0.1 // Assuming 10% TGE
    },
    warnings: [
      totalPercent !== 100 ? `Distribution sums to ${totalPercent}%, should be 100%` : null,
      distribution['team'] > 20 ? 'Team allocation above 20% may concern investors' : null,
      !distribution['liquidity'] ? 'Consider allocating tokens for liquidity' : null
    ].filter(Boolean)
  };
}

export const smartContractTool: UnifiedTool = {
  name: 'smart_contract',
  description: 'Smart Contract: analyze, estimate_gas, optimize_gas, generate, tokenomics',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze', 'estimate_gas', 'optimize_gas', 'generate', 'tokenomics'] },
      code: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      features: { type: 'array' },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeSmartContract(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    const sampleContract = `pragma solidity ^0.8.0;
contract Sample {
    mapping(address => uint256) public balances;
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        (bool success,) = msg.sender.call{value: amount}("");
    }
}`;

    switch (args.operation) {
      case 'analyze':
        result = analyzeContract(args.code || sampleContract);
        break;
      case 'estimate_gas':
        result = estimateGas(args.code || sampleContract);
        break;
      case 'optimize_gas':
        result = optimizeGas(args.code || sampleContract);
        break;
      case 'generate':
        result = { contract: generateContract({
          name: args.name || 'MyToken',
          type: args.type || 'erc20',
          features: args.features || ['mintable', 'burnable']
        })};
        break;
      case 'tokenomics':
        result = calculateTokenomics(args.config || {
          totalSupply: 1000000000,
          distribution: { team: 15, investors: 20, community: 30, treasury: 20, liquidity: 15 },
          vestingMonths: 24
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSmartContractAvailable(): boolean { return true; }
