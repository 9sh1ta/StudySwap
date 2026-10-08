import { openDb } from './db/index.js';
import { seedDatabase, isEmpty } from './db/seedDb.js';
import { createApp } from './app.js';

const db = openDb();
if (isEmpty(db)) console.log('Empty database — seeding demo data:', seedDatabase(db));
const port = Number(process.env.PORT) || 4000;
createApp(db).listen(port, () => console.log(`StudySwap API listening on http://localhost:${port}`));
