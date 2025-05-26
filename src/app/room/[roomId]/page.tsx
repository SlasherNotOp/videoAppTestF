/* eslint-disable */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface WebSocketMessage {
  type: string;
  token?: string;
  from?: string;
  payload?: any;
  userId?: string;
}

interface DebugInfo {
  peers: number;
  messages: string[];
}

export default function VideoRoom() {
  const roomId = "test-room-123";
  const router = useRouter();
  
  // Generate unique session ID for each tab/instance
  const sessionIdRef = useRef(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOffersRef = useRef(new Set<string>()); // Track pending offers to avoid duplicates
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ peers: 0, messages: [] });

  useEffect(() => {
    initializeConnection();
    
    return () => {
      cleanup();
    };
  }, []);

  const addDebugMessage = (message: string) => {
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
      
      // Try to get token from localStorage, fallback to mock data for testing
      tokenRef.current = localStorage.getItem('token') || 'mock-token';
      const userData = localStorage.getItem('user');
      userIdRef.current = userData ? JSON.parse(userData)?.id : sessionIdRef.current;

      initializeMedia();
      joinRoom();
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        console.log('Received message:', msg);
        addDebugMessage(`Received: ${msg.type} from ${msg.from || 'server'}`);
        await handleWebSocketMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
        addDebugMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      addDebugMessage('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      addDebugMessage(`WebSocket error: Connection failed`);
    };
  };

  const handleWebSocketMessage = async (msg: WebSocketMessage) => {
    const { type, token, from, payload, userId } = msg;

    switch (type) {
      case 'LOGIN_SUCCESS':
        tokenRef.current = token || null;
        userIdRef.current = msg.userId || null;
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
          
          // FIXED: Always create peer connection when user joins
          // Use a small delay to ensure both users are ready
          setTimeout(() => {
            createPeerConnection(from, true);
          }, 100);
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
        addDebugMessage('Unauthorized - check token');
        router.push(`/register`);
        break;

      default:
        console.log('Unknown message type:', type);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, 
        audio: true 
      });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('Local media initialized');
      addDebugMessage('Camera and microphone initialized');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      addDebugMessage(`Media error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const joinRoom = () => {
    if (socketRef.current && tokenRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'JOIN_ROOM',
        token: tokenRef.current,
        payload: { roomId }
      }));
    }
  };

  const createPeerConnection = async (peerId: string, isOfferer: boolean): Promise<RTCPeerConnection | undefined> => {
    // FIXED: Prevent duplicate peer connections
    if (peersRef.current[peerId]) {
      console.log(`Peer connection with ${peerId} already exists`);
      return peersRef.current[peerId];
    }

    // FIXED: Prevent duplicate offers
    if (isOfferer && pendingOffersRef.current.has(peerId)) {
      console.log(`Offer already pending for ${peerId}`);
      return;
    }

    console.log(`Creating peer connection with ${peerId}, isOfferer: ${isOfferer}`);
    addDebugMessage(`Creating peer connection with ${peerId.slice(-4)}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    peersRef.current[peerId] = pc;
    
    // Update peer count for debugging
    setDebugInfo(prev => ({
      ...prev,
      peers: Object.keys(peersRef.current).length
    }));

    // FIXED: Add local stream tracks with better error handling
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
            console.log(`Added ${track.kind} track to peer connection`);
          }
        } catch (error) {
          console.error('Error adding track:', error);
        }
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to', peerId);
        sendSignal(peerId, { candidate: event.candidate });
      }
    };

    // Handle remote stream
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('Received remote stream from:', peerId);
      addDebugMessage(`Received video from ${peerId.slice(-4)}`);
      const remoteStream = event.streams[0];
      displayRemoteVideo(peerId, remoteStream);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      addDebugMessage(`Connection with ${peerId.slice(-4)}: ${pc.connectionState}`);
      
      // FIXED: Clean up failed connections
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeerConnection(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${peerId}:`, pc.iceConnectionState);
    };

    // FIXED: If this peer should create the offer
    if (isOfferer) {
      pendingOffersRef.current.add(peerId);
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        console.log('Sending offer to', peerId);
        sendSignal(peerId, { sdp: offer });
      } catch (error) {
        console.error('Error creating offer:', error);
        addDebugMessage(`Error creating offer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        pendingOffersRef.current.delete(peerId);
      }
    }

    return pc;
  };

  const handleSignal = async (peerId: string, signal: any) => {
    console.log(`Handling signal from ${peerId}:`, signal.sdp?.type || signal.candidate ? 'ICE candidate' : 'unknown');
    
    let peer:RTCPeerConnection | undefined = peersRef.current[peerId];
    
    // FIXED: Create peer connection if it doesn't exist (for receiving offers)
    if (!peer) {
      console.log(`Creating peer connection for incoming signal from ${peerId}`);
      
      peer = await createPeerConnection(peerId, false);
      if (!peer) return;
    }

    try {
      // Handle SDP (offer/answer)
      if (signal.sdp) {
        // FIXED: Check if we can set remote description
        if (peer.signalingState === 'closed') {
          console.log('Peer connection is closed, ignoring signal');
          return;
        }

        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        console.log(`Set remote description (${signal.sdp.type}) for ${peerId}`);
        
        // If it's an offer, create and send answer
        if (signal.sdp.type === 'offer') {
          pendingOffersRef.current.delete(peerId); // Clear pending offer flag
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          console.log('Sending answer to', peerId);
          sendSignal(peerId, { sdp: answer });
        } else if (signal.sdp.type === 'answer') {
          pendingOffersRef.current.delete(peerId); // Clear pending offer flag
        }
      }

      // Handle ICE candidates
      if (signal.candidate) {
        // FIXED: Only add candidate if we have remote description
        if (peer.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
          console.log('Added ICE candidate from', peerId);
        } else {
          console.log('Waiting for remote description before adding ICE candidate');
          // You might want to queue candidates here if needed
        }
      }
    } catch (error) {
      console.error('Error handling signal from', peerId, ':', error);
      addDebugMessage(`Signal error from ${peerId.slice(-4)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendSignal = (peerId: string, signal: any) => {
    if (socketRef.current && tokenRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SIGNAL',
        token: tokenRef.current,
        payload: { roomId, to: peerId, signal },
        from: userIdRef.current
      }));
    } else {
      console.error('Cannot send signal: WebSocket not ready');
    }
  };

  const displayRemoteVideo = (peerId: string, stream: MediaStream) => {
    // Remove existing video if it exists
    const existingContainer = document.getElementById(`container-${peerId}`);
    if (existingContainer) {
      existingContainer.remove();
    }

    const video = document.createElement('video');
    video.id = `video-${peerId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.className = 'w-64 h-48 rounded-lg shadow-lg bg-gray-800';
    video.srcObject = stream;
    
    const container = document.createElement('div');
    container.id = `container-${peerId}`;
    container.className = 'relative';
    container.appendChild(video);
    
    const label = document.createElement('div');
    label.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm';
    label.textContent = `User ${peerId.slice(-4)}`;
    container.appendChild(label);
    
    videoContainerRef.current?.appendChild(container);
    
    // FIXED: Ensure video plays
    video.onloadedmetadata = () => {
      video.play().catch(e => console.log('Video play failed:', e));
    };
  };

  const closePeerConnection = (peerId: string) => {
    const peer = peersRef.current[peerId];
    if (peer) {
      peer.close();
      delete peersRef.current[peerId];
      pendingOffersRef.current.delete(peerId); // Clean up pending offers
      
      // Update peer count
      setDebugInfo(prev => ({
        ...prev,
        peers: Object.keys(peersRef.current).length
      }));
    }
    
    // Remove video element
    const container = document.getElementById(`container-${peerId}`);
    if (container) {
      container.remove();
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
    Object.values(peersRef.current).forEach(peer => {
      if (peer && peer.connectionState !== 'closed') {
        peer.close();
      }
    });
    peersRef.current = {};
    pendingOffersRef.current.clear();
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Video Room - FIXED VERSION</h1>
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
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={toggleVideo}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
          <h3 className="text-sm font-bold mb-2">Debug Info (Fixed Version)</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p>Your User ID: {userIdRef.current || 'Not set'}</p>
            <p>Connected Users: [{connectedUsers.join(', ')}]</p>
            <p>Active Peer Connections: {debugInfo.peers}</p>
            <p>Pending Offers: {pendingOffersRef.current.size}</p>
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