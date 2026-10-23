const crypto = require("node:crypto");

const getReviewCsrfToken = (req) => {
  if (!req.session.reviewCsrfToken) {
    req.session.reviewCsrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.reviewCsrfToken;
};

const isValidReviewCsrfToken = (req) => {
  const expected = req.session.reviewCsrfToken;
  const provided = req.body && req.body._csrf;
  if (typeof expected !== "string" || typeof provided !== "string") return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

module.exports = { getReviewCsrfToken, isValidReviewCsrfToken };
