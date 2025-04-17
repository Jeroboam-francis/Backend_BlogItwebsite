export default function validateProfileUpdate(req, res, next) {
    const {
      firstName,
      lastName,
      emailAddress,
      userName,
      secondaryEmail
    } = req.body;
  
    // Validate required fields
    if (!firstName || !lastName || !emailAddress || !userName) {
      return res.status(400).json({ message: "Required fields are missing" });
    }
  
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
  
    // Validate secondary email if provided
    if (secondaryEmail && !emailRegex.test(secondaryEmail)) {
      return res.status(400).json({ message: "Invalid secondary email format" });
    }
  
    // Validate username (alphanumeric with underscores)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(userName)) {
      return res.status(400).json({ 
        message: "Username can only contain letters, numbers, and underscores" 
      });
    }
  
    next();
  }