import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { AuthClient } from '@dfinity/auth-client';
import { createActor } from '../../declarations/isen_mulang_rust_backend/index';

// Define the data types used in the app
const initialLotState = {
  id: '',
  farmer: '',
  harvest_date: '',
  location: '',
  status: '',
  updates: [],
  timestamp: '',
};

const initialUpdateState = {
  status: '',
  details: '',
  timestamp: '',
  updated_by: '',
};

const II_URL = 'https://identity.ic0.app';

// Main App component
export default function App() {
  const [view, setView] = useState('list'); // 'list', 'add', 'update'
  const [lots, setLots] = useState([]);
  const [currentLot, setCurrentLot] = useState(initialLotState);
  const [newUpdate, setNewUpdate] = useState(initialUpdateState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // State for Internet Identity
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState(null);

  // New states for the chat feature
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Initialize AuthClient on component mount
  useEffect(() => {
    AuthClient.create().then(async (client) => {
      setAuthClient(client);
      const authenticated = await client.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setPrincipal(client.getIdentity().getPrincipal());
      }
    });
  }, []);

  // Fetch data from the canister only after authentication
  useEffect(() => {
    // This function fetches the lots from the backend canister.
    async function fetchLots() {
      // FIX: Only attempt to fetch if the authClient is available and authenticated.
      if (!authClient || !isAuthenticated) return;
      
      setLoading(true);
      try {
        const agent = authClient.getIdentity();
        // Create an actor with the authenticated agent
        const backendActor = createActor(process.env.CANISTER_ID_ISEN_MULANG_RUST_BACKEND, { agent });
        const allLots = await backendActor.get_all_lots();
        setLots(allLots);
      } catch (error) {
        console.error("Failed to fetch lots:", error);
        setMessage("Failed to load coffee lots.");
      } finally {
        setLoading(false);
      }
    }
    
    // Call the function to fetch the data.
    fetchLots();
  }, [isAuthenticated, authClient, view]); // Re-fetch when auth status or view changes

  // Handle Internet Identity login
  const handleLogin = async () => {
    await authClient.login({
      identityProvider: II_URL,
      onSuccess: () => {
        setIsAuthenticated(true);
        setPrincipal(authClient.getIdentity().getPrincipal());
        setMessage("Successfully logged in.");
      },
      onError: (error) => {
        console.error("Login failed:", error);
        setMessage("Login failed. Please try again.");
      },
    });
  };

  // Handle Internet Identity logout
  const handleLogout = async () => {
    await authClient.logout();
    setIsAuthenticated(false);
    setPrincipal(null);
    setLots([]);
    setMessage("Successfully logged out.");
  };

  // Handle adding a new lot
  const handleAddLot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // FIX: Check if authClient and principal are available before proceeding.
    if (!authClient || !principal) {
      setMessage("Please log in first to add a coffee lot.");
      setLoading(false);
      return;
    }
    
    try {
      const { farmer, harvest_date, location } = currentLot;
      // Get the authenticated identity to create the actor
      const agent = authClient.getIdentity();
      // FIX: Ensure the agent is passed to createActor
      const backendActor = createActor(process.env.CANISTER_ID_ISEN_MULANG_RUST_BACKEND, { agent });
      const result = await backendActor.add_lot(farmer, harvest_date, location);
      if (result > 0) {
        setMessage('Successfully added new coffee lot.');
        setView('list');
        setCurrentLot(initialLotState);
      } else {
        setMessage('Failed to add coffee lot. Please try again.');
      }
    } catch (error) {
      console.error("Failed to add lot:", error);
      setMessage("An error occurred while adding the lot.");
    } finally {
      setLoading(false);
    }
  };

  // Handle updating an existing lot
  const handleUpdateLot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // FIX: Check if authClient and principal are available before proceeding.
    if (!authClient || !principal) {
      setMessage("Please log in first to update a coffee lot.");
      setLoading(false);
      return;
    }

    try {
      // Get the authenticated identity to create the actor
      const agent = authClient.getIdentity();
      // FIX: Ensure the agent is passed to createActor
      const backendActor = createActor(process.env.CANISTER_ID_ISEN_MULANG_RUST_BACKEND, { agent });
      const result = await backendActor.update_lot(BigInt(currentLot.id), newUpdate.status, newUpdate.details);
      if (result) {
        setMessage(`Lot ID ${currentLot.id.toString()} successfully updated.`);
        setView('list');
      } else {
        setMessage('Failed to update lot. Please check the ID and try again.');
      }
    } catch (error) {
      console.error("Failed to update lot:", error);
      setMessage("An error occurred while updating the lot.");
    } finally {
      setLoading(false);
    }
  };

  // Handle chat message submission
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatHistory(prevHistory => [...prevHistory, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Build the history payload for the API call
      const historyForApi = chatHistory.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
      historyForApi.push({ role: 'user', parts: [{ text: userMessage }] });

      const payload = {
        contents: historyForApi,
      };

      const apiKey = ""; // Keep as empty string
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      const botResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (botResponse) {
        setChatHistory(prevHistory => [...prevHistory, { role: 'model', text: botResponse }]);
      } else {
        setChatHistory(prevHistory => [...prevHistory, { role: 'model', text: 'Sorry, I could not generate a response.' }]);
      }
    } catch (error) {
      console.error('Chatbot API error:', error);
      setChatHistory(prevHistory => [...prevHistory, { role: 'model', text: 'An error occurred. Please try again later.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };


  // UI rendering based on current view
  const renderView = () => {
    switch (view) {
      case 'add':
        return (
          <form onSubmit={handleAddLot} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Add New Coffee Lot</h2>
            <input
              type="text"
              placeholder="Farmer Name"
              value={currentLot.farmer}
              onChange={(e) => setCurrentLot({ ...currentLot, farmer: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="date" // Use type="date" for a native calendar input
              placeholder="Harvest Date"
              value={currentLot.harvest_date}
              onChange={(e) => setCurrentLot({ ...currentLot, harvest_date: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Location"
              value={currentLot.location}
              onChange={(e) => setCurrentLot({ ...currentLot, location: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Lot'}
            </button>
            <button
              type="button"
              onClick={() => { setView('list'); setMessage(''); }}
              className="w-full py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </form>
        );

      case 'update':
        return (
          <form onSubmit={handleUpdateLot} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Update Coffee Lot Status</h2>
            <p className="text-sm text-gray-600">
              Updating Lot: <span className="font-mono bg-gray-200 p-1 rounded">{currentLot.id.toString()}</span>
            </p>
            <input
              type="text"
              placeholder="New Status"
              value={newUpdate.status}
              onChange={(e) => setNewUpdate({ ...newUpdate, status: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Details of the update"
              value={newUpdate.details}
              onChange={(e) => setNewUpdate({ ...newUpdate, details: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Lot'}
            </button>
            <button
              type="button"
              onClick={() => { setView('list'); setMessage(''); }}
              className="w-full py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </form>
        );

      default: // 'list' view
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Coffee Lots</h2>
              <button
                onClick={() => setView('add')}
                className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Add New Lot
              </button>
            </div>
            {loading ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : lots.length === 0 ? (
              <p className="text-center text-gray-500">No coffee lots found. Add one to get started!</p>
            ) : (
              <ul className="space-y-4">
                {lots.map((lot) => (
                  <li key={lot.id.toString()} className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-500">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">Lot #{lot.id.toString()}</h3>
                      <button
                        onClick={() => {
                          setCurrentLot(lot);
                          setNewUpdate(initialUpdateState);
                          setView('update');
                        }}
                        className="py-1 px-3 bg-yellow-500 text-white text-sm font-semibold rounded-md shadow hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        Update
                      </button>
                    </div>
                    <p className="text-gray-700"><strong>Farmer:</strong> {lot.farmer}</p>
                    <p className="text-gray-700"><strong>Harvest Date:</strong> {lot.harvest_date}</p>
                    <p className="text-gray-700"><strong>Location:</strong> {lot.location}</p>
                    <p className="text-gray-700"><strong>Current Status:</strong> {lot.status}</p>
                    {lot.updates.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-semibold text-gray-800">History:</h4>
                        <ul className="mt-2 space-y-1 text-sm text-gray-600">
                          {lot.updates.map((update, index) => (
                            <li key={index} className="bg-gray-100 p-2 rounded-md">
                              <p><strong>Status:</strong> {update.status}</p>
                              <p><strong>Details:</strong> {update.details}</p>
                              <p><strong>Updated By:</strong> {update.updated_by.toText()}</p>
                              <p><strong>Timestamp:</strong> {new Date(Number(update.timestamp) / 1000000).toLocaleString()}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center p-8 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-8">
        <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-8">Isen Mulang Coffee Tracker</h1>
        {/* Authentication Section */}
        <div className="flex justify-end mb-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Logged in as: <span className="font-mono break-all">{principal.toText()}</span>
              </span>
              <button
                onClick={handleLogout}
                className="py-2 px-4 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700"
            >
              Login with Internet Identity
            </button>
          )}
        </div>
        
        {message && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
            <p>{message}</p>
          </div>
        )}
        
        {/* Main Content (conditionally rendered) */}
        {isAuthenticated ? renderView() : (
          <div className="text-center p-8">
            <p className="text-gray-600">Please log in to track and update coffee lots.</p>
          </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-50"
        title="Open Chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.677A9.953 9.953 0 0112 11a9.953 9.953 0 017.605 3.677L21 20l-1.395-3.677A9.863 9.863 0 0121 12z" />
        </svg>
      </button>

      {/* Chat Box UI */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-8 w-80 h-[400px] bg-white rounded-lg shadow-xl flex flex-col z-50">
          <div className="flex justify-between items-center p-4 bg-gray-200 rounded-t-lg">
            <h3 className="font-bold text-gray-800">Chat with AI</h3>
            <button onClick={() => setIsChatOpen(false)} className="text-gray-600 hover:text-gray-900 focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg shadow ${
                    msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg shadow animate-pulse">
                  ...
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleChatSend();
                }}
                disabled={isChatLoading}
              />
              <button
                onClick={handleChatSend}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-400"
                disabled={isChatLoading}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
