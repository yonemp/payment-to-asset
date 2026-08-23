/**
 * Initialize orders schema.
 * Uses DATABASE_URL when set, otherwise local SQLite.
 */
require('dotenv').config();
const { createDb, schemaSql } = require('./db');

(async () => {
  const db = createDb();
  await db.exec(schemaSql(db.driver));
  console.log('schema ready driver=' + db.driver);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
