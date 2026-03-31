import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit3, Trash2, X, Save, Search } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ rut: '', name: '', grade: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (successMsg || error) {
      const t = setTimeout(() => { setSuccessMsg(''); setError(''); }, 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg, error]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/students`);
      setStudents(res.data || []);
    } catch (err) {
      console.error('fetchStudents error:', err.message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await axios.put(`${API_URL}/students/${editingId}`, {
          name: formData.name,
          grade: formData.grade
        });
        setSuccessMsg('Estudiante actualizado');
      } else {
        await axios.post(`${API_URL}/students`, formData);
        setSuccessMsg('Estudiante creado');
      }
      resetForm();
      fetchStudents();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data.message);
      } else {
        setError('Error al guardar estudiante');
      }
    }
  };

  const startEdit = (student) => {
    setEditingId(student.id);
    setFormData({ rut: student.rut, name: student.name, grade: student.grade || '' });
    setShowForm(true);
    setConfirmDeleteId(null);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/students/${id}`);
      setConfirmDeleteId(null);
      setSuccessMsg('Estudiante eliminado');
      fetchStudents();
    } catch (err) {
      setError('Error al eliminar estudiante');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ rut: '', name: '', grade: '' });
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.grade || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      <div className="glass-panel">
        <header className="header">
          <h1>Gestión de Estudiantes</h1>
        </header>

        {error && (
          <div className="alert error fade-in">
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert success fade-in">
            <span>{successMsg}</span>
          </div>
        )}

        <button className="add-student-btn" onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
          {showForm ? <><X size={18} /> Cancelar</> : <><Plus size={18} /> Agregar Estudiante</>}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="student-form fade-in">
            <h3>{editingId ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
            <input
              type="text"
              placeholder="RUT o Código de Barras"
              value={formData.rut}
              onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
              disabled={!!editingId}
              required
            />
            <input
              type="text"
              placeholder="Nombre completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Curso (ej: 1A, 2B)"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            />
            <button type="submit" className="save-btn">
              <Save size={16} /> {editingId ? 'Guardar Cambios' : 'Crear Estudiante'}
            </button>
          </form>
        )}

        <div className="students-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="students-count">
          Total: {filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}
        </div>

        {loading ? (
          <div className="loader">Cargando...</div>
        ) : (
          <div className="students-list">
            {filtered.map((s) => (
              <div key={s.id} className="student-row">
                <div className="student-row-info">
                  <h4>{s.name}</h4>
                  <p>{s.rut} {s.grade ? `• ${s.grade}` : ''}</p>
                </div>
                <div className="student-row-actions">
                  <button className="action-btn edit" onClick={() => startEdit(s)}>
                    <Edit3 size={14} />
                  </button>
                  {confirmDeleteId === s.id ? (
                    <div className="confirm-delete">
                      <button className="action-btn delete" onClick={() => handleDelete(s.id)}>Sí</button>
                      <button className="action-btn cancel" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </div>
                  ) : (
                    <button className="action-btn delete" onClick={() => setConfirmDeleteId(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', padding: '20px 0' }}>
                {searchTerm ? 'No se encontraron estudiantes.' : 'No hay estudiantes registrados.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Students;
