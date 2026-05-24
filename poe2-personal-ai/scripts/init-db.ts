import { getDb, initializeSchema } from "../src/lib/db";

initializeSchema(getDb());
console.log("SQLite database is ready at data/poe2-personal-ai.sqlite");
