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
const { CURRENCY_LARGE } = require('./types');

/**
 * A Transaction describes a single entry into an account. A transaction is always associated with exactly one Journal entry; the latter ensure that the transactions are balanced
 */
Transaction = sequelize.define('transaction', {
    credit: { type: CURRENCY_LARGE, validate: { isDecimal: true }, defaultValue: 0.0 },
    debit: { type: CURRENCY_LARGE, validate: { isDecimal: true }, defaultValue: 0.0 },
    exchange_rate: { type: CURRENCY_LARGE, validate: { isDecimal: true }, defaultValue: 1.0 },
    currency: { type: Sequelize.STRING, defaultValue: 'USD', notNull: true },
    accounts: Sequelize.STRING,
    book: Sequelize.STRING,
    memo: Sequelize.TEXT,
    timestamp: { type: Sequelize.DATE, validate: { isDate: true }, default: Date.now },
    voided: { type: Sequelize.BOOLEAN, default: false },
    void_reason: Sequelize.STRING,
    approved: { type: Sequelize.BOOLEAN, default: true }
}, {});

/**
 * Return instance in native formats
 */
Transaction.prototype.values = function() {
    return {
        id: this.id,
        credit: +this.credit,
        debit: +this.debit,
        exchange_rate: +this.exchange_rate,
        currency: this.currency,
        accounts: this.accounts,
        book: this.book,
        memo: this.memo,
        timestamp: new Date(this.timestamp),
        voided: this.voided,
        void_reason: this.void_reason,
        approved: this.approved,
    };
};

// Foreign key relationships are setup in journal.js
module.exports = Transaction;
