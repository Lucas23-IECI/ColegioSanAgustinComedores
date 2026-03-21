const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Search student by RUT
app.get('/api/students/:rut', async (req, res) => {
  const { rut } = req.params;
  const { meal_type } = req.query; 

  try {
    const studentQuery = await pool.query('SELECT * FROM students WHERE rut = $1', [rut]);
    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const student = studentQuery.rows[0];

    // Check if registered today for this specific meal type
    let alreadyRegistered = false;
    if (meal_type) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const regQuery = await pool.query(
            "SELECT * FROM lunch_registrations WHERE student_id = $1 AND meal_type = $2 AND DATE(timestamp) = $3",
            [student.id, meal_type, today]
        );
        alreadyRegistered = regQuery.rows.length > 0;
    }

    res.json({ student, alreadyRegistered });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Register lunch
app.post('/api/lunches', async (req, res) => {
  const { student_id, meal_type } = req.body;
  if (!student_id || !meal_type) {
      return res.status(400).json({ message: 'Missing student_id or meal_type' });
  }

  try {
    const newReg = await pool.query(
      'INSERT INTO lunch_registrations (student_id, meal_type) VALUES ($1, $2) RETURNING *',
      [student_id, meal_type]
    );
    res.json(newReg.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get today's registrations
app.get('/api/lunches/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT s.rut, s.name, s.grade, lr.meal_type, lr.timestamp 
      FROM lunch_registrations lr 
      JOIN students s ON lr.student_id = s.id 
      WHERE DATE(lr.timestamp) = $1 
      ORDER BY lr.timestamp DESC
    `;
    const result = await pool.query(query, [today]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
