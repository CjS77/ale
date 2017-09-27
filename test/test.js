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
let Book;
describe('ALE', () => {
    before((done) => {
        const sequelize = require('../models/connection');
        require('../models/transaction');
        require('../models/journal');
        sequelize.sync().then(() => {
            Book = require('../').Book;
            done();
        });
    });

    let entry1 = null;
    it('Should let you create a basic transaction', () => {
        const book = new Book('MyBook');
        return book.entry('Test Entry').then(entry => {
            return entry.debit('Assets:Receivable', 500)
            .credit('Income:Rent', 500)
            .commit();
        }).then((entry) => {
            entry1 = entry;
            assert.equal(entry.memo, 'Test Entry');
            return entry.getTransactions();
        }).then((txs) => {
            assert.equal(txs.length, 2);
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            return book.entry('Test Entry 2', threeDaysAgo);
        }).then(entry2 => {
            return entry2
            .debit('Assets:Receivable', 700)
            .credit('Income:Rent', 700)
            .commit();
        }).then(entry2 => {
            assert.equal(entry2.book, 'MyBook');
            assert.equal(entry2.memo, 'Test Entry 2');
            return entry2.getTransactions();
        }).then(txs => {
            txs = txs.sort((a, b) => a.accounts > b.accounts ? 1 : -1);
            assert.equal(txs.length, 2);
            assert.equal(txs[0].exchange_rate, 1.0);
            assert.equal(txs[0].debit, 700);
            assert.equal(txs[0].credit, 0);
            assert.equal(txs[1].credit, 700);
            assert.equal(txs[1].debit, 0);
        });
    });

    it('Should deal with rounding errors', () => {
        const book = new Book('MyBook');
        return book.entry('Rounding Test').then(entry => {
            return entry.credit('A:B', 1005)
            .debit('A:B', 994.95)
            .debit('A:B', 10.05)
            .commit();
        }).then(() => {
            return book.balance({ account: 'A:B' })
        }).then((balance) => {
            assert.equal(balance.balance, 0);
            assert.equal(balance.creditTotal, 1005);
            assert.equal(balance.debitTotal, 1005);
            assert.equal(balance.numTransactions, 3);
        });
    });

    it('Should have updated the balance for assets and income and accurately give balance for sub-accounts', () => {
        const book = new Book('MyBook');
        return book.balance({ account: 'Assets' }).then((data) => {
            assert.equal(data.numTransactions, 2);
            assert.equal(data.balance, -1200);
            return book.balance({ account: 'Assets:Receivable' });
        }).then((data) => {
            assert.equal(data.numTransactions, 2);
            assert.equal(data.balance, -1200);
            return book.balance({ account: 'Assets:Other' });
        }).then((data) => {
            assert.equal(data.numTransactions, 0);
            assert.equal(data.balance, 0);
        });
    });

    it('should return full ledger', () => {
        const book = new Book('MyBook');
        return book.ledger({ account: 'Assets' }).then(res => {
            assert.equal(res.count, 2);
        });
    });

    it('should allow you to void a journal entry', () => {
        const book = new Book('MyBook');
        return book.balance({ account: 'Assets', memo: 'Test Entry' }).then((data) => {
            assert.equal(data.balance, -500);
            return book.voidEntry(1, 'Messed up');
        }).then(() => {
            return book.balance({ account: 'Assets' });
        }).then((data) => {
            assert.equal(data.balance, -700);
            return book.balance({ account: 'Assets', memo: 'Test Entry' });
        }).then((data) => {
            assert.equal(data.balance, 0);
        });
    });

    it('should list all accounts', () => {
        const book = new Book('MyBook');
        return book.listAccounts().then((accounts) => {
            assert(accounts.indexOf('Assets') > -1);
            assert(accounts.indexOf('Assets:Receivable') > -1);
            assert(accounts.indexOf('Income') > -1);
            assert(accounts.indexOf('Income:Rent') > -1);
        });
    });

    it('should return ledger with array of accounts', () => {
        const book = new Book('MyBook');
        return book.ledger({
            account: ['Assets', 'Income']
        }).then((result) => {
            assert.equal(result.count, 6);
        });
    });

    it('should give you a paginated ledger when requested', () => {
        const book = new Book('MyBook');
        return book.ledger({
            account: ['Assets', 'Income'],
            perPage: 4,
            page: 2
        })
        .then((result) => {
            assert.equal(result.count, 6);
            assert.equal(result.transactions.length, 2);
        })
    });

    describe('approved/pending transactions', () => {
        let pendingJournal;

        it('should not include pending transactions in balance', () => {
            const book = new Book('MyBook');
            return book.entry('Test Entry 3').then(entry => {
                return entry.debit('Foo', 500)
                .credit('Bar', 500)
                .setApproved(false)
                .commit();
            }).then(entry => {
                pendingJournal = entry;
                // Balance should still be 0 since they're not approved
                return book.balance({ account: 'Foo' });
            }).then(data => {
                assert.equal(data.balance, 0);
            });
        });

        it('should not include pending transactions in ledger', () => {
            const book = new Book('MyBook');
            return book.ledger({ account: ['Foo'] }).then((response) => {
                assert.equal(response.count, 0);
            });
        });

        it('should set all transactions to approved when approving the journal', () => {
            const book = new Book('MyBook');
            pendingJournal.approved = true;
            return pendingJournal.save().then(() => {
                return book.balance({ account: 'Bar' });
            }).then(data => {
                assert.equal(data.balance, 500);
            });
        });
    });
});
