/**
 * List all current books
 *
 * GET: /books/
 * 
 */
exports.handler = function getBooks(req, res, next) {
  res.send('getBooks')
  next()
}
