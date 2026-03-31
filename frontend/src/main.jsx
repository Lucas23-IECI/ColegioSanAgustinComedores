import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Nav from './Nav.jsx'
import App from './App.jsx'
import Students from './Students.jsx'
import TestBarcodes from './TestBarcodes.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/estudiantes" element={<Students />} />
        <Route path="/test-barcodes" element={<TestBarcodes />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
