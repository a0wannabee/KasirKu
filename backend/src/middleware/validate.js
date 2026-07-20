const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains. Every route that accepts a request
 * body/query/params MUST declare validation chains and use this guard —
 * this is what stands between raw user input and business logic / the DB.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Input tidak valid.',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
