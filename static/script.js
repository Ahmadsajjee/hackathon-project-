// ============================================
// DOM Elements
// ============================================
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const errorToast = document.getElementById('errorToast');

// ============================================
// State Management
// ============================================
let isLoading = false;
const sessionId = generateSessionId();

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkServerHealth();
});

function initializeEventListeners() {
    // Send button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Enter key to send
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Reset button
    resetBtn.addEventListener('click', resetChat);
    
    // Sample question chips
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip')) {
            const question = e.target.getAttribute('data-question');
            if (question) {
                userInput.value = question;
                sendMessage();
            }
        }
    });
    
    // Auto-resize input on typing
    userInput.addEventListener('input', () => {
        adjustInputHeight();
    });
}

// ============================================
// Core Chat Functions
// ============================================
async function sendMessage() {
    const message = userInput.value.trim();
    
    // Validation
    if (!message || isLoading) return;
    
    // Clear input immediately
    userInput.value = '';
    adjustInputHeight();
    
    // Remove welcome message on first interaction
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => welcomeMsg.remove(), 300);
    }
    
    // Display user message
    addMessage(message, 'user');
    
    // Show loading state
    isLoading = true;
    sendBtn.disabled = true;
    const loadingDiv = showLoading();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId
            })
        });
        
        // Remove loading animation
        loadingDiv.remove();
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            addMessage(
                '⚠️ Sorry, I encountered an error processing your request. Please try again or contact support if the issue persists.',
                'assistant'
            );
            showError(data.error);
        } else {
            addMessage(data.response, 'assistant', data.citations);
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        loadingDiv.remove();
        addMessage(
            '❌ Unable to connect to the server. Please check your internet connection and try again.',
            'assistant'
        );
        showError(error.message);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

function addMessage(text, sender, citations = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format text (preserve line breaks)
    const formattedText = text.replace(/\n/g, '<br>');
    contentDiv.innerHTML = formattedText;
    
    // Add citations if available
    if (citations && citations.length > 0) {
        const citationsDiv = document.createElement('div');
        citationsDiv.className = 'citations';
        citationsDiv.innerHTML = '<strong>📎 Source:</strong> healthcare_faq.md';
        contentDiv.appendChild(citationsDiv);
    }
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Smooth scroll to bottom
    scrollToBottom();
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.innerHTML = `
        <div class="message-content">
            <div class="loading-container">
                <div class="loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span style="color: #666; font-size: 14px;">Thinking...</span>
            </div>
        </div>
    `;
    chatContainer.appendChild(loadingDiv);
    scrollToBottom();
    return loadingDiv;
}

async function resetChat() {
    if (!confirm('🔄 Are you sure you want to reset the chat? This will clear all messages.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: sessionId
            })
        });
        
        if (response.ok) {
            // Clear chat and show welcome message again
            chatContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>👋 Chat Reset Successfully!</h2>
                    <p class="subtitle">Ask me anything about your healthcare coverage.</p>
                    <div class="sample-questions">
                        <p class="sample-title"><strong>💡 Try asking:</strong></p>
                        <div class="question-chips">
                            <button class="chip" data-question="What is the copay for telehealth visits?">What is the copay for telehealth visits?</button>
                            <button class="chip" data-question="How do I find in-network providers?">How do I find in-network providers?</button>
                            <button class="chip" data-question="Are mental health visits covered?">Are mental health visits covered?</button>
                            <button class="chip" data-question="How do I submit a claim?">How do I submit a claim?</button>
                        </div>
                    </div>
                </div>
            `;
            userInput.value = '';
            userInput.focus();
        } else {
            showError('Failed to reset chat');
        }
    } catch (error) {
        console.error('Reset error:', error);
        showError('Unable to reset chat');
    }
}

// ============================================
// Health Check
// ============================================
async function checkServerHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (!data.assistant_configured || !data.endpoint_configured) {
            console.warn('Server configuration incomplete:', data);
            showError('⚙️ Server configuration incomplete. Please check your .env file.');
        }
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// ============================================
// Utility Functions
// ============================================
function scrollToBottom() {
    setTimeout(() => {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

function showError(message) {
    const toastMessage = errorToast.querySelector('.toast-message');
    toastMessage.textContent = message;
    errorToast.classList.add('show');
    
    setTimeout(() => {
        errorToast.classList.remove('show');
    }, 5000);
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function adjustInputHeight() {
    // Reset height to auto to get proper scrollHeight
    userInput.style.height = 'auto';
    // Set new height based on content (max 120px)
    const newHeight = Math.min(userInput.scrollHeight, 120);
    userInput.style.height = newHeight + 'px';
}

// ============================================
// Animation for welcome message fade out
// ============================================
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
`;
document.head.appendChild(style);

// ============================================
// Service Worker (for PWA - future enhancement)
// ============================================
if ('serviceWorker' in navigator) {
    // Uncomment when you want to make this a PWA
    // navigator.serviceWorker.register('/sw.js');
}

// ============================================
// Keyboard Shortcuts
// ============================================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        userInput.focus();
    }
    
    // Escape to clear input
    if (e.key === 'Escape' && document.activeElement === userInput) {
        userInput.value = '';
        adjustInputHeight();
    }
});

// ============================================
// Console Easter Egg
// ============================================
console.log('%c🏥 HealthCare Assistant', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%cBuilt for HealTech Innovators Hackathon 2025', 'color: #764ba2; font-size: 12px;');
console.log('%cPowered by Azure OpenAI', 'color: #666; font-size: 10px;');
