<script>
    const socket = new WebSocket("ws://localhost:8080"); // 배포시 서버 주소로 변경 필요

    const nicknameInput = document.getElementById("nicknameInput");
    const saveNicknameButton = document.getElementById("saveNickname");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const messagesDiv = document.getElementById("messages");
    const chatContainer = document.querySelector(".chat-container");
    const nicknameSection = document.getElementById("nicknameSection");

    // 닉네임 저장 및 표시
    saveNicknameButton.addEventListener("click", saveNickname);
    nicknameInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") saveNickname();
    });

    function saveNickname() {
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            localStorage.setItem("nickname", nickname);
            nicknameSection.style.display = "none";
            chatContainer.style.display = "block";
        }
    }

    // 닉네임이 이미 설정되어 있으면 바로 채팅 화면 표시
    window.onload = () => {
        const savedNickname = localStorage.getItem("nickname");
        if (savedNickname) {
            nicknameSection.style.display = "none";
            chatContainer.style.display = "block";
        }
    };

    // 메시지 수신 처리 + 자동 스크롤
    socket.onmessage = (event) => {
        const messageElement = document.createElement("div");
        messageElement.textContent = event.data;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // 자동 스크롤
    };

    // 메시지 전송
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        const nickname = localStorage.getItem("nickname") || "익명";
        if (message && nickname) {
            socket.send(nickname + ": " + message);
            messageInput.value = "";
        }
    }
</script>
