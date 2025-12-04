import { expressjwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import dotenv from "dotenv";
dotenv.config();

// Configuration for Azure AD
const config = {
  tenantId: process.env.AZURE_AD_TENANT_ID,
  clientId: process.env.AZURE_AD_CLIENT_ID,
};
if (!config.tenantId || !config.clientId) {
  console.error(
    "FATAL ERROR: AZURE_AD_TENANT_ID or AZURE_AD_CLIENT_ID is not set in the environment variables."
  );
  process.exit(1); // Exit the process if critical config is missing
}

// This middleware will verify the token and attach the decoded payload to req.auth
export const authenticate = expressjwt({
  // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    // Construct the JWKS URI using the tenant ID from your token
    jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
  }),

  // Validate the audience and the issuer
  audience: config.clientId,
  issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
  algorithms: ["RS256"],

  // This is a custom function to handle errors from express-jwt
  onExpired: (req, res, next) => {
    throw new ApiError(401, "Access token has expired");
  },
});

// This is a second middleware to run after authentication.
// It checks for the customer_name and attaches it to the request object.
export const attachCustomerInfo = asyncHandler(async (req, res, next) => {
  // The decoded token payload is attached to req.auth by the 'authenticate' middleware
  if (!req.auth) {
    throw new ApiError(401, "Authentication failed. Token not found.");
  }

  const customerName = req.auth.customer_name;
  const customeroid = req.auth.oid;

  if (!customerName) {
    // Log the full token for debugging purposes
    console.error("Customer name not found in token. Full payload:", req.auth);
    throw new ApiError(
      403,
      "Forbidden: customer_name claim is missing in the access token."
    );
  }

  // Attach the customer name to the request for use in downstream controllers/services
  req.customerName = customerName;
  req.customeroid = customeroid;
  console.log(
    `Successfully authenticated user for customer: ${req.customerName} and ${req.customeroid}`
  );

  next();
});
