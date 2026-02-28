export const authMiddleware = (req, res, next) => {
  // Add JWT verification logic here
  console.log('Verifying token...');
  next();
};