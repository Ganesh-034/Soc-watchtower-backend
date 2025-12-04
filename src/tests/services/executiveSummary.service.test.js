
// src/tests/executiveSummary.service.test.js
import { jest } from "@jest/globals";

// -----------------------------
// Mock logger (match your mapper: omit ".js")
// -----------------------------
await jest.unstable_mockModule("../../config/logger", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// -----------------------------
// Mock "@azure/openai/types" to avoid runtime resolution
// -----------------------------
await jest.unstable_mockModule("@azure/openai/types", () => ({}));

// -----------------------------
// Mock AzureOpenAI from "openai"
// -----------------------------
const createMock = jest.fn();
await jest.unstable_mockModule("openai", () => ({
  AzureOpenAI: class {
    constructor(opts) {
      this.endpoint = opts.endpoint;
      this.apiKey = opts.apiKey;
      this.deployment = opts.deployment;
      this.apiVersion = opts.apiVersion;
    }
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

// Import mocked logger so we can assert calls
const logger = (await import("../../config/logger")).default;

// Import service AFTER all mocks are registered
const { generateExecutiveSummary } = await import("../../services/executiveSummary.service.js");

// -----------------------------
// Helpers
// -----------------------------
const ORIGINAL_ENV = { ...process.env };

function setAzureEnv({ endpoint, key, deployment }) {
  process.env.AZURE_OPENAI_ENDPOINT = endpoint ?? "";
  process.env.AZURE_OPENAI_KEY = key ?? "";
  process.env.AZURE_OPENAI_DEPLOYMENT_ID = deployment ?? "";
}

function clearAzureEnv() {
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT_ID;
}

function buildSampleData() {
  return {
    reportMonth: "October 2025",
    severityChartLabels: ["September 2025", "October 2025"],
    severityChartData: {
      high: [1, 2],
      medium: [0, 3],
      low: [5, 1],
    },
    // Not used by default summary, but present for completeness
    detectionChartLabels: ["Entra ID", "O365", "Defender"],
    detectionChartData: {
      high: [1, 1, 0],
      medium: [0, 2, 1],
      low: [0, 1, 0],
    },
    subStatusChartLabels: ["True Positive", "False Positive"],
    subStatusChartData: [1, 2],
    incidentTickets: [
      { priority: "High", status: "Resolved" },
      { priority: "Medium", status: "Closed" },
      { priority: "Medium", status: "Open" },
    ],
    healthTickets: [
      { incidentType: "O365", status: "Resolved" },
      { incidentType: "Entra ID", status: "Open" },
    ],
  };
}

// -----------------------------
// Test Suite
// -----------------------------
describe("generateExecutiveSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env to a known clean state
    Object.keys(process.env).forEach((k) => {
      if (!(k in ORIGINAL_ENV)) delete process.env[k];
    });
    Object.assign(process.env, ORIGINAL_ENV);
    clearAzureEnv();
  });

  afterAll(() => {
    Object.assign(process.env, ORIGINAL_ENV);
  });

  test("returns default summary when Azure OpenAI credentials are missing", async () => {
    const data = buildSampleData();
    const customer = "ACME";

    clearAzureEnv(); // no creds

    const summary = await generateExecutiveSummary(data, customer);

    expect(typeof summary).toBe("string");
    expect(summary).toContain(customer);
    expect(summary).toContain(data.reportMonth);
    // Default summary contains these phrases from helpers
    expect(summary).toContain("This month saw a total of 6 incidents");
    expect(summary).toContain("The team handled 3 incident tickets.");
    expect(summary).toContain("System health monitoring identified 2 health tickets.");

    // Logger should note missing configuration
    expect(logger.error).toHaveBeenCalledWith("Azure OpenAI credentials not configured");
  });

  test("returns Azure summary when credentials are present and response has content", async () => {
    const data = buildSampleData();
    const customer = "Contoso";

    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockResolvedValue({
      choices: [
        {
          message: { content: "• Line 1\n• Line 2\n• Line 3" },
        },
      ],
    });

    const summary = await generateExecutiveSummary(data, customer);

    expect(summary).toBe("• Line 1\n• Line 2\n• Line 3");
    // Called at least once with info
    expect(logger.info).toHaveBeenCalled();
    // No fallback logs
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining("Error generating executive summary"));
  });

  test("falls back to default summary when Azure returns empty content", async () => {
    const data = buildSampleData();
    const customer = "Fabrikam";

    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockResolvedValue({
      choices: [
        {
          message: { content: "" },
        },
      ],
    });

    const summary = await generateExecutiveSummary(data, customer);

    expect(typeof summary).toBe("string");
    expect(summary).toContain("This month saw a total of 6 incidents");
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("⚠️ Empty response from Azure OpenAI"));
  });

  test("falls back to default summary when Azure client throws an error", async () => {
    const data = buildSampleData();
    const customer = "Northwind";

    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockRejectedValue(new Error("Upstream error"));

    const summary = await generateExecutiveSummary(data, customer);

    expect(typeof summary).toBe("string");
    expect(summary).toContain("This month saw a total of 6 incidents");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("❌ Error generating executive summary for Northwind:"),
      expect.any(Error)
    );
  });
});
