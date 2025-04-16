import jwt from "jsonwebtoken";

function verifyUser(req, res, next) {
  // console.log("Cookies received:", req.cookies);

  const { BlogitAuthToken } = req.cookies;
  // console.log("Token:", BlogitAuthToken);

  if (!BlogitAuthToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(BlogitAuthToken, process.env.JWT_SECRET_KEY, (err, data) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    } else {
      req.user = data;
      next();
    }
  });
}

export default verifyUser;
