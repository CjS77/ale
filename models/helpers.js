const dotenv = require('dotenv');
dotenv.config();
const Transaction = require('../models/transaction');
const Book = require('../models/book');
const JournalEntry = require('../models/journal');
const Account = require('../models/account');
const { Client } = require('pg');
const async = require('async');
const conn = process.env.ALE_CONNECTION;


module.exports.create = () => {
    create(conn, 'ale-prod');
};

module.exports.destroy = () => {
    return sequelize.drop().then(() => {
        return sequelize.close();
    });
};

module.exports.clear = () => {
    return Transaction.truncate().then(() => {
        return JournalEntry.truncate({ cascade: true });
    }).then(() => {
        return Book.truncate({ cascade: true });
    })
};

function create(conn, db_name) {
    const queries = [
        `DROP DATABASE IF EXISTS "${db_name}";`,
        `CREATE DATABASE "${db_name}";`,
        `ALTER DATABASE "${db_name}" SET TIMEZONE TO 'UTC';`
    ];
    const client = new Client({ connectionString: conn });
    client.connect();
    async.eachSeries(queries, function (sql, done) {
        try { client.query(sql, done) } catch (e) { return e }
    });
}
