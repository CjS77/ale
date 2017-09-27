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

const { Client } = require('pg');
const async = require('async');

process.env.ALE_CONNECTION = process.env.ALE_CONNECTION || 'postgres://postgres@localhost/ale-test';
const masterUri = process.env.MASTER_ALE_CONNECTION || 'postgres://postgres@localhost/postgres';

let sequelize;
before((done) => {
    create(masterUri, 'ale-test', done);
});

after(() => {
    sequelize = require('../models/connection');
    return sequelize.drop();
});

function create(master_uri, db_name, cb) {
    const queries = [
        `DROP DATABASE IF EXISTS "${db_name}";`,
        `CREATE DATABASE "${db_name}";`,
        `ALTER DATABASE "${db_name}" SET TIMEZONE TO 'UTC';`
    ];
    const client = new Client({ connectionString: master_uri });
    client.connect();
    async.eachSeries(queries, function(sql, done) {
        client.query(sql, done);
    }, cb);
}

