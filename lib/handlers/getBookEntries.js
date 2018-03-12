const Book = require('../../models/book');
const { AleError, codes } = require('../errors');
/**
 * Fetch the ledger
 *
 * GET: /books/{bookId}/ledger
 * 
 * path:
 *   bookId {integer} The book to extract entries from.
 *   
 * query:
 *   startDate {string} The start date for entries.
 *   endDate {string} The end date for entries.
 *   perPage {integer} The number of results per page.
 *   page {integer} The page number.
 *   
 */
exports.handler = function getBookEntries(req, res, next) {
    let startDate;
    let endDate;
    let id = parseInt(req.params.bookId);
    let bookInfo;
    Book.findById(id).then(book => {
        if (!book) {
            throw new AleError(`Book with id ${id} does not exist`, codes.BookDoesNotExist);
        }
        if (req.query.startDate) {
            startDate = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
            endDate = new Date(req.query.endDate);
        }
        bookInfo = book.values();
        return book.getLedger({startDate, endDate, page: req.query.page, perPage: req.query.perPage});
    }).then(ledger => {
        const result = {
            book: bookInfo,
            startDate: startDate && startDate.valueOf(),
            endDate: endDate && endDate.valueOf(),
        };
        result.entries = ledger.map(e => {
            const entry = e.values();
            entry.transactions = e.transactions.map(tx => tx.values());
            return entry;
        });
        return res.json(result);
    }).catch(err => {
        return next(err);
    });
};
