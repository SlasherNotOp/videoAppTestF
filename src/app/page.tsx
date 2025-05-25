'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center justify-center text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="text-center space-y-6"
      >
        <motion.h1 className="text-5xl font-bold tracking-tight">
          Welcome to MeetX
        </motion.h1>
        <motion.p className="text-lg text-gray-300">
          Secure, fast, and modern video chat like Google Meet.
        </motion.p>
        <Link
          href="/room"
          className="inline-block px-6 py-3 bg-white text-black rounded-full font-semibold shadow hover:bg-gray-200 transition"
        >
          Enter a Room
        </Link>
      </motion.div>
    </div>
  );
}