import { PrismaClient } from "@prisma/client";
const client = new PrismaClient();

async function validateUsernameEmail(req, res, next) {
  const { emailAddress, userName } = req.body;
  try {
    const userWithEmail = await client.user.findFirst({
      where: { emailAddress },
    });
    if (userWithEmail) {
      return res.status(400).json({ message: "Email Address already taken" });
    }

    const userWithUserName = await client.user.findFirst({
      where: { userName },
    });
    if (userWithUserName) {
      return res.status(400).json({ message: "Username is already taken" });
    }
    next();
  } catch (e) {
    res.status(500).json({ message: "Error validating username and email" });
  }
}
export default validateUsernameEmail;
