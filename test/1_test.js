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

const assert = require('assert');
const {codes} = require('../lib/errors');
const testDB = require('./testDB');

let Book;
describe('ALE', () => {
    let bookZAR, bookUSD, sequelize;
    
    before(done => {
        testDB.clear().then(() => {
            done();
        });
    });
    
    before(() => {
        sequelize = require('../models/connection');
        Book = require('../models/book');
        return sequelize.sync();
    });
    
    let entry1 = null;
    it('Should let you define new books', () => {
        return Book.getOrCreateBook('TestB', 'USD').then(res => {
            bookUSD = res.book;
            assert.equal(bookUSD.name, 'TestB');
            assert.equal(bookUSD.quoteCurrency, 'USD');
            return Book.getOrCreateBook('TestA', 'ZAR');
        }).then(res => {
            bookZAR = res.book;
            assert.equal(bookZAR.name, 'TestA');
            assert.equal(bookZAR.quoteCurrency, 'ZAR');
            return Book.listBooks();
        }).then(books => {
            assert.equal(books.length, 2);
            assert.equal(books[0].name, 'TestA');
            assert.equal(books[1].name, 'TestB');
        });
    });
    
    it('Requesting a book that exists returns that book', () => {
        return Book.getOrCreateBook('TestA', 'ZAR').then(res => {
            assert.equal(res.isNew, false);
            assert.equal(res.book.name, 'TestA');
            assert.equal(res.book.quoteCurrency, 'ZAR');
            return Book.listBooks();
        }).then(books => {
            assert.equal(books.length, 2);
            assert.equal(books[0].name, 'TestA');
            assert.equal(books[1].name, 'TestB');
        });
    });
    
    it('Requesting a book with conflicting base currencies throws an error', () => {
        return Book.getOrCreateBook('TestA', 'THB').then(() => {
            throw new Error('Request should fail');
        }, err => {
            assert(err);
            assert.equal(err.code, codes.MismatchedCurrency);
        });
    });
    
    it('should return a list of books', () => {
        return Book.listBooks().then(books => {
            assert.equal(books.length, 2);
            assert.equal(books[0].name, 'TestA');
            assert.equal(books[0].quoteCurrency, 'ZAR');
            assert.equal(books[1].name, 'TestB');
            assert.equal(books[1].quoteCurrency, 'USD');
        });
    });
    
    it('Should let you create a basic transaction', () => {
        const entry = bookZAR.newJournalEntry('Test Entry');
        entry.debit('Assets:Receivable', 500, 'ZAR')
            .credit('Income:Rent', 500, 'ZAR');
        return entry.commit().then((e) => {
            entry1 = e;
            assert.equal(e.memo, 'Test Entry');
            return e.getTransactions();
        }).then((txs) => {
            assert.equal(txs.length, 2);
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const entry2 = bookZAR.newJournalEntry('Test Entry 2', threeDaysAgo);
            return entry2
                .debit('Assets:Receivable', 700)
                .credit('Income:Rent', 700)
                .commit();
        }).then(entry2 => {
            assert.equal(entry2.memo, 'Test Entry 2');
            return entry2.getTransactions();
        }).then(txs => {
            txs = txs.sort((a, b) => a.account > b.account ? 1 : -1);
            assert.equal(txs.length, 2);
            assert.equal(txs[0].exchangeRate, 1.0);
            assert.equal(txs[0].debit, 700);
            assert.equal(txs[0].credit, 0);
            assert.equal(txs[1].credit, 700);
            assert.equal(txs[1].debit, 0);
        });
    });
    
    it('Should deal with rounding errors', () => {
        const entry = bookUSD.newJournalEntry('Rounding Test');
        entry.credit('A:B', 1005, 'USD')
            .debit('A:B', 994.95, 'USD')
            .debit('A:B', 10.05, 'USD');
        return entry.commit().then(() => {
            return bookUSD.getBalance({account: 'A:B'});
        }).then((balance) => {
            assert.equal(balance.balance, 0);
            assert.equal(balance.creditTotal, 1005);
            assert.equal(balance.debitTotal, 1005);
            assert.equal(balance.numTransactions, 3);
            assert.equal(balance.currency, 'USD');
        });
    });
    
    it('Should have updated the balance for assets and income and accurately give balance for sub-accounts', () => {
        return bookZAR.getBalance({account: 'Assets'}).then((data) => {
            assert.equal(data.numTransactions, 2);
            assert.equal(data.balance, -1200);
            return bookZAR.getBalance({account: 'Assets:Receivable'});
        }).then((data) => {
            assert.equal(data.numTransactions, 2);
            assert.equal(data.balance, -1200);
            return bookZAR.getBalance({account: 'Assets:Other'});
        }).then((data) => {
            assert.equal(data.numTransactions, 0);
            assert.equal(data.balance, 0);
        });
    });
    
    it('should return full ledger', () => {
        return bookZAR.getLedger({account: 'Assets'}).then(res => {
            assert.equal(res.count, 2);
        });
    });
    
    it('should allow you to void a journal entry', () => {
        return bookZAR.getJournalEntries({memo: 'Test Entry'}).then((txs) => {
            const id = txs[0].id;
            return bookZAR.voidEntry(id, 'Messed up');
        }).then(() => {
            return bookZAR.getBalance({account: 'Assets'});
        }).then((data) => {
            assert.equal(data.balance, -700);
        });
    });
    
    it('should list all accounts', () => {
        return bookZAR.listAccounts().then((accounts) => {
            assert(accounts.indexOf('Assets') > -1);
            assert(accounts.indexOf('Assets:Receivable') > -1);
            assert(accounts.indexOf('Income') > -1);
            assert(accounts.indexOf('Income:Rent') > -1);
        });
    });
    
    it('should return ledger with array of accounts', () => {
        return bookZAR.getLedger({
            account: ['Assets', 'Income']
        }).then((result) => {
            assert.equal(result.count, 6);
        });
    });
    
    it('should give you a paginated ledger when requested', () => {
        return bookZAR.getLedger({
            account: ['Assets', 'Income'],
            perPage: 4,
            page: 2
        })
            .then((result) => {
                assert.equal(result.count, 2);
                assert.equal(result.transactions.length, 2);
                assert.equal(result.transactions[0].credit, 500);
                assert.equal(result.transactions[1].debit, 500);
            });
    });
});
