import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import validateUsernameEmail from "./middleware/validateUsernameEmail.js";
import checkPasswordStrength from "./middleware/CheckPasswordStregth.js";

const app = express();
const client = new PrismaClient();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET, POST, PUT, DELETE",
  })
);

app.post(
  "/auth/register",
  [checkPasswordStrength, validateUsernameEmail],
  async (req, res) => {
    const { firstName, lastName, emailAddress, userName, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    try {
      const newUser = await client.user.create({
        data: {
          firstName,
          lastName,
          emailAddress,
          userName,
          password: hashedPassword,
        },
      });

      res.status(201).json(newUser);
    } catch (e) {
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
