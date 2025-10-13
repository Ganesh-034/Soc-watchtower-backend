export default {
  testEnvironment: "node",
  transform: {}, // disable Babel; we’re using native ESM
  moduleFileExtensions: ["js", "json"],
  roots: ["<rootDir>/src/tests"],
  verbose: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!src/config/**"],
  setupFiles: ["dotenv/config"],
};
