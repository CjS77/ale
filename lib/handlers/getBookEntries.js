const Book = require('../../models/book');

/**
 * Fetch the ledger
 *
 * GET: /books/{bookId}/ledger
 * 
 * path:
 *   bookId {string} The book to extract entries from.
 *   
 * query:
 *   startDate {string} The start date for entries.
 *   endDate {string} The end date for entries.
 *   perPage {integer} The number of results per page.
 *   page {integer} The page number.
 *   
 */
exports.handler = function getBookEntries(req, res, next) {
    const bookName = req.body.book;
    let startDate;
    let endDate;
    Book.getBook(bookName).then(book => {
        if (req.body.startDate) {
            startDate = new Date(req.body.startDate);
        }
        if (req.body.endDate) {
            endDate = new Date(req.body.endDate);
        }
        return book.getLedger({startDate, endDate, page: req.body.page, perPage: req.body.perPage});
    }).then(ledger => {
        const result = {
            book: bookName,
            startDate: startDate && startDate.valueOf(),
            endDate: endDate && endDate.valueOf(),
        };
        result.entries = ledger;
        res.json(result);
    }).catch(err => {
        return next(err);
    });
};
