/**
 * postBooks
 *
 * POST: /books/
 * 
 * body:
 *   id {string} The id, or name of the book.
 *   baseCurrency {string}
 *   
 */
exports.handler = function postBooks(req, res, next) {
  res.json(req.body);
  next()
};
