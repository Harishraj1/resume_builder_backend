const authenticate = (req, res, next) => {
  console.log('Authentication middleware triggered');
  console.log('Session userId:', req); // Debug log
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    next();
  };
  
  module.exports = authenticate;