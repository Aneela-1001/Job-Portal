const jwt = require('jsonwebtoken');

function getTokenFromRequest(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
}

function verifyToken(req, res, next) {
  console.log('verifyToken called'); 
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ message: 'Authentication token missing' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    console.log('verifyToken success', req.user);
    next(); // <-- must call next() here
  } catch (err) {
    console.error('verifyToken error', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function authorizeRole(...allowed) {
  return (req, res, next) => {
    console.log('authorizeRole called', req.user?.role);
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
    }
    next(); // <-- must call next() here
  };
}


module.exports = {
  verifyToken,
  authorizeRole
};