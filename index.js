import express, { response } from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import jwt from "jsonwebtoken";
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
    credentials: true,
  })
);

// Api to register new user
app.post(
  "/auth/register",
  [checkPasswordStrength, validateUsernameEmail],
  async (req, res) => {
    const { firstName, lastName, emailAddress, userName, password } = req.body;

    if (!firstName || !lastName || !userName || !emailAddress || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

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

//Api to log in users
app.post("/auth/login", async (req, res) => {
  try {
    const { userName, emailAddress, password, identifier } = req.body;
    const actualIdentifier = identifier || userName || emailAddress;

    if (!actualIdentifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier and password are required" });
    }

    const user = await client.user.findFirst({
      where: {
        OR: [
          { emailAddress: actualIdentifier },
          { userName: actualIdentifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Wrong login credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const jwtPayload = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET_KEY);
    res
      .status(200)
      .cookie("BlogitAuthToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .json({
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        emailAddress: user.emailAddress,
      });

    //TODO: learn how to make a jwt token expire and use it
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong" });
  }
});

//checking the port that the server is running
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
