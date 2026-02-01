/**
 * E2E TEST GENERATOR TOOL
 * Generate end-to-end tests for various frameworks
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generatePlaywrightTest(config: {
  name: string;
  baseUrl?: string;
  flows: Array<{
    name: string;
    steps: Array<{
      action: 'navigate' | 'click' | 'fill' | 'select' | 'check' | 'wait' | 'assert';
      target?: string;
      value?: string;
      text?: string;
    }>;
  }>;
}): string {
  const { name, baseUrl = 'http://localhost:3000', flows } = config;

  let test = `import { test, expect } from '@playwright/test';

test.describe('${name}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('${baseUrl}');
  });

`;

  for (const flow of flows) {
    test += `  test('${flow.name}', async ({ page }) => {\n`;

    for (const step of flow.steps) {
      switch (step.action) {
        case 'navigate':
          test += `    await page.goto('${step.value || baseUrl}');\n`;
          break;
        case 'click':
          test += `    await page.click('${step.target}');\n`;
          break;
        case 'fill':
          test += `    await page.fill('${step.target}', '${step.value}');\n`;
          break;
        case 'select':
          test += `    await page.selectOption('${step.target}', '${step.value}');\n`;
          break;
        case 'check':
          test += `    await page.check('${step.target}');\n`;
          break;
        case 'wait':
          if (step.target) {
            test += `    await page.waitForSelector('${step.target}');\n`;
          } else {
            test += `    await page.waitForTimeout(${step.value || 1000});\n`;
          }
          break;
        case 'assert':
          if (step.text) {
            test += `    await expect(page.locator('${step.target}')).toContainText('${step.text}');\n`;
          } else {
            test += `    await expect(page.locator('${step.target}')).toBeVisible();\n`;
          }
          break;
      }
    }

    test += `  });\n\n`;
  }

  test += `});\n`;

  return test;
}

function generateCypressTest(config: {
  name: string;
  baseUrl?: string;
  flows: Array<{
    name: string;
    steps: Array<{
      action: 'visit' | 'click' | 'type' | 'select' | 'check' | 'wait' | 'assert';
      target?: string;
      value?: string;
      text?: string;
    }>;
  }>;
}): string {
  const { name, baseUrl = '/', flows } = config;

  let test = `describe('${name}', () => {\n`;
  test += `  beforeEach(() => {\n`;
  test += `    cy.visit('${baseUrl}');\n`;
  test += `  });\n\n`;

  for (const flow of flows) {
    test += `  it('${flow.name}', () => {\n`;

    for (const step of flow.steps) {
      switch (step.action) {
        case 'visit':
          test += `    cy.visit('${step.value || baseUrl}');\n`;
          break;
        case 'click':
          test += `    cy.get('${step.target}').click();\n`;
          break;
        case 'type':
          test += `    cy.get('${step.target}').type('${step.value}');\n`;
          break;
        case 'select':
          test += `    cy.get('${step.target}').select('${step.value}');\n`;
          break;
        case 'check':
          test += `    cy.get('${step.target}').check();\n`;
          break;
        case 'wait':
          if (step.target) {
            test += `    cy.get('${step.target}').should('exist');\n`;
          } else {
            test += `    cy.wait(${step.value || 1000});\n`;
          }
          break;
        case 'assert':
          if (step.text) {
            test += `    cy.get('${step.target}').should('contain', '${step.text}');\n`;
          } else {
            test += `    cy.get('${step.target}').should('be.visible');\n`;
          }
          break;
      }
    }

    test += `  });\n\n`;
  }

  test += `});\n`;

  return test;
}

function generatePuppeteerTest(config: {
  name: string;
  baseUrl?: string;
  flows: Array<{
    name: string;
    steps: Array<{
      action: 'goto' | 'click' | 'type' | 'select' | 'wait' | 'assert' | 'screenshot';
      target?: string;
      value?: string;
    }>;
  }>;
}): string {
  const { name, baseUrl = 'http://localhost:3000', flows } = config;

  let test = `const puppeteer = require('puppeteer');

describe('${name}', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('${baseUrl}');
  });

  afterEach(async () => {
    await page.close();
  });

`;

  for (const flow of flows) {
    test += `  test('${flow.name}', async () => {\n`;

    for (const step of flow.steps) {
      switch (step.action) {
        case 'goto':
          test += `    await page.goto('${step.value || baseUrl}');\n`;
          break;
        case 'click':
          test += `    await page.click('${step.target}');\n`;
          break;
        case 'type':
          test += `    await page.type('${step.target}', '${step.value}');\n`;
          break;
        case 'select':
          test += `    await page.select('${step.target}', '${step.value}');\n`;
          break;
        case 'wait':
          if (step.target) {
            test += `    await page.waitForSelector('${step.target}');\n`;
          } else {
            test += `    await page.waitForTimeout(${step.value || 1000});\n`;
          }
          break;
        case 'assert':
          test += `    const element = await page.$('${step.target}');\n`;
          test += `    expect(element).toBeTruthy();\n`;
          break;
        case 'screenshot':
          test += `    await page.screenshot({ path: '${step.value || 'screenshot.png'}' });\n`;
          break;
      }
    }

    test += `  }, 30000);\n\n`;
  }

  test += `});\n`;

  return test;
}

function generateTestingLibraryTest(config: {
  componentName: string;
  props?: Record<string, unknown>;
  userInteractions: Array<{
    action: 'click' | 'type' | 'select' | 'hover' | 'clear';
    target: string;
    targetType?: 'role' | 'text' | 'testId' | 'placeholder' | 'label';
    value?: string;
  }>;
  assertions: Array<{
    type: 'visible' | 'text' | 'value' | 'disabled' | 'checked' | 'called';
    target?: string;
    targetType?: 'role' | 'text' | 'testId';
    expected?: string | boolean;
  }>;
}): string {
  const { componentName, props = {}, userInteractions, assertions } = config;

  let test = `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ${componentName} } from './${componentName}';

describe('${componentName}', () => {
  const defaultProps = ${JSON.stringify(props, null, 4).replace(/"([^"]+)":/g, '$1:')};

  const renderComponent = (overrideProps = {}) => {
    return render(<${componentName} {...defaultProps} {...overrideProps} />);
  };

  it('renders correctly', () => {
    renderComponent();
    // Add initial render assertions
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    renderComponent();

`;

  for (const interaction of userInteractions) {
    const getQuery = interaction.targetType === 'role' ? `screen.getByRole('${interaction.target}')` :
                     interaction.targetType === 'text' ? `screen.getByText('${interaction.target}')` :
                     interaction.targetType === 'testId' ? `screen.getByTestId('${interaction.target}')` :
                     interaction.targetType === 'placeholder' ? `screen.getByPlaceholderText('${interaction.target}')` :
                     interaction.targetType === 'label' ? `screen.getByLabelText('${interaction.target}')` :
                     `screen.getByRole('${interaction.target}')`;

    switch (interaction.action) {
      case 'click':
        test += `    await user.click(${getQuery});\n`;
        break;
      case 'type':
        test += `    await user.type(${getQuery}, '${interaction.value}');\n`;
        break;
      case 'select':
        test += `    await user.selectOptions(${getQuery}, '${interaction.value}');\n`;
        break;
      case 'hover':
        test += `    await user.hover(${getQuery});\n`;
        break;
      case 'clear':
        test += `    await user.clear(${getQuery});\n`;
        break;
    }
  }

  test += `\n    // Assertions\n`;

  for (const assertion of assertions) {
    const getQuery = assertion.targetType === 'role' ? `screen.getByRole('${assertion.target}')` :
                     assertion.targetType === 'text' ? `screen.getByText('${assertion.target}')` :
                     assertion.targetType === 'testId' ? `screen.getByTestId('${assertion.target}')` :
                     assertion.target ? `screen.getByRole('${assertion.target}')` : null;

    switch (assertion.type) {
      case 'visible':
        test += `    expect(${getQuery}).toBeVisible();\n`;
        break;
      case 'text':
        test += `    expect(${getQuery}).toHaveTextContent('${assertion.expected}');\n`;
        break;
      case 'value':
        test += `    expect(${getQuery}).toHaveValue('${assertion.expected}');\n`;
        break;
      case 'disabled':
        test += `    expect(${getQuery}).${assertion.expected ? 'toBeDisabled' : 'toBeEnabled'}();\n`;
        break;
      case 'checked':
        test += `    expect(${getQuery}).${assertion.expected ? 'toBeChecked' : 'not.toBeChecked'}();\n`;
        break;
      case 'called':
        test += `    expect(defaultProps.${assertion.target}).toHaveBeenCalled();\n`;
        break;
    }
  }

  test += `  });
});
`;

  return test;
}

function generateSeleniumTest(config: {
  name: string;
  baseUrl?: string;
  language?: 'python' | 'java';
  flows: Array<{
    name: string;
    steps: Array<{
      action: 'get' | 'click' | 'sendKeys' | 'select' | 'wait' | 'assert';
      locator?: string;
      locatorType?: 'id' | 'css' | 'xpath' | 'name' | 'class';
      value?: string;
    }>;
  }>;
}): string {
  const { name, baseUrl = 'http://localhost:3000', language = 'python', flows } = config;

  if (language === 'python') {
    let test = `import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

class Test${name.replace(/\s+/g, '')}:
    @pytest.fixture(autouse=True)
    def setup(self):
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        self.driver = webdriver.Chrome(options=options)
        self.driver.get('${baseUrl}')
        self.wait = WebDriverWait(self.driver, 10)
        yield
        self.driver.quit()

`;

    for (const flow of flows) {
      const methodName = flow.name.toLowerCase().replace(/\s+/g, '_');
      test += `    def test_${methodName}(self):\n`;

      for (const step of flow.steps) {
        const by = step.locatorType === 'id' ? 'By.ID' :
                   step.locatorType === 'css' ? 'By.CSS_SELECTOR' :
                   step.locatorType === 'xpath' ? 'By.XPATH' :
                   step.locatorType === 'name' ? 'By.NAME' :
                   step.locatorType === 'class' ? 'By.CLASS_NAME' : 'By.CSS_SELECTOR';

        switch (step.action) {
          case 'get':
            test += `        self.driver.get('${step.value}')\n`;
            break;
          case 'click':
            test += `        self.wait.until(EC.element_to_be_clickable((${by}, '${step.locator}'))).click()\n`;
            break;
          case 'sendKeys':
            test += `        self.driver.find_element(${by}, '${step.locator}').send_keys('${step.value}')\n`;
            break;
          case 'wait':
            test += `        self.wait.until(EC.presence_of_element_located((${by}, '${step.locator}')))\n`;
            break;
          case 'assert':
            test += `        element = self.driver.find_element(${by}, '${step.locator}')\n`;
            test += `        assert element.is_displayed()\n`;
            break;
        }
      }

      test += `\n`;
    }

    return test;
  } else {
    let test = `import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.*;
import org.openqa.selenium.support.ui.*;
import static org.junit.jupiter.api.Assertions.*;

public class ${name.replace(/\s+/g, '')}Test {
    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeEach
    void setup() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("${baseUrl}");
    }

    @AfterEach
    void teardown() {
        if (driver != null) {
            driver.quit();
        }
    }

`;

    for (const flow of flows) {
      const methodName = flow.name.replace(/\s+/g, '');
      test += `    @Test\n    void test${methodName}() {\n`;

      for (const step of flow.steps) {
        const by = step.locatorType === 'id' ? `By.id("${step.locator}")` :
                   step.locatorType === 'css' ? `By.cssSelector("${step.locator}")` :
                   step.locatorType === 'xpath' ? `By.xpath("${step.locator}")` :
                   step.locatorType === 'name' ? `By.name("${step.locator}")` :
                   `By.cssSelector("${step.locator}")`;

        switch (step.action) {
          case 'get':
            test += `        driver.get("${step.value}");\n`;
            break;
          case 'click':
            test += `        wait.until(ExpectedConditions.elementToBeClickable(${by})).click();\n`;
            break;
          case 'sendKeys':
            test += `        driver.findElement(${by}).sendKeys("${step.value}");\n`;
            break;
          case 'wait':
            test += `        wait.until(ExpectedConditions.presenceOfElementLocated(${by}));\n`;
            break;
          case 'assert':
            test += `        assertTrue(driver.findElement(${by}).isDisplayed());\n`;
            break;
        }
      }

      test += `    }\n\n`;
    }

    test += `}\n`;

    return test;
  }
}

function generatePageObject(config: {
  pageName: string;
  elements: Array<{ name: string; selector: string; type?: 'button' | 'input' | 'link' | 'text' }>;
  methods: Array<{ name: string; steps: string[] }>;
  framework?: 'playwright' | 'cypress' | 'selenium';
}): string {
  const { pageName, elements, methods, framework = 'playwright' } = config;

  if (framework === 'playwright') {
    let pom = `import { Page, Locator } from '@playwright/test';

export class ${pageName}Page {
  readonly page: Page;
${elements.map(el => `  readonly ${el.name}: Locator;`).join('\n')}

  constructor(page: Page) {
    this.page = page;
${elements.map(el => `    this.${el.name} = page.locator('${el.selector}');`).join('\n')}
  }

`;

    for (const method of methods) {
      pom += `  async ${method.name}() {\n`;
      pom += method.steps.map(s => `    ${s}`).join('\n');
      pom += `\n  }\n\n`;
    }

    pom += `}\n`;

    return pom;
  } else if (framework === 'cypress') {
    let pom = `class ${pageName}Page {
${elements.map(el => `  get ${el.name}() { return cy.get('${el.selector}'); }`).join('\n')}

`;

    for (const method of methods) {
      pom += `  ${method.name}() {\n`;
      pom += method.steps.map(s => `    ${s}`).join('\n');
      pom += `\n  }\n\n`;
    }

    pom += `}

export const ${pageName.toLowerCase()}Page = new ${pageName}Page();
`;

    return pom;
  } else {
    const pom = `from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class ${pageName}Page:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    # Locators
${elements.map(el => `    ${el.name.toUpperCase()}_LOCATOR = (By.CSS_SELECTOR, '${el.selector}')`).join('\n')}

    # Elements
${elements.map(el => `    @property
    def ${el.name}(self):
        return self.driver.find_element(*self.${el.name.toUpperCase()}_LOCATOR)`).join('\n\n')}

    # Methods
${methods.map(m => `    def ${m.name}(self):\n${m.steps.map(s => `        ${s}`).join('\n')}`).join('\n\n')}
`;

    return pom;
  }
}

export const e2eTestGenTool: UnifiedTool = {
  name: 'e2e_test_gen',
  description: 'E2E Test Generator: playwright, cypress, puppeteer, testing_library, selenium, page_object',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['playwright', 'cypress', 'puppeteer', 'testing_library', 'selenium', 'page_object'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeE2eTestGen(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: string;

    const defaultFlows = [
      {
        name: 'should complete login flow',
        steps: [
          { action: 'fill' as const, target: '[data-testid="email"]', value: 'user@test.com' },
          { action: 'fill' as const, target: '[data-testid="password"]', value: 'password123' },
          { action: 'click' as const, target: '[data-testid="submit"]' },
          { action: 'assert' as const, target: '[data-testid="dashboard"]' }
        ]
      }
    ];

    switch (args.operation) {
      case 'playwright':
        result = generatePlaywrightTest(args.config || { name: 'Login Tests', flows: defaultFlows });
        break;
      case 'cypress':
        result = generateCypressTest(args.config || {
          name: 'Login Tests',
          flows: defaultFlows.map(f => ({
            ...f,
            steps: f.steps.map(s => ({ ...s, action: s.action === 'fill' ? 'type' as const : s.action }))
          }))
        });
        break;
      case 'puppeteer':
        result = generatePuppeteerTest(args.config || {
          name: 'Login Tests',
          flows: defaultFlows.map(f => ({
            ...f,
            steps: f.steps.map(s => ({ ...s, action: s.action === 'fill' ? 'type' as const : s.action }))
          }))
        });
        break;
      case 'testing_library':
        result = generateTestingLibraryTest(args.config || {
          componentName: 'LoginForm',
          props: { onSubmit: 'jest.fn()' },
          userInteractions: [
            { action: 'type', target: 'email', targetType: 'label', value: 'test@example.com' },
            { action: 'type', target: 'password', targetType: 'label', value: 'password' },
            { action: 'click', target: 'button', targetType: 'role' }
          ],
          assertions: [
            { type: 'called', target: 'onSubmit' }
          ]
        });
        break;
      case 'selenium':
        result = generateSeleniumTest(args.config || {
          name: 'Login Tests',
          language: 'python',
          flows: [{
            name: 'should complete login',
            steps: [
              { action: 'sendKeys', locator: '#email', locatorType: 'css', value: 'user@test.com' },
              { action: 'sendKeys', locator: '#password', locatorType: 'css', value: 'password123' },
              { action: 'click', locator: '#submit', locatorType: 'css' },
              { action: 'assert', locator: '#dashboard', locatorType: 'css' }
            ]
          }]
        });
        break;
      case 'page_object':
        result = generatePageObject(args.config || {
          pageName: 'Login',
          elements: [
            { name: 'emailInput', selector: '[data-testid="email"]', type: 'input' },
            { name: 'passwordInput', selector: '[data-testid="password"]', type: 'input' },
            { name: 'submitButton', selector: '[data-testid="submit"]', type: 'button' }
          ],
          methods: [
            { name: 'login', steps: [
              "await this.emailInput.fill('user@test.com');",
              "await this.passwordInput.fill('password123');",
              "await this.submitButton.click();"
            ]}
          ],
          framework: 'playwright'
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: result };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isE2eTestGenAvailable(): boolean { return true; }
