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

const dotenv = require('dotenv');
dotenv.config();
const { Client } = require('pg');
const async = require('async');
const Transaction = require('../models/transaction');
const Book = require('../models/book');
const JournalEntry = require('../models/journal');

const testUri = process.env.TEST_ALE_CONNECTION || 'postgres://postgres@localhost/postgres';

let sequelize = require('../models/connection');

module.exports.create = (done) => {
    create(testUri, 'ale-test', done);
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

function create(testUri, db_name, cb) {
    const queries = [
        `DROP DATABASE IF EXISTS "${db_name}";`,
        `CREATE DATABASE "${db_name}";`,
        `ALTER DATABASE "${db_name}" SET TIMEZONE TO 'UTC';`
    ];
    const client = new Client({ connectionString: testUri });
    client.connect();
    async.eachSeries(queries, function(sql, done) {
        client.query(sql, done);
    }, cb);
}

