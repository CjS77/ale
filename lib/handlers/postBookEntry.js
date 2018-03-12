/**
 * Post a new Journal entry
 *
 * POST: /books/{bookId}/ledger
 * 
 * body:
 *   memo {string} The Journal Entry description.
 *   timestamp {string} The time stamp for the journal entry.
 *   transactions {array}
 *   
 */
const {codes, AleError} = require('../errors');
const Book = require('../../models/book');

exports.handler = function postBookEntry(req, res, next) {
    let id = parseInt(req.params.bookId);
    let bookInfo;
    Book.findById(id).then(book => {
        if (!book) {
            throw new AleError(`Book with id ${id} does not exist`, codes.BookDoesNotExist);
        }
        bookInfo = book.values();
        const candidateEntry = req.body;
        const ts = new Date(candidateEntry.timestamp);
        if (isNaN(ts.valueOf())) {
            throw new AleError(`Invalid Journal entry timestamp: ${candidateEntry.timestamp}`, codes.ValidationError);
        }
        const newEntry = book.newJournalEntry(candidateEntry.memo, ts);
        candidateEntry.transactions.forEach((tx, i) => {
            const amount = parseFloat(tx.credit || 0) - parseFloat(tx.debit || 0);
            if (!isFinite(amount)) {
                throw new AleError(`Invalid credit and/or debit amount for transaction ${i}`, codes.ValidationError);
            }
            const isCredit = amount > 0;
            const absAmount = Math.abs(amount);
            const account = tx.account;
            const exchangeRate = parseFloat(tx.exchangeRate) || 1.0;
            const currency = tx.currency || bookInfo.currency;
            newEntry.newTransaction(account, absAmount, isCredit, currency, exchangeRate);
        });
        return newEntry.commit();
    }).then(e => {
        return res.json({
            success: true,
            message: 'Journal Entry has been saved',
            id: e.id
        });
    }).catch(err => {
        return next(err);
    });
};
