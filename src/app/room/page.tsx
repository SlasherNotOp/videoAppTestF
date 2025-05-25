'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomPage() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const joinRoom = () => {
    if (roomId.trim()) router.push(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-xl space-y-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800">Join a Room</h2>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={joinRoom}
          className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition"
        >
          Join
        </button>
      </div>
    </div>
  );
}