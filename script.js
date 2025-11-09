// script.js
lucide.createIcons();

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatHistoryPanel = document.getElementById('chat-history');
const fileInput = document.getElementById('file-input');
const filePreviewArea = document.getElementById('file-preview-area');
const fileInfo = document.getElementById('file-info');

// --- Новые элементы для мобильного меню ---
const sidebarPanel = document.getElementById('sidebar-panel');
const mobileOverlay = document.getElementById('mobile-overlay');

// Ключ API для доступа к сервису
const API_KEY = 'AIzaSyDEwUzsdWVTcZek4Dht4QGgYSKak8MTVf8';

// --- Настройки Gemini API ---
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';
const AI_MODEL = 'gemini-2.5-flash-preview-09-2025';
// --- Конец настроек Gemini API ---

let currentChatId = null;
let chats = {}; // Stores all chat data: {chatId: {title: "...", messages: [...]}}
let isFirstMessageInCurrentChat = true;

// This stores any attached file data for the *next* message
let attachedFile = null;

// --- Sidebar/Mobile Menu Management ---
window.toggleSidebar = function() {
        const isOpen = sidebarPanel.classList.toggle('sidebar-open');
        if (isOpen) {
            mobileOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Запретить скролл основного контента
        } else {
            mobileOverlay.classList.add('hidden');
            document.body.style.overflow = ''; // Разрешить скролл
        }
    }
    // --- End Sidebar/Mobile Menu Management ---


// --- Chat History Management ---
function generateChatId() {
    return 'chat_' + Date.now();
}

function saveChats() {
    localStorage.setItem('ai_chats', JSON.stringify(chats));
}

function loadChats() {
    const storedChats = localStorage.getItem('ai_chats');
    if (storedChats) {
        chats = JSON.parse(storedChats);
    }
    renderChatHistory();
}

function renderChatHistory() {
    chatHistoryPanel.innerHTML = '';
    const sortedChatIds = Object.keys(chats).sort((a, b) => {
        // Sort by last message timestamp or creation time
        const timeA = chats[a].messages.length > 0 ? chats[a].messages[chats[a].messages.length - 1].timestamp : chats[a].createdAt;
        // 🚨 ИСПРАВЛЕНИЕ: Правильный доступ к последнему элементу массива messages для чата B
        const timeB = chats[b].messages.length > 0 ? chats[b].messages[chats[b].messages.length - 1].timestamp : chats[b].createdAt;
        return timeB - timeA;
    });

    if (sortedChatIds.length === 0) {
        // Initialize a new chat if no history exists
        newChat();
        return;
    }

    sortedChatIds.forEach(id => {
        const chat = chats[id];
        const button = document.createElement('button');
        button.className = `chat-history-item flex items-center gap-3 hover:bg-[#282A2C] transition-colors rounded-lg px-4 py-3 text-sm font-medium text-gray-200 w-full text-left truncate ${id === currentChatId ? 'active bg-[#282A2C]' : ''}`;
        button.innerHTML = `<i data-lucide="message-square" class="w-5 h-5 text-gray-400"></i> <span class="truncate">${chat.title || 'Новый чат'}</span>`;
        button.onclick = () => loadChat(id);
        chatHistoryPanel.appendChild(button);
        lucide.createIcons(); // Re-render icons for new elements
    });

    // If no currentChatId is set (e.g., first load), load the most recent chat
    if (!currentChatId && sortedChatIds.length > 0) {
        loadChat(sortedChatIds[0]);
    } else if (!currentChatId && sortedChatIds.length === 0) {
        // Should not happen if newChat() is called above, but as a safeguard
        newChat();
    }
}

sortedChatIds.forEach(id => {
    const chat = chats[id];
    const button = document.createElement('button');
    button.className = `chat-history-item flex items-center gap-3 hover:bg-[#282A2C] transition-colors rounded-lg px-4 py-3 text-sm font-medium text-gray-200 w-full text-left truncate ${id === currentChatId ? 'active bg-[#282A2C]' : ''}`;
    button.innerHTML = `<i data-lucide="message-square" class="w-5 h-5 text-gray-400"></i> <span class="truncate">${chat.title || 'Новый чат'}</span>`;
    button.onclick = () => loadChat(id);
    chatHistoryPanel.appendChild(button);
    lucide.createIcons(); // Re-render icons for new elements
});

// If no currentChatId is set (e.g., first load), load the most recent chat
if (!currentChatId && sortedChatIds.length > 0) {
    loadChat(sortedChatIds[0]);
} else if (!currentChatId && sortedChatIds.length === 0) {
    // Should not happen if newChat() is called above, but as a safeguard
    newChat();
}


function newChat() {
    currentChatId = generateChatId();
    chats[currentChatId] = {
        title: 'Новый чат',
        messages: [],
        createdAt: Date.now()
    };
    isFirstMessageInCurrentChat = true;
    saveChats();
    renderChatHistory(); // Update history panel to highlight new chat
    clearChatContainer();
    // Clear any lingering attachment UI when starting a new chat
    removeAttachment(false);
    // Show empty state again for a truly new chat
    chatContainer.classList.add('items-center', 'justify-center');
    chatContainer.innerHTML = '<div id="empty-state" class="text-center space-y-4 opacity-100 transition-opacity duration-700 ease-in"></div>';

    // Закрываем боковую панель на мобильном
    if (window.innerWidth < 768 && sidebarPanel.classList.contains('sidebar-open')) {
        toggleSidebar();
    }
}

function loadChat(chatId) {
    currentChatId = chatId;
    isFirstMessageInCurrentChat = false; // A loaded chat is not "new"
    clearChatContainer();
    removeAttachment(false); // Clear attachment when switching chats

    const chat = chats[chatId];
    if (chat && chat.messages) {
        chat.messages.forEach(msg => {
            // Check if the original user message stored an attached file structure
            if (msg.role === 'user' && msg.file) {
                // Display user message with attached file
                // The UI should display the file visual + the original text
                appendFileMessage('user', msg.file.type, msg.file.data, msg.file.name, msg.file.type.startsWith('image/') ? msg.text : msg.text.split('\n\nПользовательский запрос: ')[1] || '');
            } else {
                // Display regular message
                appendMessage(msg.role, msg.text);
            }
        });
    }

    // Adjust chat container for loaded messages
    if (chat.messages.length > 0) {
        chatContainer.classList.remove('items-center', 'justify-center');
        chatContainer.classList.add('justify-start');
    } else {
        chatContainer.classList.add('items-center', 'justify-center');
    }

    // Update active state in history panel
    document.querySelectorAll('.chat-history-item').forEach(btn => {
        btn.classList.remove('active', 'bg-[#282A2C]');
    });
    // Ищем кнопку по ID, это более надежно, чем по тексту
    const activeBtn = Array.from(document.querySelectorAll('.chat-history-item')).find(btn => btn.onclick.toString().includes(`loadChat('${chatId}')`));
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-[#282A2C]');
    }

    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'auto'
    }); // Scroll instantly

    // --- Добавлено: Закрываем боковую панель после выбора чата на мобильном ---
    if (window.innerWidth < 768 && sidebarPanel.classList.contains('sidebar-open')) {
        toggleSidebar();
    }
    // --- Конец добавленного блока ---
}

function clearChatContainer() {
    chatContainer.innerHTML = '';
}

// --- Message Handling ---
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    updateSendButtonState();
}

userInput.addEventListener('input', updateSendButtonState);

function updateSendButtonState() {
    // Enable if there is text OR a file attached
    if (userInput.value.trim().length > 0 || attachedFile) {
        sendButton.disabled = false;
        sendButton.classList.remove('text-white/50', 'bg-transparent');
        sendButton.classList.add('text-white', 'bg-white/10');
    } else {
        sendButton.disabled = true;
        sendButton.classList.add('text-white/50', 'bg-transparent');
        sendButton.classList.remove('text-white', 'bg-white/10');
    }
}

function appendMessage(role, content) {
    if (isFirstMessageInCurrentChat) {
        chatContainer.classList.remove('items-center', 'justify-center');
        chatContainer.classList.add('justify-start');
        if (document.getElementById('empty-state')) {
            document.getElementById('empty-state').remove();
        }
        isFirstMessageInCurrentChat = false;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `w-full max-w-3xl mx-auto animate-fade-in ${role === 'user' ? 'flex justify-end' : 'flex justify-start'}`;

    const messageDiv = document.createElement('div');
    // AI messages are full-width within the max-w-3xl container to allow markdown blocks to span the full width
    messageDiv.className = role === 'user' ?
        'bg-[#282A2C] text-gray-100 px-5 py-3.5 rounded-[26px] max-w-[85%] leading-relaxed break-words' :
        'text-gray-100 px-0 py-3.5 max-w-full leading-relaxed prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#282A2C] break-words';

    if (role === 'model') {
        messageDiv.innerHTML = marked.parse(content);
    } else {
        messageDiv.textContent = content;
    }

    wrapper.appendChild(messageDiv);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function appendFileMessage(role, fileType, fileData, fileName, textContent = '') {
    if (isFirstMessageInCurrentChat) {
        chatContainer.classList.remove('items-center', 'justify-center');
        chatContainer.classList.add('justify-start');
        if (document.getElementById('empty-state')) {
            document.getElementById('empty-state').remove();
        }
        isFirstMessageInCurrentChat = false;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `w-full max-w-3xl mx-auto animate-fade-in ${role === 'user' ? 'flex justify-end' : 'flex justify-start'}`;

    const messageDiv = document.createElement('div');
    // User file message bubble styles
    messageDiv.className = role === 'user' ?
        'bg-[#282A2C] text-gray-100 p-4 rounded-[26px] max-w-[85%] leading-relaxed break-words flex flex-col items-start' :
        // AI file message bubble styles (only used if AI returns a file, which is unlikely but handled)
        'text-gray-100 px-0 py-3.5 max-w-full leading-relaxed prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#282A2C] break-words';


    // 1. Display file/image preview
    if (fileType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileData;
        img.alt = `Загруженное изображение: ${fileName}`;
        img.className = 'max-w-full h-auto rounded-xl mb-3 border border-white/10 shadow-lg max-h-72 object-contain';
        messageDiv.appendChild(img);
    } else { // Assume text file
        const fileHeader = document.createElement('div');
        fileHeader.className = 'flex items-center gap-2 mb-2 text-sm text-gray-400';
        fileHeader.innerHTML = `<i data-lucide="file-text" class="w-4 h-4"></i> <span class="font-medium truncate">${fileName}</span>`;
        messageDiv.appendChild(fileHeader);

        // Use a pre tag to display the text content cleanly
        const filePre = document.createElement('pre');
        filePre.className = 'bg-[#1D1E1F] p-3 rounded-lg overflow-x-auto text-sm text-gray-300 w-full whitespace-pre-wrap';
        // Only show a snippet if it's very long, otherwise show all
        const snippet = fileData.length > 500 ? fileData.substring(0, 500) + '\n\n[... Содержимое файла было длинным и укорочено.]' : fileData;
        filePre.textContent = snippet;
        messageDiv.appendChild(filePre);
        lucide.createIcons();
    }

    // 2. Append additional user text prompt (if provided alongside the file)
    if (textContent) {
        const textPart = document.createElement('p');
        textPart.textContent = textContent;
        textPart.className = fileType.startsWith('image/') ? 'mt-2 pt-2 border-t border-white/5 w-full' : 'mt-3 w-full';
        messageDiv.appendChild(textPart);
    }

    wrapper.appendChild(messageDiv);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}


function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.id = 'typing-indicator';
    wrapper.className = 'w-full max-w-3xl mx-auto flex justify-start animate-fade-in';
    wrapper.innerHTML = `
        <div class="flex space-x-2 p-4 bg-transparent rounded-2xl">
            <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        </div>
        `;
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Renders the file preview UI above the input
function renderFilePreview() {
    if (attachedFile) {
        filePreviewArea.classList.remove('hidden');
        let iconHtml = attachedFile.type.startsWith('image/') ? '<i data-lucide="image" class="w-4 h-4"></i>' : '<i data-lucide="file-text" class="w-4 h-4"></i>';
        let typeText = attachedFile.type.startsWith('image/') ? 'Изображение' : 'Текст';

        fileInfo.innerHTML = `${iconHtml} <span class="font-medium text-gray-200 truncate">${attachedFile.name}</span> <span class="text-xs text-gray-500">(${typeText})</span>`;
        lucide.createIcons(); // Re-render icons
    } else {
        filePreviewArea.classList.add('hidden');
        fileInfo.innerHTML = '';
    }
}

// Function to remove the attached file
function removeAttachment(updateHistory = true) {
    attachedFile = null;
    if (updateHistory) {
        updateSendButtonState();
    }
    renderFilePreview();
}


async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !attachedFile) return;

    // Cache current state before clearing input
    const currentAttachedFile = attachedFile;
    let currentText = text;

    // --- 1. Prepare Content for UI/History (Pre-API) ---
    const userMessageContent = {
        role: 'user',
        text: currentText, // This may be overwritten for text files
        timestamp: Date.now()
    };

    if (currentAttachedFile) {
        userMessageContent.file = {
            type: currentAttachedFile.type,
            data: currentAttachedFile.data,
            name: currentAttachedFile.name
        };
    }

    // --- Logic for Text Files (Combining file data into text prompt for API/history) ---
    if (currentAttachedFile && currentAttachedFile.type.startsWith('text/')) {
        const fileContent = currentAttachedFile.data;
        const combinedPrompt = `--- Содержимое файла: ${currentAttachedFile.name} ---\n\`\`\`\n${fileContent}\n\`\`\`\n\nПользовательский запрос: ${text}`;

        // Overwrite the text used for API and history storage to include file content
        currentText = combinedPrompt;
        userMessageContent.text = combinedPrompt;
    }

    // --- 2. Append User Message to UI ---
    if (currentAttachedFile) {
        // For UI, we still display the file visual + the original (non-combined) user text
        appendFileMessage('user', currentAttachedFile.type, currentAttachedFile.data, currentAttachedFile.name, text);
    } else {
        appendMessage('user', currentText);
    }

    // --- 3. Save History and Update UI/Input ---
    chats[currentChatId].messages.push(userMessageContent);
    saveChats();

    // 4. Set chat title if first message
    if (chats[currentChatId].title === 'Новый чат' && text) {
        chats[currentChatId].title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderChatHistory(); // Update title in history
    }

    // 5. Clear input, clear attachment state, and show loading
    userInput.value = '';
    userInput.style.height = 'auto';
    removeAttachment();

    showTypingIndicator();

    let responseText = "Извините, я не могу ответить прямо сейчас. Проверьте ваш API ключ или модель.";

    try {

        // --- 6. Prepare Gemini Conversation Payload (API Call) ---
        let contents = [];

        // Add conversation history
        chats[currentChatId].messages.slice(0, -1).forEach(msg => {
            if (msg.role === 'model') {
                contents.push({ role: 'model', parts: [{ text: msg.text }] });
            } else if (msg.role === 'user') {
                let userParts = [];
                // Check if an image was attached historically (text files are merged into msg.text)
                if (msg.file && msg.file.type.startsWith('image/')) {
                    userParts.push({
                        inlineData: {
                            mimeType: msg.file.type,
                            data: msg.file.data.split(',')[1]
                        }
                    });
                }
                // This handles text-only, text-file-merged, and the text part of image messages
                userParts.push({ text: msg.text });
                contents.push({ role: 'user', parts: userParts });
            }
        });

        // Handle the *current* message
        let currentParts = [];

        if (currentAttachedFile && currentAttachedFile.type.startsWith('image/')) {
            // Add image data part
            currentParts.push({
                inlineData: {
                    mimeType: currentAttachedFile.type,
                    data: currentAttachedFile.data.split(',')[1]
                }
            });
            // Add the text prompt part (original text or combined text file prompt)
            if (text) {
                currentParts.push({ text: text });
            }
        } else if (currentText) {
            // This handles text-only messages AND the combined prompt for text files
            currentParts.push({ text: currentText });
        }

        // Add the current user message to the payload
        if (currentParts.length > 0) {
            contents.push({ role: 'user', parts: currentParts });
        }

        // --- 7. API Call ---
        if (API_KEY && API_KEY !== 'ВАШ_КЛЮЧ_API') {
            const payload = {
                contents: contents,
            };

            const response = await fetch(`${GEMINI_ENDPOINT}?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.status !== 200 || data.error || !data.candidates) {
                console.error("Gemini API Error:", data.error || data);

                // Check for API Key or permission error
                if (data.error && (data.error.message.includes('API key not valid') || data.error.message.includes('permission denied'))) {
                    responseText = `❌ **Ошибка Gemini API.**\n\nПроизошла ошибка аутентификации или разрешения. Убедитесь, что ваш ключ Gemini API (**AIza...**) действителен и не имеет ограничений (например, IP-адреса).`;
                } else {
                    responseText = `Общая ошибка Gemini API: ${data.error ? data.error.message : 'Неизвестная ошибка.'}`;
                }
            } else {
                // Gemini response parsing
                const candidate = data.candidates[0];
                if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    responseText = candidate.content.parts[0].text;
                } else {
                    responseText = "Не удалось получить ответ от модели Gemini (пустой ответ).";
                }
            }
        } else {
            // Placeholder response when API key is not set
            await new Promise(r => setTimeout(r, 1500));
            responseText = "⚠️ **API Ключ Gemini не установлен.**\n\nЧтобы чат заработал по-настоящему, откройте исходный код (index.html) и замените API ключ на действующий.";
        }

        // 8. Update UI and History
        removeTypingIndicator();
        appendMessage('model', responseText);

        // Store AI response for history
        chats[currentChatId].messages.push({
            role: 'model',
            text: responseText,
            timestamp: Date.now()
        });
        saveChats();

    } catch (error) {
        console.error("Network/Parsing Error:", error);
        removeTypingIndicator();
        appendMessage('model', "Произошла ошибка сети. Попробуйте позже.");
    }
}

// --- File Input Handling ---
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        attachedFile = {
            name: file.name,
            type: file.type,
            data: e.target.result // Base64 for images, raw text for text files
        };
        updateSendButtonState(); // Enable send button if a file is attached
        renderFilePreview(); // Show the file preview
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file); // Reads as Base64 for images
    } else if (file.type.startsWith('text/')) {
        reader.readAsText(file); // Reads as plain text for text files
    } else {
        // Gemini supports many mime types, but we restrict to image/text for this mockup
        console.error('Поддерживаются только изображения и текстовые файлы.');
        attachedFile = null;
    }
    // Сброс поля ввода файла, чтобы можно было загрузить тот же файл снова
    event.target.value = null;
});


// Initial setup
loadChats();
updateSendButtonState();
