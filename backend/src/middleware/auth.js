const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET wajib di-set di environment.');
}

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;

      if (requiredRoles.length > 0 && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

module.exports = {
  auth
};


