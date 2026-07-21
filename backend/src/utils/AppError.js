/**
 * AppError — a structured error that is SAFE to expose to the client.
 *
 * Business logic that wants to return a meaningful HTTP error to the frontend
 * should throw `new AppError(message, statusCode)`.  The central error handler
 * in app.js will detect this class and forward `message` as-is, even in
 * production, because it was deliberately written by application code rather
 * than being an unexpected internal exception.
 *
 * Internal failures (network, DB, third-party APIs) should NOT throw AppError
 * — they will be caught and mapped to a generic 500 message so that
 * implementation details are never leaked to the client.
 */
class AppError extends Error {
  /**
   * @param {string} message  Human-readable message safe to send to the client.
   * @param {number} status   HTTP status code (4xx preferred for client errors).
   * @param {string} [code]   Optional machine-readable error code for the frontend.
   */
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };
