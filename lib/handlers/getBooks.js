/**
 * List all current books
 *
 * GET: /books/
 * 
 */
const Book = require('../../models/book');

exports.handler = function getBooks(req, res, next) {
    // Get books and return data values
    Book.listBooks().then(books => {
        res.json(books.map(b => b.values()));
    }).catch(err => {
        next(err);
    });
};
