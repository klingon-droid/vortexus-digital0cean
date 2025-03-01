import { NextRequest, NextResponse } from 'next/server';

// Alternative implementation of fetch with better error handling
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000) {
  console.log(`fetchWithTimeout called for ${url}`);
  
  return new Promise<Response>(async (resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request to ${url} timed out after ${timeout}ms`));
    }, timeout);
    
    try {
      console.log(`Sending raw fetch request to ${url}...`);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`Received response with status ${response.status}`);
      
      resolve(response);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
      reject(error);
    }
  });
}

// Simple fallback response when API is unreachable
function generateFallbackResponse(message: string, walletAddress: string | null) {
  console.log("Generating fallback response");
  
  // Simple hardcoded responses
  if (message.toLowerCase().includes("what's your name") || 
      message.toLowerCase().includes("who are you")) {
    return {
      response: "I am Vortexus, an AI assistant for the Solana blockchain. I'm currently unable to connect to my backend API, so my functionality is limited. Please try again later when the connection is restored."
    };
  }
  
  if (message.toLowerCase().includes("hello") || 
      message.toLowerCase().includes("hi")) {
    return {
      response: "Hello! I'm Vortexus. I notice that I'm having trouble connecting to my backend API at the moment, so my abilities are limited. Please try again later or contact support if this issue persists."
    };
  }
  
  // Default response
  return {
    response: "I apologize, but I'm currently experiencing connectivity issues with my backend services. This means I can't properly process your request right now. Please try again later or contact support if this issue persists.",
    _error: "Fallback response due to API connectivity issues"
  };
}

export async function POST(request: NextRequest) {
  console.log("=== PROXY ROUTE STARTED ===");
  try {
    // Get the backend API URL from environment variables
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 
      "https://d4b6-41-184-168-89.ngrok-free.app/prompt";

    console.log(`Proxying request to: ${backendUrl}`);
    console.log(`Environment variable NEXT_PUBLIC_BACKEND_API_URL: ${process.env.NEXT_PUBLIC_BACKEND_API_URL || "not set"}`);
    
    // Get the request body
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body));
    
    // Extract message and wallet address
    const { message, walletAddress } = body;
    
    // Try to directly reach the backend to check connectivity
    console.log("Testing backend connectivity...");
    let backendReachable = false;
    try {
      // Use the base URL to check the health endpoint we just added
      const baseUrl = backendUrl.split('/').slice(0, 3).join('/');
      console.log(`Pinging backend base URL: ${baseUrl}`);
      
      const pingResponse = await fetch(`${baseUrl}/`, { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'text/plain',
          'User-Agent': 'NextJS-Proxy/1.0'
        },
      });
      console.log(`Backend ping response: ${pingResponse.status}`);
      backendReachable = pingResponse.ok; // Only consider 200 OK as truly reachable
    } catch (pingError) {
      console.error(`Backend ping failed: ${pingError instanceof Error ? pingError.message : String(pingError)}`);
      backendReachable = false;
    }
    
    // If the backend is not reachable, use the fallback
    if (!backendReachable && process.env.ENABLE_FALLBACK === 'true') {
      console.log("Backend is not reachable, using fallback response");
      const fallbackResponse = generateFallbackResponse(message, walletAddress);
      return NextResponse.json({
        ...fallbackResponse,
        _meta: {
          used_fallback: true,
          reason: "Backend API is unreachable"
        }
      });
    }
    
    console.log("Preparing to fetch from backend...");
    
    // Forward the request to the backend with our custom fetch implementation
    try {
      const response = await fetchWithTimeout(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'NextJS-Proxy/1.0',
          'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        },
        body: JSON.stringify(body),
        cache: 'no-store'
      }, 30000);
      
      console.log(`Backend responded with status: ${response.status}`);
      console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
      
      // If the response is not ok, handle the error
      if (!response.ok) {
        const errorText = await response.text().catch(e => "Could not read error response body");
        console.error(`Error response body: ${errorText}`);
        
        // Use fallback if enabled
        if (process.env.ENABLE_FALLBACK === 'true') {
          console.log("Backend returned error status, using fallback response");
          const fallbackResponse = generateFallbackResponse(message, walletAddress);
          return NextResponse.json({
            ...fallbackResponse,
            _meta: {
              used_fallback: true,
              reason: `Backend error: ${response.status}`
            }
          });
        }
        
        return NextResponse.json({ 
          error: `Backend responded with status: ${response.status}`,
          details: errorText
        }, { status: 502 });
      }
      
      // Try to get the response data
      console.log("Attempting to parse response JSON...");
      let data;
      try {
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        
        // Try to parse the JSON
        data = JSON.parse(responseText);
        console.log('Backend response data:', data);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        
        // Use fallback if enabled
        if (process.env.ENABLE_FALLBACK === 'true') {
          console.log("Failed to parse JSON response, using fallback response");
          const fallbackResponse = generateFallbackResponse(message, walletAddress);
          return NextResponse.json({
            ...fallbackResponse,
            _meta: {
              used_fallback: true,
              reason: "Failed to parse backend response"
            }
          });
        }
        
        return NextResponse.json({ 
          error: 'Failed to parse backend response as JSON',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        }, { status: 502 });
      }
      
      // Return the response from the backend
      console.log("Returning successful response from proxy");
      return NextResponse.json(data);
    } catch (fetchError: any) {
      console.error("Fetch operation failed:", fetchError.message);
      
      // Use fallback if enabled
      if (process.env.ENABLE_FALLBACK === 'true') {
        console.log("Fetch operation failed, using fallback response");
        const fallbackResponse = generateFallbackResponse(message, walletAddress);
        return NextResponse.json({
          ...fallbackResponse,
          _meta: {
            used_fallback: true,
            reason: fetchError.message
          }
        });
      }
      
      return NextResponse.json({ 
        error: 'Failed to communicate with backend',
        details: fetchError.message
      }, { status: 503 });
    }
  } catch (error: any) {
    console.error('Error in proxy route:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'An error occurred while proxying the request',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    console.log("=== PROXY ROUTE FINISHED ===");
  }
} 