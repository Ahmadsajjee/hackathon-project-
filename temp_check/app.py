from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import AzureOpenAI
import os
import time
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-05-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

# Your assistant ID from Azure AI Studio
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

# Store thread IDs per session (in production, use Redis or database)
threads = {}

@app.route('/')
def home():
    """Render the main chat interface"""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages and interact with Azure OpenAI Assistant"""
    try:
        data = request.json
        user_message = data.get('message')
        session_id = data.get('session_id', 'default')
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Create or retrieve thread for this session
        if session_id not in threads:
            thread = client.beta.threads.create()
            threads[session_id] = thread.id
        
        thread_id = threads[session_id]
        
        # Add user message to thread
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )
        
        # Wait for completion with timeout
        max_wait = 30  # seconds
        start_time = time.time()
        
        while run.status in ["queued", "in_progress"]:
            if time.time() - start_time > max_wait:
                return jsonify({'error': 'Request timeout'}), 504
            
            time.sleep(0.5)
            run = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id
            )
        
        if run.status == "failed":
            return jsonify({'error': 'Assistant processing failed'}), 500
        
        # Get the assistant's response
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        
        if not messages.data:
            return jsonify({'error': 'No response from assistant'}), 500
        
        assistant_message = messages.data[0].content[0].text.value
        
        # Extract citations if available
        citations = []
        if messages.data[0].content[0].text.annotations:
            for annotation in messages.data[0].content[0].text.annotations:
                if hasattr(annotation, 'file_citation'):
                    citations.append({
                        'text': annotation.text,
                        'file_id': annotation.file_citation.file_id
                    })
        
        return jsonify({
            'response': assistant_message,
            'citations': citations,
            'thread_id': thread_id,
            'status': 'success'
        })
    
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in chat endpoint: {str(e)}")
        print(f"Full traceback: {error_traceback}")
        return jsonify({'error': f'An error occurred: {str(e)}', 'details': error_traceback}), 500

@app.route('/api/reset', methods=['POST'])
def reset_chat():
    """Reset the chat session"""
    try:
        session_id = request.json.get('session_id', 'default')
        if session_id in threads:
            del threads[session_id]
        return jsonify({'message': 'Chat reset successfully', 'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'assistant_configured': bool(ASSISTANT_ID),
        'endpoint_configured': bool(os.getenv("AZURE_OPENAI_ENDPOINT"))
    })

@app.route('/api/test-azure', methods=['GET'])
def test_azure_connection():
    """Test Azure OpenAI connection without assistant"""
    try:
        # Simple test to check if we can connect to Azure OpenAI
        response = client.chat.completions.create(
            model="gpt-4o",  # Using the deployment name from Azure
            messages=[{"role": "user", "content": "Hello, this is a test"}],
            max_tokens=50
        )
        return jsonify({
            'status': 'success',
            'message': 'Azure OpenAI connection successful',
            'response': response.choices[0].message.content
        })
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Azure OpenAI test error: {str(e)}")
        print(f"Full traceback: {error_traceback}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'traceback': error_traceback
        }), 500

if __name__ == '__main__':
    # Validate configuration
    config_errors = []
    if not ASSISTANT_ID:
        config_errors.append("ASSISTANT_ID not configured in .env file")
    if not os.getenv("AZURE_OPENAI_API_KEY"):
        config_errors.append("AZURE_OPENAI_API_KEY not configured in .env file")
    if not os.getenv("AZURE_OPENAI_ENDPOINT"):
        config_errors.append("AZURE_OPENAI_ENDPOINT not configured in .env file")
    
    if config_errors:
        print("❌ Configuration Errors:")
        for error in config_errors:
            print(f"   - {error}")
        print("\n📝 Please check your .env file and ensure all required values are set.")
        print("   See .env.example for setup instructions.")
    else:
        print("✅ Configuration validated successfully!")
    
    print("\n🏥 Starting HealthCare Assistant API...")
    print("📱 Access the application at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
