'use client';
import { getRandomValues } from 'crypto';
import { useEffect, useRef, useState } from 'react';

export default function VideoRoom() {
  const roomId = "test-room-123"; // You can make this dynamic
  // Generate unique session ID for each tab/instance
  const sessionIdRef = useRef(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const localVideoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const userIdRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ peers: 0, messages: [] });

  useEffect(() => {
    initializeConnection();
    
    return () => {
      // Cleanup on unmount
      cleanup();
    };
  }, []);

  const addDebugMessage = (message) => {
    setDebugInfo(prev => ({
      ...prev,
      messages: [...prev.messages.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]
    }));
  };

  

  const initializeConnection = () => {
    const ws = new WebSocket('wss://garland.mohitsasane.tech/chat/');
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      addDebugMessage('WebSocket connected');
      // Use unique email for each session to simulate different users
      // ws.send(JSON.stringify({
      //   type: 'LOGIN',
      //   payload: { 
      //     email: `user@example.com`, 
      //     password: '123456' 
      //   }
      // }));
      tokenRef.current = localStorage.getItem('token');
      userIdRef.current = JSON.parse(localStorage.getItem('user') || '{}')?.id;



      initializeMedia();
      joinRoom();
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Received message:', msg);
        addDebugMessage(`Received: ${msg.type} from ${msg.from || 'server'}`);
        await handleWebSocketMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
        addDebugMessage(`Error: ${error.message}`);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      addDebugMessage('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addDebugMessage(`WebSocket error: ${error.message || 'Connection failed'}`);
    };
  };

  const handleWebSocketMessage = async (msg) => {
    const { type, token, from, payload, userId } = msg;

    switch (type) {
      case 'LOGIN_SUCCESS':
        tokenRef.current = token;
        userIdRef.current = msg.userId;
        await initializeMedia();
        
        break;

      case 'JOINED_ROOM':
        setIsConnected(true);
        addDebugMessage(`Joined room: ${payload?.roomId || roomId}`);
        console.log('Successfully joined room:', payload?.roomId || roomId);
        break;

      case 'USER_JOINED':
        if (from && from !== userIdRef.current) {
          console.log('User joined:', from);
          addDebugMessage(`User joined: ${from}`);
          setConnectedUsers(prev => {
            const updated = [...prev.filter(id => id !== from), from];
            console.log('Updated connected users:', updated);
            return updated;
          });
          await createPeerConnection(from, true);
        }
        break;

      case 'USER_LEFT':
        if (userId && userId !== userIdRef.current) {
          console.log('User left:', userId);
          addDebugMessage(`User left: ${userId}`);
          setConnectedUsers(prev => {
            const updated = prev.filter(id => id !== userId);
            console.log('Updated connected users after leave:', updated);
            return updated;
          });
          closePeerConnection(userId);
        }
        break;

      case 'SIGNAL':
        if (from && from !== userIdRef.current && payload?.signal) {
          await handleSignal(from, payload.signal);
        }
        break;

      case 'UNAUTHORIZED':
        console.error('Unauthorized access');
        break;

      default:
        console.log('Unknown message type:', type);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('Local media initialized');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const joinRoom = () => {
    if (socketRef.current && tokenRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'JOIN_ROOM',
        token: localStorage.getItem('token'),
        payload: { roomId }
      }));
    }
  };

  const createPeerConnection = async (peerId, isOfferer) => {
    console.log(`Creating peer connection with ${peerId}, isOfferer: ${isOfferer}`);
    addDebugMessage(`Creating peer connection with ${peerId.slice(-4)}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peersRef.current[peerId] = pc;
    
    // Update peer count for debugging
    setDebugInfo(prev => ({
      ...prev,
      peers: Object.keys(peersRef.current).length
    }));

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { candidate: event.candidate });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream from:', peerId);
      addDebugMessage(`Received video from ${peerId.slice(-4)}`);
      const remoteStream = event.streams[0];
      displayRemoteVideo(peerId, remoteStream);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      addDebugMessage(`Connection with ${peerId.slice(-4)}: ${pc.connectionState}`);
    };

    // If this peer should create the offer
    if (isOfferer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, { sdp: offer });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return pc;
  };

  const handleSignal = async (peerId, signal) => {
    console.log(`Handling signal from ${peerId}:`, signal);
    
    let peer = peersRef.current[peerId];
    
    // Create peer connection if it doesn't exist
    if (!peer) {
      peer = await createPeerConnection(peerId, false);
    }

    try {
      // Handle SDP (offer/answer)
      if (signal.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        // If it's an offer, create and send answer
        if (signal.sdp.type === 'offer') {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal(peerId, { sdp: answer });
        }
      }

      // Handle ICE candidates
      if (signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  const sendSignal = (peerId, signal) => {
    if (socketRef.current && tokenRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'SIGNAL',
        token: tokenRef.current,
        payload: { roomId, to: peerId, signal },
        from: userIdRef.current
      }));
    }
  };

  const displayRemoteVideo = (peerId, stream) => {
    let video = document.getElementById(`video-${peerId}`);
    
    if (!video) {
      video = document.createElement('video');
      video.id = `video-${peerId}`;
      video.autoplay = true;
      video.playsInline = true;
      video.className = 'w-64 h-48 rounded-lg shadow-lg bg-gray-800';
      
      const container = document.createElement('div');
      container.className = 'relative';
      container.appendChild(video);
      
      const label = document.createElement('div');
      label.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm';
      label.textContent = `User ${peerId.slice(-4)}`;
      container.appendChild(label);
      
      videoContainerRef.current?.appendChild(container);
    }
    
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
  };

  const closePeerConnection = (peerId) => {
    const peer = peersRef.current[peerId];
    if (peer) {
      peer.close();
      delete peersRef.current[peerId];
      
      // Update peer count
      setDebugInfo(prev => ({
        ...prev,
        peers: Object.keys(peersRef.current).length
      }));
    }
    
    // Remove video element
    const videoElement = document.getElementById(`video-${peerId}`);
    if (videoElement) {
      videoElement.parentElement?.remove();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const cleanup = () => {
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Video Room</h1>
          <p className="text-gray-400">Room ID: {roomId}</p>
          <p className="text-xs text-gray-500">Session: {sessionIdRef.current.slice(-8)}</p>
          <div className="mt-2">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Connected Users: {connectedUsers.length} | Active Peers: {debugInfo.peers}
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={toggleMute}
            className={`px-4 py-2 rounded-lg font-medium ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={toggleVideo}
            className={`px-4 py-2 rounded-lg font-medium ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
          </button>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {/* Local Video */}
          <div className="relative">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-64 h-48 rounded-lg shadow-lg bg-gray-800" 
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              You {isMuted && '(Muted)'} {isVideoOff && '(Video Off)'}
            </div>
          </div>
          
          {/* Remote Videos Container */}
          <div ref={videoContainerRef} className="contents">
            {/* Remote videos will be dynamically added here */}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-bold mb-2">Debug Info</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p>Your User ID: {userIdRef.current || 'Not set'}</p>
            <p>Connected Users: [{connectedUsers.join(', ')}]</p>
            <p>Active Peer Connections: {debugInfo.peers}</p>
            <div className="mt-2">
              <p className="font-semibold">Recent Messages:</p>
              {debugInfo.messages.map((msg, i) => (
                <p key={i} className="text-xs">{msg}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}