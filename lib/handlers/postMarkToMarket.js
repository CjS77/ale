/**
 * Mark the account(s) to market
 *
 * POST: /books/{bookId}/marktomarket
 * 
 * body:
 *   accounts {array}
 *   exchangeRates {object}
 *   
 */
const Book = require('../../models/book');
const {AleError, codes} = require('../errors');
exports.handler = function postMarketToMarket(req, res, next) {
    let id = parseInt(req.params.bookId);
    Book.findById(id).then(book => {
        if (!book) {
            throw new AleError(`Book with id ${id} does not exist`, codes.BookDoesNotExist);
        }
        return book.markToMarket({ account: req.body.accounts }, req.body.exchangeRates);
    }).then(profit => {
        res.json(profit);
    }).catch(err => {
        return next(err);
    });
};
