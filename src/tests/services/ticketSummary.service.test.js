
// src/tests/Services/ticketSummary.service.test.js
import { jest } from "@jest/globals";

// -----------------------------
// Mock logger (match service import path string exactly)
// Your service imports: "../config/logger.js"
// From this test location, mock: "../../config/logger.js"
// -----------------------------
await jest.unstable_mockModule("../../config/logger.js", () => ({
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

// Import mocked logger so we can assert calls (same spec as mock)
const logger = (await import("../../config/logger.js")).default;

// Import service AFTER all mocks are registered
const { generateTicketSummary } = await import("../../services/ticketSummary.service.js");

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

function ticketsSample() {
  return [
    { status: "Resolved" },
    { status: " Open " },    // trimming should normalize to "open"
    { status: "resolved" },  // case-insensitive same bucket as Resolved
  ];
}

// -----------------------------
// Suite
// -----------------------------
describe("generateTicketSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Restore env without reassigning the special object
    Object.keys(process.env).forEach((k) => {
      if (!(k in ORIGINAL_ENV)) delete process.env[k];
    });
    Object.assign(process.env, ORIGINAL_ENV);

    clearAzureEnv();
  });

  afterAll(() => {
    Object.keys(process.env).forEach((k) => {
      if (!(k in ORIGINAL_ENV)) delete process.env[k];
    });
    Object.assign(process.env, ORIGINAL_ENV);
  });

  test("returns 'No ...' when tickets are empty (short-circuit path)", async () => {
    const summary = await generateTicketSummary([], "Incident", "October 2025");
    expect(summary).toBe("No incident tickets were reported during October 2025.");
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("returns default summary when Azure credentials are missing", async () => {
    const tickets = ticketsSample();
    clearAzureEnv();

    const summary = await generateTicketSummary(tickets, "Health", "September 2025");

    // Since entries order depends on first occurrence, allow either order of status segments
    expect(summary).toMatch(
      /^For the month of September 2025, our team handled 3 health tickets, out of which (2 are in Resolved and 1 are in Open|1 are in Open and 2 are in Resolved)\.$/
    );

    // The service logs an error for missing creds
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/Azure OpenAI credentials not configured/i)
    );
  });

  test("returns Azure summary when credentials present and response has content", async () => {
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "For the month of August 2025, our team handled 2 incident tickets, out of which 1 are in Resolved and 1 are in Open.",
          },
        },
      ],
    });

    const summary = await generateTicketSummary(
      [{ status: "Resolved" }, { status: "Open" }],
      "Incident",
      "August 2025"
    );

    expect(summary).toBe(
      "For the month of August 2025, our team handled 2 incident tickets, out of which 1 are in Resolved and 1 are in Open."
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/Successfully generated Incident ticket summary/)
    );
  });

  test("falls back when Azure returns empty content", async () => {
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    const summary = await generateTicketSummary(
      [{ status: "Open" }, { status: "Open" }, { status: "Resolved" }],
      "Incident",
      "July 2025"
    );

    expect(summary).toMatch(
      /^For the month of July 2025, our team handled 3 incident tickets, out of which (2 are in Open and 1 are in Resolved|1 are in Resolved and 2 are in Open)\.$/
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Empty response from Azure OpenAI/i));
  });

  test("falls back on Azure error", async () => {
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    createMock.mockRejectedValue(new Error("Upstream error"));

    const summary = await generateTicketSummary(
      [{ status: "In Progress" }, { status: "Resolved" }, { status: "in progress" }],
      "Health",
      "June 2025"
    );

    expect(summary).toMatch(
      /^For the month of June 2025, our team handled 3 health tickets, out of which (2 are in In Progress and 1 are in Resolved|1 are in Resolved and 2 are in In Progress)\.$/
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/❌ Error generating Health ticket summary:/),
      expect.any(Error)
    );
  });

  test("status normalization: trim & case-insensitive counting", async () => {
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    // Force fallback path by returning empty AI content
    createMock.mockResolvedValue({
      choices: [{ message: { content: "   " } }],
    });

    const tickets = [
      { status: "  resolved " },
      { status: "Resolved" },
      { status: "RESOLVED" },
      { status: "open" },
      { status: "Open" },
      { status: "IN PROGRESS" },
      { status: "in progress" },
      { status: "In Progress" },
      { status: " " },          // ignored after trim
      { status: undefined },    // ignored
      {},                       // ignored
    ];

    const summary = await generateTicketSummary(tickets, "Incident", "May 2025");

    // Valid entries total: 3 + 2 + 3 = 8
    expect(summary).toMatch(
      /^For the month of May 2025, our team handled 8 incident tickets, out of which .+\.$/
    );
    expect(summary).toEqual(expect.stringMatching(/3 are in Resolved/));
    expect(summary).toEqual(expect.stringMatching(/2 are in Open/));
    expect(summary).toEqual(expect.stringMatching(/3 are in In Progress/));
  });
});
