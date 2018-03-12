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
                    assert.ok(isFinite(newBook.id));
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
});
