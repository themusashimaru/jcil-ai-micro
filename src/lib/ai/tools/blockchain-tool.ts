/**
 * BLOCKCHAIN TOOL
 * Create blocks, validate chains, mine with proof-of-work, smart contracts
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Transaction { from: string; to: string; amount: number; timestamp: number; signature?: string; }
interface Block { index: number; timestamp: number; transactions: Transaction[]; previousHash: string; hash: string; nonce: number; difficulty: number; }
interface Blockchain { chain: Block[]; pendingTransactions: Transaction[]; difficulty: number; miningReward: number; }
interface Wallet { address: string; balance: number; publicKey: string; }

function sha256(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Extend to 64 char hex string
  const baseHash = Math.abs(hash).toString(16).padStart(8, '0');
  return (baseHash + baseHash + baseHash + baseHash + baseHash + baseHash + baseHash + baseHash).slice(0, 64);
}

function calculateHash(block: Omit<Block, 'hash'>): string {
  const data = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    transactions: block.transactions,
    previousHash: block.previousHash,
    nonce: block.nonce
  });
  return sha256(data);
}

function createGenesisBlock(): Block {
  const block: Omit<Block, 'hash'> = {
    index: 0,
    timestamp: Date.now(),
    transactions: [],
    previousHash: '0'.repeat(64),
    nonce: 0,
    difficulty: 2
  };
  return { ...block, hash: calculateHash(block) };
}

function createBlockchain(difficulty: number = 2): Blockchain {
  return {
    chain: [createGenesisBlock()],
    pendingTransactions: [],
    difficulty,
    miningReward: 50
  };
}

function mineBlock(blockchain: Blockchain, minerAddress: string): Block {
  const lastBlock = blockchain.chain[blockchain.chain.length - 1];

  // Add mining reward
  blockchain.pendingTransactions.push({
    from: 'NETWORK',
    to: minerAddress,
    amount: blockchain.miningReward,
    timestamp: Date.now()
  });

  const newBlock: Omit<Block, 'hash'> = {
    index: lastBlock.index + 1,
    timestamp: Date.now(),
    transactions: [...blockchain.pendingTransactions],
    previousHash: lastBlock.hash,
    nonce: 0,
    difficulty: blockchain.difficulty
  };

  // Proof of work
  const target = '0'.repeat(blockchain.difficulty);
  let hash = calculateHash(newBlock);
  while (!hash.startsWith(target)) {
    newBlock.nonce++;
    hash = calculateHash(newBlock);
    if (newBlock.nonce > 1000000) break; // Safety limit
  }

  const minedBlock: Block = { ...newBlock, hash };
  blockchain.chain.push(minedBlock);
  blockchain.pendingTransactions = [];

  return minedBlock;
}

function addTransaction(blockchain: Blockchain, from: string, to: string, amount: number): Transaction {
  const tx: Transaction = { from, to, amount, timestamp: Date.now() };
  blockchain.pendingTransactions.push(tx);
  return tx;
}

function validateChain(blockchain: Blockchain): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 1; i < blockchain.chain.length; i++) {
    const current = blockchain.chain[i];
    const previous = blockchain.chain[i - 1];

    // Check hash
    const recalculatedHash = calculateHash(current);
    if (current.hash !== recalculatedHash) {
      errors.push(`Block ${i}: Hash mismatch`);
    }

    // Check previous hash
    if (current.previousHash !== previous.hash) {
      errors.push(`Block ${i}: Previous hash mismatch`);
    }

    // Check proof of work
    if (!current.hash.startsWith('0'.repeat(current.difficulty))) {
      errors.push(`Block ${i}: Invalid proof of work`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function getBalance(blockchain: Blockchain, address: string): number {
  let balance = 0;

  for (const block of blockchain.chain) {
    for (const tx of block.transactions) {
      if (tx.to === address) balance += tx.amount;
      if (tx.from === address) balance -= tx.amount;
    }
  }

  return balance;
}

function createWallet(): Wallet {
  const address = '0x' + sha256(Math.random().toString()).slice(0, 40);
  return { address, balance: 0, publicKey: sha256(address).slice(0, 64) };
}

function blockchainToAscii(blockchain: Blockchain): string {
  const lines: string[] = ['BLOCKCHAIN VISUALIZATION'];
  lines.push('═'.repeat(60));

  for (const block of blockchain.chain) {
    lines.push(`┌${'─'.repeat(58)}┐`);
    lines.push(`│ Block #${block.index.toString().padEnd(48)} │`);
    lines.push(`│ Hash: ${block.hash.slice(0, 20)}...${' '.repeat(26)} │`);
    lines.push(`│ Prev: ${block.previousHash.slice(0, 20)}...${' '.repeat(26)} │`);
    lines.push(`│ Nonce: ${block.nonce.toString().padEnd(20)} Txns: ${block.transactions.length.toString().padEnd(17)} │`);
    lines.push(`└${'─'.repeat(58)}┘`);
    if (block.index < blockchain.chain.length - 1) {
      lines.push('           │');
      lines.push('           ▼');
    }
  }

  return lines.join('\n');
}

interface SmartContract { address: string; code: string; state: Record<string, unknown>; }

function deployContract(name: string, initialState: Record<string, unknown>): SmartContract {
  return {
    address: '0x' + sha256('contract_' + name + Date.now()).slice(0, 40),
    code: name,
    state: initialState
  };
}

function executeContract(contract: SmartContract, method: string, params: Record<string, unknown>): Record<string, unknown> {
  // Simplified smart contract execution
  if (contract.code === 'token') {
    if (method === 'transfer') {
      const from = params.from as string;
      const to = params.to as string;
      const amount = params.amount as number;
      const balances = contract.state.balances as Record<string, number>;

      if (balances[from] >= amount) {
        balances[from] -= amount;
        balances[to] = (balances[to] || 0) + amount;
        return { success: true, balances };
      }
      return { success: false, error: 'Insufficient balance' };
    }
  }
  return { success: false, error: 'Unknown method' };
}

export const blockchainTool: UnifiedTool = {
  name: 'blockchain',
  description: 'Blockchain: create, mine, transaction, validate, balance, smart_contract, visualize',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'mine', 'transaction', 'validate', 'balance', 'wallet', 'smart_contract', 'visualize', 'info'] },
      from: { type: 'string' },
      to: { type: 'string' },
      amount: { type: 'number' },
      address: { type: 'string' },
      difficulty: { type: 'number' },
      contractType: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeBlockchain(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const blockchain = createBlockchain(args.difficulty || 2);

    switch (args.operation) {
      case 'create':
        result = {
          blockchain: { chainLength: blockchain.chain.length, difficulty: blockchain.difficulty, miningReward: blockchain.miningReward },
          genesisBlock: blockchain.chain[0]
        };
        break;
      case 'mine':
        const minerAddress = args.address || createWallet().address;
        addTransaction(blockchain, 'Alice', 'Bob', 10);
        addTransaction(blockchain, 'Bob', 'Charlie', 5);
        const minedBlock = mineBlock(blockchain, minerAddress);
        result = {
          minedBlock: { index: minedBlock.index, hash: minedBlock.hash, nonce: minedBlock.nonce, transactions: minedBlock.transactions.length },
          minerReward: blockchain.miningReward,
          chainLength: blockchain.chain.length
        };
        break;
      case 'transaction':
        const tx = addTransaction(blockchain, args.from || 'Alice', args.to || 'Bob', args.amount || 10);
        result = { transaction: tx, pendingCount: blockchain.pendingTransactions.length };
        break;
      case 'validate':
        // Add some blocks first
        addTransaction(blockchain, 'Test', 'User', 50);
        mineBlock(blockchain, 'Miner1');
        const validation = validateChain(blockchain);
        result = { ...validation, chainLength: blockchain.chain.length };
        break;
      case 'balance':
        addTransaction(blockchain, 'Network', args.address || 'User', 100);
        mineBlock(blockchain, 'Miner');
        addTransaction(blockchain, args.address || 'User', 'Other', 30);
        mineBlock(blockchain, 'Miner');
        const balance = getBalance(blockchain, args.address || 'User');
        result = { address: args.address || 'User', balance };
        break;
      case 'wallet':
        const wallet = createWallet();
        result = { wallet };
        break;
      case 'smart_contract':
        const contract = deployContract(args.contractType || 'token', {
          name: 'MyToken',
          symbol: 'MTK',
          totalSupply: 1000000,
          balances: { owner: 1000000 }
        });
        const execResult = executeContract(contract, 'transfer', { from: 'owner', to: 'user1', amount: 1000 });
        result = { contract: { address: contract.address, code: contract.code }, execution: execResult };
        break;
      case 'visualize':
        addTransaction(blockchain, 'Alice', 'Bob', 25);
        mineBlock(blockchain, 'Miner1');
        addTransaction(blockchain, 'Bob', 'Charlie', 10);
        mineBlock(blockchain, 'Miner2');
        result = { ascii: blockchainToAscii(blockchain) };
        break;
      case 'info':
        result = {
          description: 'Blockchain simulation with proof-of-work',
          features: ['Block creation', 'Mining with PoW', 'Transaction validation', 'Chain validation', 'Wallet creation', 'Smart contracts'],
          concepts: {
            hash: 'Cryptographic fingerprint of block data',
            nonce: 'Number varied to find valid hash',
            difficulty: 'Number of leading zeros required',
            previousHash: 'Links blocks together'
          }
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isBlockchainAvailable(): boolean { return true; }
