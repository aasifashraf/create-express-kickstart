export const authController = {
  login: (req, res) => res.json({ message: "Login logic goes here." }),
  register: (req, res) => res.json({ message: "Register logic goes here." }),
  profile: (req, res) => res.json({ message: "Protected profile data." })
};