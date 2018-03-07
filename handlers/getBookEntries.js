/**
 * List entries in book
 *
 * GET: /books/{bookId}/entries
 * 
 * path:
 *   bookId {string} The book to extract entries from.
 *   
 * query:
 *   startDate {string} The start date for entries.
 *   endDate {string} The end date for entries.
 *   
 */
exports.handler = function getBookEntries(req, res, next) {
  res.send('getBookEntries')
  next()
}
