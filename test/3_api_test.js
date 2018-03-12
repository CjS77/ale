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

const request = require('supertest');
const app = require('../lib/server');
const assert = require('assert');
const testDB = require('./testDB');
const {codes} = require('../lib/errors');

describe('ALE API', () => {
    let testZAR, testUSD;
    before(done => {
        testDB.clear().then(() => {
            done();
        });
    });
    describe('POST /books', () => {
        it('creates a new book', () => {
            return request(app)
                .post('/books')
                .send({name: 'testZAR', currency: 'ZAR'})
                .expect(200)
                .then(res => {
                    const newBook = res.body;
                    assert.ok(newBook.success);
                    assert.ok(isFinite(newBook.id));
                    assert.equal(newBook.name, 'testZAR');
                    assert.equal(newBook.currency, 'ZAR');
                    testZAR = newBook.id;
                });
        });
        
        it('creates another new book', () => {
            return request(app)
                .post('/books')
                .send({name: 'testUSD', currency: 'USD'})
                .expect(200)
                .then(res => {
                    const newBook = res.body;
                    assert.ok(newBook.success);
                    assert.ok(isFinite(newBook.id));
                    assert.equal(newBook.name, 'testUSD');
                    assert.equal(newBook.currency, 'USD');
                    testUSD = newBook.id;
                });
        });
        
        it('returns existing book', () => {
            return request(app)
                .post('/books')
                .send({name: 'testZAR', currency: 'ZAR'})
                .expect(200)
                .then(res => {
                    const newBook = res.body;
                    assert.equal(newBook.success, false);
                    assert.equal(newBook.id, testZAR);
                    assert.equal(newBook.name, 'testZAR');
                    assert.equal(newBook.currency, 'ZAR');
                });
        });
        
        it('rejects creation of conflicting book', () => {
            return request(app)
                .post('/books')
                .send({name: 'testZAR', currency: 'USD'})
                .expect(400)
                .then(res => {
                    const err = res.body;
                    assert.equal(err.success, false);
                    assert.equal(err.errorCode, codes.MismatchedCurrency);
                });
        });
    });
    
    describe('GET /books', () => {
        it('returns a list of books', () => {
            return request(app)
                .get('/books')
                .expect(200)
                .then(res => {
                    const books = res.body;
                    assert.ok(Array.isArray(books));
                    assert.equal(books.length, 2);
                    assert.equal(books[0].name, 'testUSD');
                    assert.equal(books[1].name, 'testZAR');
                });
        });
    });
    
    describe('POST /books/{id}/ledger', () => {
        it('saves a valid entry', () => {
            return request(app)
                .post(`/books/${testUSD}/ledger`)
                .send({
                    memo: 'Buy Gold',
                    timestamp: '2018-01-31 00:00:00Z',
                    transactions: [
                        {
                            account: 'Purchases:Local',
                            debit: 2600,
                            currency: 'USD'
                        }, {
                            account: 'GoldEFT:Foreign',
                            credit: 26000,
                            currency: 'ZAR',
                            exchangeRate: 0.1
                        }
                    ]
                })
                .expect(200)
                .then(res => {
                    assert.ok(res.body.success);
                });
        });
    
        it('saves a valid entry on different book', () => {
            return request(app)
                .post(`/books/${testZAR}/ledger`)
                .send({
                    memo: 'Rent',
                    timestamp: '2018-01-15 00:00:00Z',
                    transactions: [
                        {
                            account: 'Expenses:Rent',
                            credit: 8600
                        }, {
                            account: 'Bank:Cash',
                            debit: 8600
                        }
                    ]
                })
                .expect(200)
                .then(res => {
                    assert.ok(res.body.success);
                });
        });
        
        it('provides default currency if omitted', () => {
            return request(app)
                .post(`/books/${testUSD}/ledger`)
                .send({
                    memo: 'January Payroll',
                    timestamp: '2018-01-15 00:00:00Z',
                    transactions: [
                        {
                            account: 'Payroll:Alice',
                            credit: 5000
                        },
                        {
                            account: 'Payroll:Bob',
                            credit: 5000
                        },
                        {
                            account: 'Expenses:Payroll',
                            debit: 10000
                        }
                    ]
                })
                .expect(200)
                .then(res => {
                    assert.ok(res.body.success);
                });
        });
    
        it('auto-nets debits and credits', () => {
            return request(app)
                .post(`/books/${testUSD}/ledger`)
                .send({
                    memo: 'Buy Lambo',
                    timestamp: '2018-01-16 00:00:00Z',
                    transactions: [
                        {
                            account: 'Assets:Cars',
                            debit: 140000,
                            credit: 20000,
                            currency: 'USD'
                        }, {
                            account: 'Expenses:Cars',
                            credit: 100000,
                            currency: 'EUR',
                            exchangeRate: 1.2
                        }
                    ]
                })
                .expect(200)
                .then(res => {
                    assert.ok(res.body.success);
                });
        });
        
        it('rejects if transactions don\'t balance', () => {
            return request(app)
                .post(`/books/${testUSD}/ledger`)
                .send({
                    memo: 'Buy Gold',
                    timestamp: '2018-01-31 00:00:00Z',
                    transactions: [
                        {
                            account: 'Purchases:Local',
                            debit: 2600,
                            currency: 'USD'
                        }, {
                            account: 'GoldEFT:Foreign',
                            credit: 25000,
                            currency: 'ZAR',
                            exchangeRate: 10.0
                        }
                    ]
                })
                .expect(400)
                .then(res => {
                    const err = res.body;
                    assert.equal(err.success, false);
                    assert.equal(err.errorCode, codes.EntryNotBalanced);
                });
        });
    });
    
    describe('GET /books/{id}/ledger', () => {
        it('returns error for invalid book', () => {
            return request(app)
                .get('/books/999/ledger')
                .expect(400)
                .then(res => {
                    const err = res.body;
                    assert.equal(err.success, false);
                    assert.equal(err.errorCode, codes.BookDoesNotExist);
                });
        });
        
        it('returns error for string as ID', () => {
            return request(app)
                .get('/books/invalid/ledger')
                .expect(400)
                .then(res => {
                    const err = res.body;
                    assert.equal(err.success, false);
                    assert.equal(err.errorCode, codes.ValidationError);
                });
        });
        
        it('returns full ledger', () => {
            return request(app)
                .get(`/books/${testUSD}/ledger`)
                .expect(200)
                .then(res => {
                    const ledger = res.body;
                    assert.equal(ledger.book.id, testUSD);
                    assert.ok(Array.isArray(ledger.entries));
                    assert.equal(ledger.entries.length, 3);
                    assert.equal(ledger.entries[0].memo, 'January Payroll');
                    assert.equal(ledger.entries[0].transactions.length, 3);
                    assert.equal(ledger.entries[1].memo, 'Buy Lambo');
                });
        });
        
        it('returns first page of ledger', () => {
            return request(app)
                .get(`/books/${testUSD}/ledger`)
                .query({ perPage: 2})
                .expect(200)
                .then(res => {
                    const ledger = res.body;
                    assert.equal(ledger.book.id, testUSD);
                    assert.ok(Array.isArray(ledger.entries));
                    assert.equal(ledger.entries.length, 2);
                    assert.equal(ledger.entries[0].memo, 'January Payroll');
                    assert.equal(ledger.entries[0].transactions.length, 3);
                    assert.equal(ledger.entries[1].memo, 'Buy Lambo');
                });
        });
        
        it('returns second page of ledger', () => {
            return request(app)
                .get(`/books/${testUSD}/ledger`)
                .query({ perPage: 2, page: 2 })
                .expect(200)
                .then(res => {
                    const ledger = res.body;
                    assert.equal(ledger.book.id, testUSD);
                    assert.ok(Array.isArray(ledger.entries));
                    assert.equal(ledger.entries.length, 1);
                    assert.equal(ledger.entries[0].memo, 'Buy Gold');
                    assert.equal(ledger.entries[0].transactions.length, 2);
                });
        });
        
        it('returns entries with date constraints', () => {
            return request(app)
                .get(`/books/${testUSD}/ledger`)
                .query({ startDate: '2018-01-15', endDate: '2018-01-17' })
                .expect(200)
                .then(res => {
                    const ledger = res.body;
                    assert.equal(ledger.book.id, testUSD);
                    assert.ok(Array.isArray(ledger.entries));
                    assert.equal(ledger.entries.length, 2);
                    assert.equal(ledger.entries[0].memo, 'January Payroll');
                });
        });
    });
    
    describe('GET /books/{id}/accounts', () => {
        it('returns an array of strings', () => {
            return request(app)
                .get(`/books/${testUSD}/accounts`)
                .expect(200)
                .then(res => {
                    const accounts = res.body;
                    assert.equal(accounts.length, 12);
                });
        });
    });
});
