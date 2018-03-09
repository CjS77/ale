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
const Sequelize = require('sequelize');
const sequelize = require('./connection');
const Transaction = require('./transaction');
const {NEAR_ZERO} = require('./types');
const {AleError, codes} = require('../lib/errors');

/**
 * A journal entry comprises a set of transactions, which have a balance set of debit and credit entries
 */
const JournalEntry = sequelize.define('journal', {
        memo: {type: Sequelize.TEXT, defaultValue: ''},
        timestamp: {type: Sequelize.DATE, validate: {isDate: true}, defaultValue: Date.now},
        voided: {type: Sequelize.BOOLEAN, defaultValue: false},
        voidReason: Sequelize.STRING
    }, {
        name: {
            singular: 'JournalEntry',
            plural: 'JournalEntries'
        }
    }
);

Transaction.JournalEntry = Transaction.belongsTo(JournalEntry, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
JournalEntry.hasOne(JournalEntry, {as: 'Original'});
JournalEntry.hasMany(Transaction, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});

JournalEntry.prototype.values = function() {
    return {
        id: this.getDataValue('id'),
        memo: this.getDataValue('memo'),
        timestamp: new Date(this.getDataValue('timestamp')),
        voided: this.getDataValue('voided'),
        voidReason: this.getDataValue('voidReason'),
        OriginalId: this.getDataValue('OriginalId')
    };
};

JournalEntry.prototype.voidEntry = function(book, reason) {
    if (this.voided === true) {
        return sequelize.Promise.reject(new Error('Journal entry already voided'));
    }
    return sequelize.transaction({autocommit: false}, t => {
        // Set this to void with reason and also set all associated transactions
        this.voided = true;
        this.voidReason = !reason ? '' : reason;
        return this.save({transaction: t}).then(oldEntry => {
            return oldEntry.getTransactions();
        }).then(txs => {
            return sequelize.Promise.map(txs, tx => {
                tx.voided = true;
                tx.voidReason = reason;
                return tx.save({transaction: t});
            });
        }).then(txs => {
            let newMemo = `${this.memo} [REVERSED]`;
            // Ok now create an equal and opposite journal
            const newEntry = book.newJournalEntry(newMemo, new Date());
            newEntry.setDataValue('OriginalId', this.getDataValue('id'));
            for (let tx of txs) {
                if (+tx.credit !== 0) {
                    newEntry.debit(tx.account, tx.credit, tx.currency, +tx.exchangeRate);
                }
                if (+tx.debit !== 0) {
                    newEntry.credit(tx.account, tx.debit, tx.currency, tx.exchangeRate);
                }
            }
            const total = this.calculatePendingTotal(txs);
            if (Math.abs(total) > NEAR_ZERO) {
                return sequelize.Promise.reject(new AleError('Invalid Journal Entry Reversal. Total not zero', codes.EntryNotBalanced));
            }
            return newEntry._saveEntryWithTxs(t);
        });
    }).then(() => {
        //transaction has been committed
        return true;
    }).catch(e => {
        const err = new AleError(`Voiding entry failed. ${e.message}`, codes.DatabaseUpdateError);
        return sequelize.Promise.reject(err);
    });
};

JournalEntry.prototype.newTransaction = function(account, amount, isCredit, currency, exchangeRate = 1.0) {
    amount = +amount;
    if (typeof account === 'string') {
        account = account.split(':');
    }
    
    if (account.length > 3) {
        const err = new Error('Account path is too deep (maximum 3)');
        err.accountPath = account;
        throw err;
    }
    
    const transaction = Transaction.build({
        account: account.join(':'),
        credit: isCredit ? amount : 0.0,
        debit: isCredit ? 0.0 : amount,
        exchangeRate: +exchangeRate,
        currency: currency,
        timestamp: new Date(),
        bookId: this.getDataValue('bookId')
    });
    if (!this.pendingTransactions) {
        this.pendingTransactions = [];
    }
    this.pendingTransactions.push(transaction);
    
    return this;
};

JournalEntry.prototype.debit = function(account, amount, currency = undefined, exchangeRate = 1.0) {
    return this.newTransaction(account, amount, false, currency, exchangeRate);
};

JournalEntry.prototype.credit = function(account, amount, currency = undefined, exchangeRate = 1.) {
    return this.newTransaction(account, amount, true, currency, exchangeRate);
};

JournalEntry.prototype.commit = function() {
    const total = this.calculatePendingTotal();
    if (Math.abs(total) > NEAR_ZERO) {
        return sequelize.Promise.reject(new AleError('Invalid Journal Entry. Total not zero', codes.EntryNotBalanced));
    }
    return sequelize.transaction({autocommit: false}, t => {
        return this._saveEntryWithTxs(t);
    }).then(result => {
        // Transaction has committed
        return result;
    }).catch(e => {
        // Transaction has rolled back
        const err = new AleError(e.message, codes.DatabaseUpdateError);
        return sequelize.Promise.reject(err);
    });
};

JournalEntry.prototype._saveEntryWithTxs = function(t) {
    let result;
    return this.save({transaction: t}).then(e => {
        result = e;
        const id = result.getDataValue('id');
        return this.saveTransactions(id, {transaction: t});
    }).then(() => {
        return sequelize.Promise.resolve(result);
    });
};

JournalEntry.prototype.calculatePendingTotal = function(txs) {
    const transactions = txs || this.pendingTransactions;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return;
    }
    let total = 0.0;
    for (let tx of transactions) {
        total = total + tx.getDataValue('credit') * tx.getDataValue('exchangeRate');
        total = total - tx.getDataValue('debit') * tx.getDataValue('exchangeRate');
    }
    return total;
};

JournalEntry.prototype.saveTransactions = function(id, opts) {
    const transactions = this.pendingTransactions;
    return sequelize.Promise.map(transactions, tx => {
        tx.setDataValue('JournalEntryId', id);
        return tx.save(opts);
    }).catch(e => {
        return sequelize.Promise.reject(new AleError(`Failed to save transactions for Entry: ${this.getDataValue('memo')} ${e.message}`, codes.DatabaseUpdateError));
    });
};

module.exports = JournalEntry;
