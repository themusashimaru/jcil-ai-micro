/**
 * FAKE DATA GENERATION TOOL
 *
 * Generates realistic fake data using Faker.js.
 * Zero external API dependencies - runs entirely locally.
 *
 * Supported data types:
 * - Person: names, emails, phone numbers, addresses
 * - Company: company names, catch phrases, industries
 * - Commerce: products, prices, departments
 * - Finance: credit cards, accounts, transactions
 * - Internet: usernames, passwords, URLs, IPs
 * - Lorem: paragraphs, sentences, words
 * - Date: past, future, recent, birthdate
 * - Location: addresses, cities, countries, coordinates
 * - Image: placeholder image URLs
 * - UUID: unique identifiers
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded Faker library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faker: any = null;

async function initFaker(): Promise<boolean> {
  if (faker) return true;
  try {
    const fakerModule = await import('@faker-js/faker');
    faker = fakerModule.faker;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const fakerTool: UnifiedTool = {
  name: 'generate_fake_data',
  description: `Generate realistic fake data for testing, prototyping, or demonstrations.

Data categories:
- person: Full name, first name, last name, email, phone, job title, bio
- company: Company name, catch phrase, industry, department
- commerce: Product name, price, description, category
- finance: Credit card, account number, BIC, bitcoin address
- internet: Email, username, password, URL, IP address, user agent
- lorem: Paragraphs, sentences, words (placeholder text)
- date: Past date, future date, recent date, birthdate
- location: Full address, street, city, state, country, zip, coordinates
- image: Placeholder image URL (avatar, nature, business, etc.)
- uuid: Unique identifiers
- custom: Generate multiple records with mixed fields

Use cases:
- Generate test data for applications
- Create realistic sample datasets
- Populate mockups and prototypes
- Generate placeholder content`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: [
          'person',
          'company',
          'commerce',
          'finance',
          'internet',
          'lorem',
          'date',
          'location',
          'image',
          'uuid',
          'custom',
        ],
        description: 'Category of fake data to generate',
      },
      count: {
        type: 'number',
        description: 'Number of records to generate. Default: 1, Max: 100',
      },
      locale: {
        type: 'string',
        enum: ['en', 'en_US', 'en_GB', 'de', 'fr', 'es', 'it', 'ja', 'zh_CN', 'pt_BR'],
        description: 'Locale for generated data. Default: en_US',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description:
          'For custom category: specific fields to include (e.g., ["firstName", "email", "company"])',
      },
      seed: {
        type: 'number',
        description: 'Optional seed for reproducible results',
      },
    },
    required: ['category'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isFakerAvailable(): Promise<boolean> {
  return await initFaker();
}

// ============================================================================
// DATA GENERATORS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generatePerson(f: any): Record<string, unknown> {
  return {
    firstName: f.person.firstName(),
    lastName: f.person.lastName(),
    fullName: f.person.fullName(),
    email: f.internet.email(),
    phone: f.phone.number(),
    jobTitle: f.person.jobTitle(),
    jobType: f.person.jobType(),
    bio: f.person.bio(),
    avatar: f.image.avatar(),
    gender: f.person.sex(),
    birthDate: f.date.birthdate().toISOString().split('T')[0],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCompany(f: any): Record<string, unknown> {
  return {
    name: f.company.name(),
    catchPhrase: f.company.catchPhrase(),
    buzzPhrase: f.company.buzzPhrase(),
    industry: f.commerce.department(),
    website: f.internet.url(),
    email: f.internet.email({ provider: 'company.com' }),
    phone: f.phone.number(),
    address: {
      street: f.location.streetAddress(),
      city: f.location.city(),
      state: f.location.state(),
      country: f.location.country(),
      zipCode: f.location.zipCode(),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCommerce(f: any): Record<string, unknown> {
  return {
    productName: f.commerce.productName(),
    productDescription: f.commerce.productDescription(),
    price: f.commerce.price(),
    department: f.commerce.department(),
    productAdjective: f.commerce.productAdjective(),
    productMaterial: f.commerce.productMaterial(),
    isbn: f.commerce.isbn(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFinance(f: any): Record<string, unknown> {
  return {
    accountNumber: f.finance.accountNumber(),
    accountName: f.finance.accountName(),
    routingNumber: f.finance.routingNumber(),
    creditCardNumber: f.finance.creditCardNumber(),
    creditCardCVV: f.finance.creditCardCVV(),
    creditCardIssuer: f.finance.creditCardIssuer(),
    bic: f.finance.bic(),
    iban: f.finance.iban(),
    bitcoinAddress: f.finance.bitcoinAddress(),
    ethereumAddress: f.finance.ethereumAddress(),
    currency: f.finance.currency(),
    amount: f.finance.amount(),
    transactionType: f.finance.transactionType(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateInternet(f: any): Record<string, unknown> {
  return {
    email: f.internet.email(),
    username: f.internet.username(),
    password: f.internet.password(),
    url: f.internet.url(),
    domainName: f.internet.domainName(),
    ip: f.internet.ip(),
    ipv6: f.internet.ipv6(),
    mac: f.internet.mac(),
    userAgent: f.internet.userAgent(),
    emoji: f.internet.emoji(),
    color: f.internet.color(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLorem(f: any): Record<string, unknown> {
  return {
    word: f.lorem.word(),
    words: f.lorem.words(5),
    sentence: f.lorem.sentence(),
    sentences: f.lorem.sentences(3),
    paragraph: f.lorem.paragraph(),
    paragraphs: f.lorem.paragraphs(2),
    lines: f.lorem.lines(3),
    slug: f.lorem.slug(),
    text: f.lorem.text(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateDate(f: any): Record<string, unknown> {
  return {
    past: f.date.past().toISOString(),
    future: f.date.future().toISOString(),
    recent: f.date.recent().toISOString(),
    soon: f.date.soon().toISOString(),
    birthdate: f.date.birthdate().toISOString().split('T')[0],
    month: f.date.month(),
    weekday: f.date.weekday(),
    timezone: f.location.timeZone(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLocation(f: any): Record<string, unknown> {
  return {
    streetAddress: f.location.streetAddress(),
    secondaryAddress: f.location.secondaryAddress(),
    city: f.location.city(),
    state: f.location.state(),
    stateAbbr: f.location.state({ abbreviated: true }),
    zipCode: f.location.zipCode(),
    country: f.location.country(),
    countryCode: f.location.countryCode(),
    latitude: f.location.latitude(),
    longitude: f.location.longitude(),
    direction: f.location.direction(),
    nearbyGPSCoordinate: f.location.nearbyGPSCoordinate(),
    timeZone: f.location.timeZone(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateImage(f: any): Record<string, unknown> {
  return {
    avatar: f.image.avatar(),
    avatarGitHub: f.image.avatarGitHub(),
    url: f.image.url(),
    urlLoremFlickr: f.image.urlLoremFlickr(),
    urlPicsumPhotos: f.image.urlPicsumPhotos(),
    dataUri: f.image.dataUri({ width: 100, height: 100 }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateUUID(f: any): Record<string, unknown> {
  return {
    uuid: f.string.uuid(),
    nanoid: f.string.nanoid(),
    alphanumeric: f.string.alphanumeric(16),
    hexadecimal: f.string.hexadecimal({ length: 32 }),
    numeric: f.string.numeric(10),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCustom(f: any, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const fieldMap: Record<string, () => unknown> = {
    // Person
    firstName: () => f.person.firstName(),
    lastName: () => f.person.lastName(),
    fullName: () => f.person.fullName(),
    email: () => f.internet.email(),
    phone: () => f.phone.number(),
    jobTitle: () => f.person.jobTitle(),

    // Company
    company: () => f.company.name(),
    companyName: () => f.company.name(),
    catchPhrase: () => f.company.catchPhrase(),
    industry: () => f.commerce.department(),

    // Commerce
    product: () => f.commerce.productName(),
    productName: () => f.commerce.productName(),
    price: () => f.commerce.price(),
    department: () => f.commerce.department(),

    // Internet
    username: () => f.internet.username(),
    password: () => f.internet.password(),
    url: () => f.internet.url(),
    ip: () => f.internet.ip(),

    // Location
    address: () => f.location.streetAddress(),
    city: () => f.location.city(),
    state: () => f.location.state(),
    country: () => f.location.country(),
    zipCode: () => f.location.zipCode(),

    // Other
    uuid: () => f.string.uuid(),
    date: () => f.date.past().toISOString(),
    sentence: () => f.lorem.sentence(),
    paragraph: () => f.lorem.paragraph(),
    avatar: () => f.image.avatar(),
  };

  for (const field of fields) {
    const generator = fieldMap[field];
    if (generator) {
      result[field] = generator();
    } else {
      result[field] = `Unknown field: ${field}`;
    }
  }

  return result;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFaker(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    category: string;
    count?: number;
    locale?: string;
    fields?: string[];
    seed?: number;
  };

  // Validate category
  const validCategories = [
    'person',
    'company',
    'commerce',
    'finance',
    'internet',
    'lorem',
    'date',
    'location',
    'image',
    'uuid',
    'custom',
  ];

  if (!args.category || !validCategories.includes(args.category)) {
    return {
      toolCallId: toolCall.id,
      content: `Error: Invalid category. Must be one of: ${validCategories.join(', ')}`,
      isError: true,
    };
  }

  // Initialize faker
  const loaded = await initFaker();
  if (!loaded || !faker) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Faker library not available. Please install @faker-js/faker.',
      isError: true,
    };
  }

  try {
    // Set locale if provided
    if (args.locale) {
      // Note: Faker.js uses setLocale or locale property depending on version
      try {
        if (typeof faker.setLocale === 'function') {
          faker.setLocale(args.locale);
        } else {
          faker.locale = args.locale;
        }
      } catch {
        // Ignore locale errors, fall back to default
      }
    }

    // Set seed for reproducibility
    if (args.seed !== undefined) {
      faker.seed(args.seed);
    }

    // Determine count (1-100)
    const count = Math.min(Math.max(args.count || 1, 1), 100);

    // Validate custom fields if category is custom
    if (args.category === 'custom' && (!args.fields || args.fields.length === 0)) {
      return {
        toolCallId: toolCall.id,
        content:
          'Error: Custom category requires fields array. Example: ["firstName", "email", "company"]',
        isError: true,
      };
    }

    // Generate data
    const generators: Record<string, (f: typeof faker) => Record<string, unknown>> = {
      person: generatePerson,
      company: generateCompany,
      commerce: generateCommerce,
      finance: generateFinance,
      internet: generateInternet,
      lorem: generateLorem,
      date: generateDate,
      location: generateLocation,
      image: generateImage,
      uuid: generateUUID,
      custom: (f) => generateCustom(f, args.fields || []),
    };

    const generator = generators[args.category];
    const data: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i++) {
      data.push(generator(faker));
    }

    // Return single object or array based on count
    const result = count === 1 ? data[0] : data;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Generated ${count} ${args.category} record(s)`,
        category: args.category,
        count,
        locale: args.locale || 'en_US',
        seed: args.seed,
        data: result,
        // Include as both data and formatted JSON
        formattedJSON: JSON.stringify(result, null, 2),
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating fake data: ${(error as Error).message}`,
      isError: true,
    };
  }
}
