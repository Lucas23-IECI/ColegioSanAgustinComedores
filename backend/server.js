const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/api/students/:rut', async (req, res) => {
  const { rut } = req.params;
  const { meal_type } = req.query;

  try {
    const studentQuery = await pool.query('SELECT * FROM students WHERE rut = $1', [rut]);
    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const student = studentQuery.rows[0];

    let alreadyRegistered = false;
    if (meal_type) {
      const today = new Date().toISOString().split('T')[0];
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

app.post('/api/students', async (req, res) => {
  const { rut, name, grade } = req.body;
  if (!rut || !name) {
    return res.status(400).json({ message: 'Missing rut or name' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO students (rut, name, grade) VALUES ($1, $2, $3) RETURNING *',
      [rut.trim(), name.trim(), grade ? grade.trim() : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un estudiante con ese RUT' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { name, grade } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Missing name' });
  }

  try {
    const result = await pool.query(
      'UPDATE students SET name = $1, grade = $2 WHERE id = $3 RETURNING *',
      [name.trim(), grade ? grade.trim() : null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

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

app.get('/api/lunches/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT lr.id, s.rut, s.name, s.grade, lr.meal_type, lr.timestamp
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

app.get('/api/lunches/history', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: 'Missing from or to date' });
  }

  try {
    const query = `
      SELECT lr.id, s.rut, s.name, s.grade, lr.meal_type, lr.timestamp
      FROM lunch_registrations lr
      JOIN students s ON lr.student_id = s.id
      WHERE DATE(lr.timestamp) >= $1 AND DATE(lr.timestamp) <= $2
      ORDER BY lr.timestamp DESC
    `;
    const result = await pool.query(query, [from, to]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.delete('/api/lunches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM lunch_registrations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.put('/api/lunches/:id', async (req, res) => {
  const { id } = req.params;
  const { meal_type } = req.body;
  if (!meal_type) {
    return res.status(400).json({ message: 'Missing meal_type' });
  }

  try {
    const result = await pool.query(
      'UPDATE lunch_registrations SET meal_type = $1 WHERE id = $2 RETURNING *',
      [meal_type, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
