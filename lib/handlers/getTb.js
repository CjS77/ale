/**
 * Return a tb; list of all accounts and balance
 *
 * GET: /books/{bookId}/tb
 * 
 * query:
 *   startDate {string} Start date for Profit or Loss account.
 *   endDate {string} End date for  Profit or Loss and Balance sheet.
 *   
 */
const Book = require('../../models/book');
const Account = require('../../models/account');
const { AleError, codes } = require('../errors');

exports.middleware = checkBook;

function checkBook(req, res, next) {
    let id = parseInt(req.params.bookId);
    Book.findByPk(id).then(book => {
        if (!book) {
            throw new AleError(`Book specified in params does not exist`, codes.BookDoesNotExist);
        }
        req.book = book;
        return next();
    }).catch(err => {
        return next(err);
    });
};

exports.handler = function getTb(req, res, next) {
    let id = parseInt(req.params.bookId);
    const { book } = req;

    // Get all accounts for the book and map through to get balances
    Account.getAccounts(id).then(async result => {
        let runningCreditTotal = 0;
        let runningDebitTotal = 0;
        const balances = result.map(async result => {
            const account = result.accountName;
            const balance = await book.getBalance({ account });
            runningCreditTotal += balance.creditTotal;
            runningDebitTotal += balance.debitTotal
            return { [result.accountName]: balance, "increasingEntry": result.toIncrease }
        })
        const resultArray = await Promise.all(balances);
        resultArray.unshift({"isTbBalanced": runningCreditTotal === -runningDebitTotal })
        res.json(resultArray);
    }).catch(err => {
        return next(err);
    });
};

