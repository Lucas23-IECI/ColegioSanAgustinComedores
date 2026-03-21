CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  rut VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS lunch_registrations (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  meal_type VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some dummy data for the MVP
INSERT INTO students (rut, name, grade) VALUES ('12345678-9', 'Juan Perez', '1A') ON CONFLICT (rut) DO NOTHING;
INSERT INTO students (rut, name, grade) VALUES ('98765432-1', 'Maria Gomez', '2B') ON CONFLICT (rut) DO NOTHING;
