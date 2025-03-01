"use client";
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, Plus, Trash2, Menu, X, LogOut, Home } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Connection } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";
import { Button } from "@mui/material";
import { AnimatedTooltip } from "./ui/animated-tooltip";
import { useRouter } from "next/navigation";

const people = [
  {
    id: 1,
    name: "This is Vortexus",
    designation: "Click on + start",
    image: "/linear.png",
  },
];

interface Message {
  text: string;
  isBot: boolean;
}

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
}

interface ChatInterfaceProps {
  initialMessage?: string;
}

// Define API endpoint using our local proxy
const LOCAL_PROXY_ENDPOINT = "/api/proxy";
// Keep the original endpoint for reference or direct use if needed
const BACKEND_API_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://d4b6-41-184-168-89.ngrok-free.app/prompt";
// Use the local proxy by default to avoid CORS issues
const API_ENDPOINT = LOCAL_PROXY_ENDPOINT;

export function ChatInterface({ initialMessage = "" }: ChatInterfaceProps) {
  const { publicKey, sendTransaction, signTransaction, disconnect } = useWallet();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter(); // For navigation
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    apiEndpoint: string;
    backendEndpoint: string;
    connected: boolean;
    lastError: string | null;
  }>({
    apiEndpoint: API_ENDPOINT,
    backendEndpoint: BACKEND_API_ENDPOINT,
    connected: false,
    lastError: null
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Check API connectivity on component mount
  useEffect(() => {
    const checkApiConnectivity = async () => {
      console.log("Checking API connectivity...");
      try {
        const response = await fetch(API_ENDPOINT, {
          method: "HEAD",
          headers: { "Content-Type": "application/json" }
        });
        setDiagnosticInfo({
          apiEndpoint: API_ENDPOINT,
          backendEndpoint: BACKEND_API_ENDPOINT,
          connected: response.ok,
          lastError: null
        });
        console.log(`API connectivity check: ${response.ok ? 'Success' : 'Failed'}`);
      } catch (error: any) {
        console.error("API connectivity check failed:", error.message);
        setDiagnosticInfo({
          apiEndpoint: API_ENDPOINT,
          backendEndpoint: BACKEND_API_ENDPOINT,
          connected: false,
          lastError: `API connection failed: ${error.message}`
        });
      }
    };
    
    checkApiConnectivity();
  }, []);

  // Toggle diagnostics panel (for developers/administrators)
  const toggleDiagnostics = () => {
    setShowDiagnostics(prev => !prev);
  };

  useEffect(() => {
    const storedSessions = JSON.parse(localStorage.getItem("chatSessions") || "[]");
    setSessions(storedSessions);
    
    // Set current session if there are existing sessions
    if (storedSessions.length > 0) {
      setCurrentSessionId(storedSessions[0].id);
    } else if (initialMessage) {
      // If we have an initial message but no sessions, create a new session
      const newSession = createNewSession();
      // We'll handle sending the initial message after the component is fully mounted
    }
  }, []);

  // Effect to handle initial message after component is mounted and sessions are set up
  useEffect(() => {
    // Only run this effect if we have an initialMessage and a currentSessionId
    if (initialMessage && currentSessionId) {
      // Check if this session already has the initial message (to prevent duplicates on re-renders)
      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (currentSession && currentSession.messages.length === 0) {
        // Manually trigger the submit process for the initial message
        const userMessage: Message = { text: initialMessage, isBot: false };
        
        // Add user message to the session
        setSessions((prev) =>
          prev.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  name: initialMessage.substring(0, 30), // Use initial message as session name
                  messages: [userMessage],
                }
              : session
          )
        );
        
        // Send the message to the API
        const sendInitialMessage = async () => {
          try {
            const botResponse = await sendMessageToAPI(initialMessage);
            setSessions((prev) =>
              prev.map((session) =>
                session.id === currentSessionId
                  ? {
                      ...session,
                      messages: [
                        ...session.messages,
                        { text: botResponse, isBot: true },
                      ],
                    }
                  : session
              )
            );
          } catch (error: any) {
            console.error("Error sending initial message:", error.message);
            toast.error("Failed to process your initial message.");
          }
        };
        
        sendInitialMessage();
        // Clear the initialMessage from the input field as it's been processed
        setInput("");
      }
    }
  }, [initialMessage, currentSessionId, sessions]);

  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
  }, [sessions]);

  const currentSession = sessions.find((session) => session.id === currentSessionId);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: "Session: New Chat",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession;
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(sessions[0]?.id || null);
    }
  };

  const handleWalletDisconnect = async () => {
    try {
      await disconnect(); // Disconnect the wallet
      toast.success("Wallet disconnected successfully.");
      router.push("/"); // Redirect to the homepage
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast.error("Failed to disconnect the wallet.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentSessionId) return;

    const userMessage: Message = { text: input, isBot: false };

    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              name: session.messages.length === 0 ? input : session.name,
              messages: [...session.messages, userMessage],
            }
          : session
      )
    );
    setInput(""); // Clear input field

    try {
      const botResponse = await sendMessageToAPI(input);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? {
                ...session,
                messages: [
                  ...session.messages,
                  { text: botResponse, isBot: true },
                ],
              }
            : session
        )
      );
    } catch (error: any) {
      console.error("Error during handleSubmit:", error.message);
      toast.error("Failed to process your request.");
    }
  };

  const sendMessageToAPI = async (message: string) => {
    console.log("sendMessageToAPI called with message:", message);
    console.log("Current wallet state:", publicKey ? publicKey.toBase58() : "not connected");
    console.log("Using proxy API endpoint:", API_ENDPOINT);
    console.log("Backend API endpoint:", BACKEND_API_ENDPOINT);
    
    setLoading(true);
    try {
      console.log("Sending request to proxy API...");
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          walletAddress: publicKey ? publicKey.toBase58() : null,
        }),
      });

      console.log("API response status:", response.status);
      
      // Handle non-successful response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response from proxy:", errorText);
        
        try {
          // Try to parse the error as JSON
          const errorJson = JSON.parse(errorText);
          console.error("Structured error from proxy:", errorJson);
          
          if (errorJson.error) {
            throw new Error(`Proxy error: ${errorJson.error}`);
          }
        } catch (parseError) {
          // If parsing fails, use the raw error text
          throw new Error(`API responded with status ${response.status}: ${errorText}`);
        }
      }
      
      const data = await response.json();
      console.log("API response data:", data);

      // Add detailed logging about the response fields
      console.log("data.response exists:", !!data.response);
      console.log("data.response value:", data.response);
      console.log("data.output exists:", !!data.output);
      console.log("data.output value:", data.output);
      
      // Check if we got an error from the proxy
      if (data.error) {
        console.error("Error from proxy:", data.error);
        throw new Error(`Proxy error: ${data.error}`);
      }

      if (data.output) {
        let outputData;

        try {
          outputData = JSON.parse(data.output);
          console.log("Parsed output data:", outputData);
        } catch (error) {
          console.log("Failed to parse output data, returning raw output");
          return data.output;
        }

        if (outputData && outputData.success && outputData.transaction) {
          console.log("Transaction data received, attempting to process");
          const transactionBuffer = Buffer.from(outputData.transaction, "base64");
          const versionedTransaction = VersionedTransaction.deserialize(transactionBuffer);

          if (!publicKey) {
            toast.error("Wallet not connected. Please connect your wallet.");
            return "Wallet not connected.";
          }

          if (!signTransaction) {
            toast.error("Your wallet does not support signing transactions.");
            return "Wallet does not support signing transactions.";
          }

          toast.info("Please sign the transaction in your wallet.");
          console.log("Requesting transaction signature");
          const signedTransaction = await signTransaction(versionedTransaction);
          const connection = new Connection(
            `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`,
            "confirmed"
          );

          console.log("Sending signed transaction");
          const txid = await sendTransaction(signedTransaction, connection);
          toast.success(`Transaction sent successfully! TXID: ${txid}`);
          return `Transaction sent successfully! TXID: ${txid}`;
        }

        return data.response || "Received an empty response.";
      }
      
      // Modified to use data.response when available, even if data.output is falsy
      if (data.response) {
        console.log("Using data.response since data.output is falsy:", data.response);
        return data.response;
      }
      
      console.log("No response or output received from API");
      return "No output received from API";
    } catch (error: any) {
      console.error("API Error:", error.message);
      toast.error(`Error: ${error.message}`);
      return `Error: ${error.message}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen text-white">
      <ToastContainer />
      <div className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center backdrop-blur-lg z-0"></div>
      
      {/* Diagnostic Overlay - Only visible when toggled */}
      {showDiagnostics && (
        <div className="absolute top-4 right-4 bg-gray-800 border border-gray-700 p-4 rounded-md z-50 w-96 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">API Diagnostics</h3>
            <button 
              onClick={toggleDiagnostics}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Active Endpoint:</span>
              <span className="font-mono">{diagnosticInfo.apiEndpoint}</span>
            </div>
            <div className="flex justify-between">
              <span>Backend Endpoint:</span>
              <span className="font-mono">{diagnosticInfo.backendEndpoint}</span>
            </div>
            <div className="flex justify-between">
              <span>Connection Status:</span>
              <span className={diagnosticInfo.connected ? "text-green-400" : "text-red-400"}>
                {diagnosticInfo.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Environment:</span>
              <span>{process.env.NODE_ENV}</span>
            </div>
            {diagnosticInfo.lastError && (
              <div className="mt-2">
                <span className="block text-gray-400">Last Error:</span>
                <span className="block text-red-400 text-xs mt-1 font-mono break-all">
                  {diagnosticInfo.lastError}
                </span>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={async () => {
                  const checkApiConnectivity = async () => {
                    try {
                      const response = await fetch(API_ENDPOINT, {
                        method: "HEAD",
                        headers: { "Origin": window.location.origin }
                      });
                      setDiagnosticInfo({
                        apiEndpoint: API_ENDPOINT,
                        backendEndpoint: BACKEND_API_ENDPOINT,
                        connected: response.ok,
                        lastError: null
                      });
                      console.log(`Reconnection check: ${response.ok ? 'Success' : 'Failed'}`);
                      toast.info(`API connectivity check: ${response.ok ? 'Success' : 'Failed'}`);
                    } catch (error: any) {
                      setDiagnosticInfo({
                        apiEndpoint: API_ENDPOINT,
                        backendEndpoint: BACKEND_API_ENDPOINT,
                        connected: false,
                        lastError: error.message
                      });
                      toast.error(`API connectivity check failed: ${error.message}`);
                    }
                  };
                  
                  await checkApiConnectivity();
                }}
                className="w-full bg-indigo-600 p-2 rounded text-sm hover:bg-indigo-700"
              >
                Check Connectivity
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative flex z-10 h-full w-full">
        {isSidebarOpen && (
          <div className="w-1/4 bg-gray-800 border-r border-gray-700 flex flex-col">
            <div className="p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Chat Sessions</h2>
              <AnimatedTooltip items={people} />
              <button
                onClick={createNewSession}
                className="bg-indigo-600 p-2 rounded hover:bg-indigo-700"
              >
                <Plus />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={`p-2 cursor-pointer flex justify-between items-center ${
                    session.id === currentSessionId
                      ? "bg-indigo-600"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <span className="truncate">{session.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div
          className={`flex-1 flex flex-col ${isSidebarOpen ? "pl-0" : "pl-4"}`}
        >
          <div className="p-4 flex justify-between items-center border-b border-gray-700 bg-black/30">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="bg-gray-800 p-2 rounded hover:bg-gray-700"
              >
                {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
              <Button
                href="/"
                color="secondary"
                variant="contained"
                className="py-1 bg-gray-500 text-white rounded-lg hover:bg-indigo-700"
              >
                <Home />
              </Button>
              {/* Diagnostics Toggle Button (only visible in development or when there are connection issues) */}
              {(process.env.NODE_ENV === 'development' || !diagnosticInfo.connected) && (
                <button
                  onClick={toggleDiagnostics}
                  className={`p-2 rounded text-xs ${
                    diagnosticInfo.connected 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-red-700 text-white hover:bg-red-600'
                  }`}
                  title="Toggle API diagnostics"
                >
                  {diagnosticInfo.connected ? 'Diagnostics' : 'API Error'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Wallet className="text-indigo-400" />
              <div>
                <h1 className="text-lg font-semibold">
                  {currentSession ? currentSession.name : "No Chat Selected"}
                </h1>
                <p className="text-sm text-gray-400">
                  Wallet: {publicKey ? publicKey.toBase58() : "Not connected"}
                </p>
              </div>
              <button
                onClick={handleWalletDisconnect}
                className="bg-red-600 p-2 rounded hover:bg-red-700 flex items-center"
              >
                <LogOut className="mr-2" />
                Disconnect
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentSession?.messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg break-words w-fit max-w-full sm:max-w-md ${
                  msg.isBot
                    ? "bg-gray-700 text-gray-200"
                    : "bg-indigo-600 text-white ml-auto"
                }`}
              >
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </motion.div>
            ))}
            {loading && (
              <p className="text-gray-400">Vortexus is Typing...</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-gray-800 p-2 rounded text-gray-200 placeholder-gray-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 p-2 rounded hover:bg-indigo-700"
                disabled={!currentSessionId || loading}
              >
                <ArrowRight />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
