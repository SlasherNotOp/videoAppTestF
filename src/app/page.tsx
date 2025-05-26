'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white">
      {/* Navbar */}
      <nav className="w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/" className="text-2xl font-bold tracking-tight">
              MeetX
            </Link>
          </motion.div>
          
          {/* Auth buttons */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center space-x-4"
          >
            <Link
              href="/login"
              className="px-4 py-2 text-white hover:text-gray-300 transition-colors font-medium"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Register
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
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
    </div>
  );
}