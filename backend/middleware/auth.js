const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto_colegio123';

const verifyToken = (req, res, next) => {
  const token = req.cookies.token; // Recupera desde HttpOnly Cookie

  if (!token) {
    return res.status(403).json({ message: 'Se requiere cookie de autenticación (HttpOnly)' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, correo, rol }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token de Cookie inválido o expirado' });
  }
};

const verifyRole = (rolesAllowed) => {
  return (req, res, next) => {
    if (!req.user || !rolesAllowed.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No tienes permisos suficientes para esta acción' });
    }
    next();
  };
};

module.exports = { verifyToken, verifyRole, JWT_SECRET };
