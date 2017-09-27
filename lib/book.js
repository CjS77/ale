/*
 * @license
 * Copyright 2017 Cayle Sharrock
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under the License.
 */

const { ZERO } = require('../models/types');
const JournalEntry = require('../models/journal');
const Transaction = require('../models/transaction');
const sequelize = require('../models/connection');
const BigNumber = require('bignumber.js');

class Book {
    constructor(name, quoteCurrency = 'USD') {
        this.name = name;
        this.quoteCurrency = quoteCurrency;
    }

    entry(memo, date = null, originalJournal = null) {
        return JournalEntry.create({
            book: this.name,
            memo: memo,
            quote_currency: this.quoteCurrency,
            timestamp: date || new Date(),
            original: originalJournal
        }).then(entry => {
            entry.pendingTransactions = [];
            return entry;
        });
    }

    /**
     * Convert object into Sequelise 'where' clause
     * @param query {{account: {acct, subacct, subsubacct}, startDate, month_date, perPage, page, memo}}
     * @returns {Object}
     */
    _parseQuery(query) {
        let account;
        const parsed = {
            where: {
                book: this.name,
                approved: true
            }
        };

        if (query.perPage) {
            const perPage = query.perPage || 25;
            parsed.offset = (query.page - 1) * perPage;
            parsed.limit = query.perPage;
            delete query.perPage;
            delete query.page;
        }

        if ((account = query.account)) {
            if (account instanceof Array) {
                let accountList = account.map(a => ({ $like: `${a}%` }));
                parsed.where.accounts = { $or: accountList }
            }
            else {
                parsed.where.accounts = { $like: `${account}%` };
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
            parsed.where.timestamp.$gte = new Date(query.startDate);
            delete query.startDate;
        }
        if (query.endDate) {
            parsed.where.timestamp.$lte = new Date(query.endDate);
            delete query.endDate;
        }
        if (query.memo) {
            parsed.where.memo = { $or: [query.memo, `${query.memo} [REVERSED]`] };
            delete query.memo;
        }
        return parsed;
    }

    balance(query, inQuote = false) {
        query = this._parseQuery(query);
        const credit = inQuote ? sequelize.literal('credit * exchange_rate') : sequelize.col('credit');
        const debit = inQuote ? sequelize.literal('debit * exchange_rate') : sequelize.col('debit');
        query.attributes = [
            [sequelize.fn('SUM', credit), 'creditTotal'],
            [sequelize.fn('SUM', debit), 'debitTotal'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'numTransactions']
        ];
        return Transaction.findAll(query).then(result => {
            result = result.shift();
            if (!result) {
                return {
                    balance: 0,
                    notes: 0
                };
            }
            const creditTotal = +result.getDataValue('creditTotal');
            const debitTotal = +result.getDataValue('debitTotal');
            const total = creditTotal - debitTotal;
            return {
                creditTotal: creditTotal,
                debitTotal: debitTotal,
                balance: total,
                currency: this.quoteCurrency,
                numTransactions: +result.getDataValue('numTransactions')
            };
        });
    }

    ledger(query) {
        query = this._parseQuery(query);
        query.order = [['timestamp', 'ASC']];
        return Transaction.findAndCountAll(query).then(results => {
            return {
                count: results.count,
                transactions: results.rows.map(row => row.values())
            }
        });
    }

    voidEntry(journalId, reason) {
        return JournalEntry.findById(journalId)
        .then(entry => {
            if (!entry) {
                return sequelize.Promise.reject(new Error(`Journal entry not found with ID ${journalId}`));
            }
            return entry.voidEntry(this, reason);
        });
    }

    listAccounts() {
        return Transaction.aggregate('accounts', 'distinct', {
            where: {
                book: this.name
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
    }

    markToMarket(query, exchangeRates) {
        const rates = this.normalizeRates(exchangeRates);
        query = this._parseQuery(query);
        query.attributes = [
            'accounts',
            'currency',
            [sequelize.fn('SUM', sequelize.literal('credit - debit')), 'balance'],
        ];
        query.group = ['accounts', 'currency'];
        return Transaction.findAll(query).then(txs => {
            const result = {};
            let profit = ZERO;
            txs.forEach(tx => {
                if (!rates[tx.currency]) {
                    throw new Error(`A ${tx.currency} transaction exists, but its current exchange rate was not provided`);
                }
                let currentBal = (new BigNumber(tx.getDataValue('balance'))).div(rates[tx.currency]);
                profit = profit.plus(currentBal);
                result[tx.accounts] = +currentBal;
            });
            result.unrealizedProfit = +profit;
            return result;
        }).catch(err => {
            return sequelize.Promise.reject(err);
        });
    }

    normalizeRates(rates) {
        let base = rates[this.quoteCurrency];
        if (!base) {
            return null;
        }
        base = new BigNumber(base);
        const result = Object.assign({}, rates);
        for (let cur in result) {
            result[cur] = +(new BigNumber(rates[cur]).div(base));
        }
        return result;
    }
}

module.exports = Book;
