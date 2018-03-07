# A=L+E
Multi-currency double-entry accounting system based on node.js + Sequelize

Ale is based on the basic formula `Assets = Liabilities + Equity` and is insipred by [Medici](https://github.com/koresar/medici)


## Basics

ALE divides itself into "books", each of which store *journal entries* and their child *transactions*. The cardinal rule of double-entry accounting is that "everything must balance out to zero", and that rule is applied to every journal entry written to the book. If the transactions for a journal entry do not balance out to zero, the system will return a rejected promise.

Books simply represent the physical book in which you would record your transactions - on a technical level, the "book" attribute simply is added as a field in `Transactions` and `JournalEntry` tables to allow you to have multiple books if you want to.

Each transaction in ALE operates on a single *account*. Accounts are arbitrary string tags, but you can subdivide accounts using colons (or any other separator). Transactions in the `Assets:Cash` account will appear in a query for transactions in the `Assets` account, but will not appear in a query for transactions in the `Assets:Property` account. This allows you to query, for example, all expenses, or just "office overhead" expenses (Expenses:Office Overhead).

In theory, the account names are entirely arbitrary, but you will likely want to use traditional accounting sections and subsections like assets, expenses, income, accounts receivable, accounts payable, etc. But, in the end, how you structure the accounts is entirely up to you. Sub-accounts are also not matched explicitly, but by comparing the account name to query against the beginning of the account name. Thus `Trades` will match `Trades:USD`, but not `Assets:Trades`.


## Configuration

ALE tries to be agnostic as to which RDMS you have running on the back-end. Therefore, you need to ensure that the relevant DB bindings are installed and part of your `package.json` file.

For PostgreSQL, this would entail

`yarn add pg`

You *must* set an `ALE_CONNECTION` environment variable which holds the connection string to connect to the underlying database. To date,
ALE has been tested against PostgreSQL, but any DB supported by Sequelize (SQLite, MySQL etc) should work.

`export ALE_CONNECTION=postres://ale_user@localhost:5432/trading_db`

The user and database must exist before importing ALE. For an example of how to ensure this in code (for PostgreSQL), see the test setup function.


## Coding Standards

ALE is written in JavaScript. All database queries return promise objects instead of using the traditional node `function(err, result)`callback.

## Writing journal entries

Writing a journal entry is very simple. First you need a `book` object:

```js
const {book} = require('a.l.e');

// The first argument is the book name, which is used to determine which book the transactions and journals are queried from.
// The second argument is the currency to report all queries in.
const myBook = new book('MyBook', 'USD');
```

Now write an entry:

```js
// You can specify a Date object as the second argument in the book.entry() method if you want the transaction to be for a different date than right now
myBook.entry('Received payment').then(entry => {
    return entry.debit('Assets:Cash', 1000, 'USD', 1.0) // The currency and exchange rate default to 'USD' and 1.0 if omitted
         .credit('Income', 1000)                        // debit and credit return the entry to allow chained transactions
         .commit());                                    // Validate and commit the entry to the DB, returning a promise
}).then(() => {
  // Entry is saved
});
```

You can continue to chain debits and credits to the journal object until you are finished. The `entry.debit()` and `entry.credit()` methods both have the same arguments: (account, amount, currency, exchangeRate).

## Querying Account Balance

To query account balance, just use the `book.balance()` method:

```js
myBook.balance({ account:'Assets:Accounts Receivable' }).then((balance) => {
    console.log("Joe Blow owes me", balance.total);
});
```

`balance` returns a promise that resolves to the the following `creditTotal` - the sum of credits (in quote currency), `debitTotal`, `balance` - The current balance, in quote currency, `currency` - the currency the results are reported in, `numTransactions` - The total number of transactions making up the balance calculation.

## Retrieving Transactions

To retrieve transactions, use the `book.ledger()` method (here I'm using moment.js for dates):

```js
const startDate = moment().subtract('months', 1).toDate(); // One month ago
const endDate = new Date(); //today

myBook.ledger({
    account: ['Income', 'Expenses'] // Both sets of accounts will be included
    start_date: startDate,
    end_date: endDate
}).then((result) => {
    // Do something with the returned transaction documents
    result.count // The number of transactions found
    result.transactions // An array of transactions found
});
```

## Voiding Journal Entries

Sometimes you will make an entry that turns out to be inaccurate or that otherwise needs to be voided. Keeping with traditional double-entry accounting, instead of simply deleting that journal entry, ALE instead will mark the entry as "voided", and then add an equal, opposite journal entry to offset the transactions in the original. This gives you a clear picture of all actions taken with your book.

To void a journal entry, you can either call the `voidEntry(book, void_reason)` method on a JournalEntry instance document, or use the `book.voidEntry(journalId, void_reason)` method if you know the journal document's ID.
    
```js
myBook.void("123456", "I made a mistake").then(() => {
    // Do something after voiding
})
```

The original entry will have its `voided` field set to true and counteracting transctions will be added with the original memo suffixed with `[REVERSED]`


## Calculating unrealized profit with `markToMarket`

You can calculated unrealised profit/losses due to changes in exhange rates by calling `markToMarket` and giving it a hash of exchange rates:

```
const book = new Book('Forex test');
book.markToMarket({ account: ['Trading', 'Assets:Bank'] }, { ZAR: 20, USD: 1 }).then(result => {
   assert.equal(result['Trading:ZAR'], 500);
   assert.equal(result['Trading:USD'], 600);
   assert.equal(result['Assets:Bank'], -1650);
   assert.equal(result.unrealizedProfit, -550);
});
```

## Changelog

* **v0.1.0** First release

