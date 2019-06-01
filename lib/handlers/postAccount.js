/**
 * Create a new account
 *
 * POST: /books/{bookId}/accounts
 * 
 * body:
 *   accountCode {integer} Unique code for the new account.
 *   accountName {string} Name for new account.
 *   toIncrease {string} Posting to increase account.
 *   accountClassification {string} Is this a 'Balance sheet' or 'P or L' account.
 *   accountType {string}
 *   subAccountType {string}
 *   memo {string} Some description of the account.
 *   bookId {integer} Already created book for account to be linked to.
 *   
 */
const { codes, AleError } = require('../errors');
const Book = require('../../models/book');
const Account = require('../../models/Account');

exports.middleware = checkBook;

function checkBook(req, res, next) {
    let id = parseInt(req.params.bookId);
    Book.findByPk(id).then(res => {
        if (!res) {
            throw new AleError(`Book specified in params does not exist`, codes.BookDoesNotExist);
        }
        return next();
    }).catch(err => {
        return next(err);
    });
};

exports.handler = function postAccount(req, res, next) {
    let id = parseInt(req.params.bookId);
    let acctCode = parseInt(req.body.accountCode);
    const { accountName, toIncrease, accountClassification, accountType, subAccountType, memo } = req.body;

    Account.getOrCreateBook(acctCode, accountName, toIncrease, accountClassification, accountType, subAccountType, memo, id).then(result => {

        return result;
    }).then(e => {
        return res.json({
            success: true,
            message: 'New account has been created successfully',
            id: e
        });
    }).catch(err => {
        return next(err);
    });
};
