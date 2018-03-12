const Book = require('../../models/book');
const { AleError, codes } = require('../errors');
/**
 * postBooks
 *
 * POST: /books/
 * 
 * body:
 *   id {integer} The id for the book the book.
 *   name {string} The name of the book.
 *   currency {string} The currency the book is referenced in.
 *   createdAt {number} The timestamp of when the book was created.
 *   updatedAt {number} The timestamp of the last time this entry was modified.
 *   
 */
exports.handler = function postBooks(req, res, next) {
    const { name, currency } = req.body || {};
    if (!name || !currency) {
        const err = new AleError('Missing name or currency', codes.MissingInput);
        return next(err);
    }
    Book.getOrCreateBook(name, currency).then(result => {
        const obj = Object.assign({
            success: result.isNew,
            message: result.isNew ? `Book ${name} (${currency}) created` : `Book ${name} already exists`
        }, result.book.values());
        res.json(obj);
    }).catch(err => {
        return next(err);
    });
};
