'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import axios from "axios";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


const handleRegister = async (e) => {
  e.preventDefault();

  try {
    const res = await axios.post("https://garland.mohitsasane.tech/chat/api/auth/register", {
      email,
      password,
    });

    // const { token, user } = res.data;

    // localStorage.setItem("token", token);
    // localStorage.setItem("user", JSON.stringify(user));

    console.log("Login successful:", res.data);
    router.push("/login");

  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      alert(err.response.data?.message || "Login failed");
    } else {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred.");
    }
  }
};

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center text-black bg-gray-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        className="bg-white p-8 rounded shadow-md w-96"
        onSubmit={handleRegister}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl mb-6 font-bold text-center">Register</h2>
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 mb-4 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 mb-6 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </motion.button>
      </motion.form>
    </motion.div>
  );
}
