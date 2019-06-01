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

const dotenv = require('dotenv');
dotenv.config();
const app = require('./lib/server');
const port = process.env.ALE_PORT || 8813;
const sequelize = require('./models/connection');

sequelize.sync().then(

    app.listen(port, (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Listening on port ${port}`);
    })
);



process.on('SIGTERM', () => {
    console.log('Shutdown signal received. Bye');
    process.exit(0);
});
