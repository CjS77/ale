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
const { NEAR_ZERO } = require('./types');

/**
 * A journal entry comprises a set of transactions, which have a balance set of debit and credit entries
 */
const JournalEntry = sequelize.define('journal', {
        memo: { type: Sequelize.TEXT, defaultValue: '' },
        book: Sequelize.STRING,
        timestamp: { type: Sequelize.DATE, validate: { isDate: true }, defaultValue: Date.now },
        quote_currency: { type: Sequelize.STRING, defaultValue: 'USD' },
        voided: { type: Sequelize.BOOLEAN, defaultValue: false },
        void_reason: Sequelize.STRING,
        approved: {
            type: Sequelize.BOOLEAN, defaultValue: true
        }
    }
);

Transaction.belongsTo(JournalEntry);

JournalEntry.hasOne(JournalEntry, { as: 'original' });
JournalEntry.hasMany(Transaction);

JournalEntry.addHook('beforeSave', (entry) => {
    if (!(entry.changed('approved') && entry.approved === true)) {
        return;
    }
    return entry.getTransactions().then(txs => {
        return sequelize.Promise.all(txs.map(tx => {
            tx.approved = true;
            return tx.save();
        }));
    });
});

JournalEntry.prototype.voidEntry = function(book, reason) {
    if (this.voided === true) {
        return sequelize.Promise.reject(new Error('Journal entry already voided'));
    }

    // Set this to void with reason and also set all associated transactions
    this.voided = true;
    this.void_reason = !reason ? '' : reason;
    let txs = [];
    return this.getTransactions().then(txs => {
        return sequelize.Promise.all(txs.map(tx => {
            tx.voided = true;
            tx.void_reason = this.void_reason;
            return tx.save();
        }));
    }).then(transactions => {
        txs = transactions;
        let newMemo = `${this.memo} [REVERSED]`;
        // Ok now create an equal and opposite journal
        return book.entry(newMemo, new Date(), this);
    }).then(entry => {
        for (let tx of txs) {
            if (+tx.credit !== 0) {
                entry.debit(tx.accounts, tx.credit, tx.currency, +tx.exchange_rate);
            }
            if (+tx.debit !== 0) {
                entry.credit(tx.accounts, tx.debit, tx.currency, tx.exchange_rate);
            }
        }
        return entry.commit();
    });
};

JournalEntry.prototype.newTransaction = function(account, amount, isCredit, currency = undefined, exchangeRate = 1.0) {
    amount = +amount;
    if (typeof account === 'string') {
        account = account.split(':');
    }

    if (account.length > 3) {
        const err = new Error('Account path is too deep (maximum 3)');
        err.accountPath = account;
        return Promise.reject(err);
    }

    const transaction = Transaction.build({
        accounts: account.join(':'),
        credit: isCredit ? amount : 0.0,
        debit: isCredit ? 0.0 : amount,
        exchange_rate: +exchangeRate,
        currency: currency,
        book: this.book,
        memo: this.memo,
        journal: this,
        timestamp: new Date()
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

JournalEntry.prototype.setApproved = function(value) {
    this.setDataValue('approved', value);
    return this;
};

JournalEntry.prototype.commit = function() {
    const transactions = this.pendingTransactions;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return;
    }
    // First of all, set approved on transactions to approved on journal
    transactions.forEach(tx => tx.approved = this.approved);
    let total = 0.0;
    for (let tx of transactions) {
        total = total + tx.credit * tx.exchange_rate;
        total = total - tx.debit * tx.exchange_rate;
    }
    if (Math.abs(total) > NEAR_ZERO) {
        const err = new Error('Invalid Journal Entry. Total not zero');
        err.code = 400;
        err.total = total.toString();
        return Promise.reject(err);
    }
    const tasks = transactions.map(tx => tx.save());
    return sequelize.Promise.all(tasks).then(() => {
        return this.addTransactions(transactions);
    }).then(() => {
        this.pendingTransactions = [];
        return this.save();
    });
};

module.exports = JournalEntry;
