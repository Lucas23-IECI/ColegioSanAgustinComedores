const pool = require('./db');
const fs = require('fs');
const path = require('path');

const studentsToInsert = [
  ['11111111-1', 'Pedro Pascal', '3A'],
  ['22222222-2', 'Daniela Vega', '3A'],
  ['33333333-3', 'Alexis Sanchez', '4B'],
  ['44444444-4', 'Mon Laferte', '4B'],
  ['55555555-5', 'Claudio Bravo', '1C'],
  ['252224161', 'Test Scanner A', 'TEST'],
  ['14538716', 'Test Scanner B', 'TEST']
];

async function setupAndSeed() {
  try {
    const initSqlPath = path.join(__dirname, 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');

    console.log('Creating tables from init.sql...');
    await pool.query(initSql);
    console.log('Tables created or already exist.');

    console.log('Inserting students...');
    for (const student of studentsToInsert) {
      await pool.query(
        'INSERT INTO students (rut, name, grade) VALUES ($1, $2, $3) ON CONFLICT (rut) DO NOTHING',
        student
      );
      console.log(`Student ${student[1]} inserted or already exists.`);
    }
    console.log('Database successfully populated.');
  } catch (err) {
    console.error('Error in database setup:', err.message);
  } finally {
    pool.end();
  }
}

setupAndSeed();
