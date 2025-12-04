
// src/tests/Services/incidentView.service.test.js
import { jest } from "@jest/globals";

/**
 * Service under test: src/services/incidentView.service.js
 * It imports:
 *   - axios
 *   - node:https (Agent)
 *   - ApiError from "../utils/ApiError.js"
 *   - logger from "../config/logger.js"
 *   - Incident from "../models/incident.model.js"
 *
 * From this test location (src/tests/Services), the relative mock/import paths are:
 *   - "../../utils/ApiError.js"
 *   - "../../config/logger.js"
 *   - "../../models/incident.model.js"
 *   - "../../services/incidentView.service.js"
 */

// -----------------------------
// Mock logger (match service import string exactly)
// -----------------------------
await jest.unstable_mockModule("../../config/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
const logger = (await import("../../config/logger.js")).default;

// -----------------------------
// Mock ApiError so we can assert instanceof and messages
// -----------------------------
class ApiErrorMock extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}
await jest.unstable_mockModule("../../utils/ApiError.js", () => ({
  ApiError: ApiErrorMock,
}));
const { ApiError } = await import("../../utils/ApiError.js");

// -----------------------------
// Mock axios.post
// -----------------------------
const axiosPost = jest.fn();
await jest.unstable_mockModule("axios", () => ({
  default: { post: axiosPost },
}));

// -----------------------------
// Mock https.Agent (to avoid constructing real TLS agent)
// -----------------------------
const AgentMock = jest.fn(function Agent() {});
await jest.unstable_mockModule("node:https", () => ({
  default: { Agent: AgentMock },
  Agent: AgentMock,
}));

// -----------------------------
// Mock Incident model: findOne()
// -----------------------------
const mockFindOne = jest.fn();
await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: { findOne: mockFindOne },
}));

// -----------------------------
// Import the service AFTER all mocks
// -----------------------------
const { getIncidentDetails } = await import("../../services/incidentView.service.js");

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

// Sample incident returned from DB
const sampleIncident = {
  _id: "INC-123",
  customer_name: "ajinomoto-thailand(ajt)",
  subject: "Suspicious login",
  status: 4,
  description: "User logged in from unusual location",
};

// -----------------------------
// Suite
// -----------------------------
describe("incidentView.service.getIncidentDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Restore env cleanly without reassigning the object
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

  test("throws when required params are missing", async () => {
    await expect(getIncidentDetails(undefined, "ajinomoto-thailand(ajt)"))
      .rejects
      .toThrow("Both incidentId and customerName are required for fetching incident details.");

    await expect(getIncidentDetails("INC-123", undefined))
      .rejects
      .toThrow("Both incidentId and customerName are required for fetching incident details.");

    expect(mockFindOne).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("throws ApiError(400) when incident not found for given customer", async () => {
    // DB returns null
    mockFindOne.mockResolvedValueOnce(null);

    await expect(getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)"))
      .rejects
      .toThrow(ApiError);

    // Validate logger.warn was called with unauthorized message
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Unauthorized access attempt: User from customer "ajinomoto-thailand\(ajt\)"/)
    );

    // Ensure query used correct filter
    expect(mockFindOne).toHaveBeenCalledWith({
      _id: "INC-123",
      customer_name: "ajinomoto-thailand(ajt)",
    });
  });

  test("throws ApiError(500) when Azure OpenAI config is missing", async () => {
    mockFindOne.mockResolvedValueOnce(sampleIncident);
    // No env set → service throws Error("Azure OpenAI configuration missing.")
    // Catch block rewraps into ApiError(status=500, message="Failed to fetch incident details")

    await expect(getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)"))
      .rejects
      .toThrow(ApiError);

    try {
      await getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode ?? err.status).toBe(500);
      expect(err.message).toBe("Failed to fetch incident details");
    }

    // Agent constructor may be referenced only when axios.post is called;
    // Here axios.post isn't reached due to missing env, so Agent isn't used.
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test("returns incident + summary when Azure responds with content", async () => {
    mockFindOne.mockResolvedValueOnce(sampleIncident);
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    axiosPost.mockResolvedValueOnce({
      data: {
        choices: [
          { message: { content: "User logged in from a new geo; SOC investigated and confirmed legitimacy." } },
        ],
      },
    });

    const result = await getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)");

    // Validate axios.post called with endpoint and headers
    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringContaining("https://example.cognitiveservices.azure.com"),
      expect.objectContaining({
        messages: expect.any(Array),
        temperature: 0.3,
        max_tokens: 400,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "api-key": "test-key",
        }),
        httpsAgent: expect.any(AgentMock),
      })
    );

    // Return value
    expect(result).toEqual({
      incident: sampleIncident,
      summary: "User logged in from a new geo; SOC investigated and confirmed legitimacy.",
    });

    // Logging
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Incident fetched for ID: INC-123/));
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Summary generated for incident ID: INC-123/));
  });

  test("returns default summary text when Azure returns empty content", async () => {
    mockFindOne.mockResolvedValueOnce(sampleIncident);
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    // Empty content -> service uses "No summary generated."
    axiosPost.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "" } }],
      },
    });

    const result = await getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)");

    expect(result.summary).toBe("No summary generated.");
    expect(result.incident).toEqual(sampleIncident);
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Summary generated for incident ID: INC-123/));
  });

  test("wraps axios error response into ApiError(status, message)", async () => {
    mockFindOne.mockResolvedValueOnce(sampleIncident);
    setAzureEnv({
      endpoint: "https://example.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview",
      key: "test-key",
      deployment: "gpt-4o-mini",
    });

    axiosPost.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: "Rate limit exceeded" },
      },
      message: "Too Many Requests",
    });

    await expect(getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)"))
      .rejects
      .toThrow(ApiError);

    try {
      await getIncidentDetails("INC-123", "ajinomoto-thailand(ajt)");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode ?? err.status).toBe(429);
      expect(err.message).toBe("Rate limit exceeded");
    }

    // Error logging contains status & data
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Error fetching incident details for ID INC-123:/));
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Response status: 429/));
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Response data:/));
  });
});
