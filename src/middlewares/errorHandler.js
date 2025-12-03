export const errorHandler = (err, req, res, next) => {
  // express-jwt specific errors (e.g., "No authorization token was found", "invalid token")
  if (err && err.name === "UnauthorizedError") {
    // err.code examples: 'credentials_required', 'invalid_token', custom 'token_expired'
    return res.status(401).json({
      success: false,
      message: err.message || "Unauthorized",
      code: err.code || "unauthorized",
    });
  }

  // Handle your custom ApiError (if used elsewhere)
  if (err && typeof err === "object" && "statusCode" in err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }

  // Fallback for any other unhandled error
  console.error("[unhandled error]", err);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};
