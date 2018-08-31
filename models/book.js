/*
 * @license
 * Copyright 2018 Cayle Sharrock
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under the License.
 *
 */

const Sequelize = require('sequelize');
const sequelize = require('./connection');
const BigNumber = require('bignumber.js');
const JournalEntry = require('./journal');
const Transaction = require('./transaction');
const {ZERO} = require('./types');
const {AleError, codes} = require('../lib/errors');
const Op = Sequelize.Op;

/**
 * A Book contains many journal entries
 */
const Book = sequelize.define('book', {
    name: {type: Sequelize.TEXT, unique: true},
    quoteCurrency: {type: Sequelize.STRING, defaultValue: 'USD'}
});

JournalEntry.belongsTo(Book, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
Transaction.belongsTo(Book, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'}); // Redundant, but saves double JOINS in a few queries
Book.JournalEntries = Book.hasMany(JournalEntry, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});

/**
 * Creates a new journal entry, but doesn't persist it to the DB until entry.commit() is called
 */
Book.prototype.newJournalEntry = function(memo, date = null) {
    return JournalEntry.build({
        bookId: this.id,
        memo: memo,
        quoteCurrency: this.quoteCurrency,
        timestamp: date || new Date()
    });
};

/**
 * Returns journal entries matching the given constraints
 * @param query
 * @param query.startDate {string|number}
 * @param query.endDate {string|number}
 * @param query.memo {string}
 * @return Promise<JournalEntry[]>
 */
Book.prototype.getJournalEntries = function(query) {
    const parsedQuery = parseQuery(this.getDataValue('id'), query);
    return JournalEntry.findAll(parsedQuery).then(rows => {
        const results = rows.map(r => r.values());
        return results;
    }).catch(e => {
        const err = new AleError(`JournalEntry query failed. ${e.message}`, codes.DatabaseQueryError);
        return sequelize.Promise.reject(err);
    });
};
/**
 * Returns a promise fo the balance of the given account.
 * @param query
 * @param query.account {string|Array} [acct, subacct, subsubacct]
 * @param query.startDate {string|number} Anything parseable by new Date()
 * @param query.endDate {string|number} Anything parseable by new Date()
 * @param query.perPage {number} Limit results to perPage
 * @param query.page {number} Return page number
 * @param inQuoteCurrency boolean - whether to convert balance to the quote currency or not (default: false)
 * @return {creditTotal, debitTotal, balance, currency, numTransactions}
 */
Book.prototype.getBalance = function(query, inQuoteCurrency = false) {
    query = parseQuery(this.getDataValue('id'), query);
    const credit = inQuoteCurrency ? sequelize.literal('credit * "exchangeRate"') : sequelize.col('credit');
    const debit = inQuoteCurrency ? sequelize.literal('debit * "exchangeRate"') : sequelize.col('debit');
    query.attributes = [
        [sequelize.fn('SUM', credit), 'creditTotal'],
        [sequelize.fn('SUM', debit), 'debitTotal'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'numTransactions'],
        [sequelize.fn('MAX', sequelize.col('currency')), 'currency']
    ];
    return Transaction.findAll(query).then(result => {
        result = result.shift();
        if (!result) {
            return {
                balance: 0,
                notes: 0
            };
        }
        const creditTotal = +result.get('creditTotal');
        const debitTotal = +result.get('debitTotal');
        const total = creditTotal - debitTotal;
        return {
            creditTotal: creditTotal,
            debitTotal: debitTotal,
            balance: total,
            currency: inQuoteCurrency ? this.quoteCurrency : result.get('currency'),
            numTransactions: +result.get('numTransactions')
        };
    });
};

/**
 * Return all transactions ordered by time for a given book (subject to the constraints passed in the query)
 * @param query
 * @param query.startDate {string|number} Anything parseable by new Date()
 * @param query.endDate {string|number} Anything parseable by new Date()
 * @param query.perPage {number} Limit results to perPage
 * @param query.page {number} Return page number
 * @param query.newestFirst {boolean} Order results by desc timestamp, (default : false).
 * @return {Array} of JournalEntry
 */
Book.prototype.getLedger = function(query) {
    query = parseQuery(this.get('id'), query);
    query.order = query.order || [['timestamp', 'ASC']];
    query.include = [ Transaction ];
    return JournalEntry.findAll(query);
};

/**
 * Return all transactions ordered by time for a given book (subject to the constraints passed in the query)
 * @param query
 * @param query.account {string|Array} A single, or array of accounts to match. Assets will match Assets and Assets:*
 * @param query.perPage {number} Limit results to perPage
 * @param query.page {number} Return page number
 * @param query.newestFirst {boolean} Order results by desc timestamp, (default : false).
 * @return {Array} of Transaction
 */
Book.prototype.getTransactions = function(query) {
    query = parseQuery(this.get('id'), query);
    query.order = query.order || [['timestamp', 'ASC']];
    return Transaction.findAll(query);
};

Book.prototype.voidEntry = function(journalId, reason) {
    return JournalEntry.findById(journalId)
        .then(entry => {
            if (!entry) {
                return sequelize.Promise.reject(new AleError(`Journal entry not found with ID ${journalId}`, codes.TransactionIDNotFound));
            }
            return entry.voidEntry(this, reason);
        });
};

Book.prototype.listAccounts = function() {
    return Transaction.aggregate('account', 'distinct', {
        where: {
            bookId: this.getDataValue('id')
        },
        plain: false
    }).then(results => {
        // Make array
        const final = [];
        for (let result of results) {
            const paths = result.distinct.split(':');
            const prev = [];
            for (let acct of paths) {
                prev.push(acct);
                final.push(prev.join(':'));
            }
        }
        return Array.from(new Set(final)); // uniques
    });
};

Book.prototype.markToMarket = function(query, exchangeRates) {
    const rates = Book.normalizeRates(this.quoteCurrency, exchangeRates);
    if (!rates) {
        const err = new AleError('Cannot mark-to-market if no current exchange rates are supplied', codes.MissingInput);
        return sequelize.Promise.reject(err);
    }
    query = parseQuery(this.getDataValue('id'), query);
    query.attributes = [
        'account',
        'currency',
        [sequelize.fn('SUM', sequelize.literal('credit - debit')), 'balance']
    ];
    query.group = ['account', 'currency'];
    return Transaction.findAll(query).then(txs => {
        const result = {};
        let profit = ZERO;
        txs.forEach(tx => {
            if (!rates[tx.currency]) {
                throw new AleError(`A ${tx.currency} transaction exists, but its current exchange rate was not provided`, codes.ExchangeRateNotFound);
            }
            let currentBal = (new BigNumber(tx.get('balance'))).div(rates[tx.currency]);
            profit = profit.plus(currentBal);
            result[tx.get('account')] = +currentBal;
        });
        result.unrealizedProfit = +profit;
        return result;
    }).catch(err => {
        return sequelize.Promise.reject(err);
    });
};

Book.normalizeRates = function(currency, rates) {
    let base = rates[currency];
    if (!base) {
        return null;
    }
    base = new BigNumber(base);
    const result = Object.assign({}, rates);
    for (let cur in result) {
        result[cur] = +(new BigNumber(rates[cur]).div(base));
    }
    return result;
};

/**
 * Convert object into Sequelise 'where' clause
 * @param query {{account: {acct, subacct, subsubacct}, startDate, endDate, perPage, page, memo}}
 * @returns {Array} of Book models
 */
function parseQuery(id, query) {
    let account;
    const parsed = {where: {bookId: id}};
    query = query || {};
    if (query.perPage) {
        const perPage = query.perPage || 25;
        parsed.offset = ((query.page || 1) - 1) * perPage;
        parsed.limit = query.perPage;
        delete query.perPage;
        delete query.page;
    }
    
    if ((account = query.account)) {
        
        if (account instanceof Array) {
            let accountList = account.map(a => ({[Op.like]: `${a}%`}));
            parsed.where.account = {[Op.or]: accountList};
        }
        else {
            parsed.where.account = {[Op.like]: `${account}%`};
        }
        delete query.account;
    }
    
    if (query.journalEntry) {
        parsed.where.journalEntry = query.journalEntry;
    }
    
    if (query.startDate || query.endDate) {
        parsed.where.timestamp = {};
    }
    if (query.startDate) {
        parsed.where.timestamp[Op.gte] = new Date(query.startDate);
        delete query.startDate;
    }
    if (query.endDate) {
        parsed.where.timestamp[Op.lte] = new Date(query.endDate);
        delete query.endDate;
    }
    if (query.memo) {
        parsed.where.memo = {[Op.or]: [query.memo, `${query.memo} [REVERSED]`]};
        delete query.memo;
    }
    if (query.newestFirst) {
        parsed.order = [['timestamp', 'DESC']];
    }

    return parsed;
}

Book.listBooks = function() {
    return Book.findAll({order: ['name']}).then(results => {
        if (!results) {
            return [];
        }
        return results;
    });
};

/**
 * Gets an existing book, or creates a new one
 * @param name The name of the new book
 * @param quoteCurrency The Base currency for the book. If the book already exists, this parameter must match the existing base currency or be undefined.
 */
Book.getOrCreateBook = function(name, quoteCurrency) {
    return Book.findOrCreate({where: {name: name}, defaults: {quoteCurrency: quoteCurrency}})
        .then(result => {
            if (!result || result.length != 2) {
                return sequelize.Promise.reject(new AleError('Book query failed to return expected result', codes.DatabaseQueryError));
            }
            const book = result[0];
            const cur = book.quoteCurrency;
            const isNewBook = result[1];
            if (quoteCurrency && (quoteCurrency != cur)) {
                const err = new AleError(`Request Base currency does not match existing base currency. Requested: ${quoteCurrency}. Current: ${cur}`, codes.MismatchedCurrency);
                return sequelize.Promise.reject(err);
            }
            return {isNew: isNewBook, book: book};
        });
};

/**
 * Gets an existing, or returns an error
 * @param name The name of the new book
 */
Book.getBook = function(name) {
    return Book.findOne({where: {name: name}}).then(book => {
        if (!book) {
            return sequelize.Promise.reject(new AleError(`Book ${name} does not exist.`, codes.BookDoesNotExist));
        }
        return book;
    }, err => {
        return sequelize.Promise.reject(new AleError(`Error getting book info. ${err.message}`, codes.DatabaseQueryError));
    });
};

Book.prototype.values = function() {
    return {
        id: this.get('id'),
        name: this.get('name'),
        currency: this.get('quoteCurrency'),
        createdAt: this.get('createdAt').valueOf(),
        updatedAt: this.get('updatedAt').valueOf()
    };
};

module.exports = Book;
