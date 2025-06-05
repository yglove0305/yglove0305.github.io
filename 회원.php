<?php
session_start();

// 파일 경로 설정
$names_file    = 'names.json';
$messages_file = 'messages.json';
$uploads_dir   = 'uploads';

// uploads 폴더가 없으면 생성
if (!file_exists($uploads_dir)) {
    mkdir($uploads_dir, 0777, true);
}

// names.json, messages.json 파일이 없으면 기본값 생성
if (!file_exists($names_file)) {
    file_put_contents($names_file, json_encode(new stdClass()));
}
if (!file_exists($messages_file)) {
    file_put_contents($messages_file, json_encode([]));
}

// 메시지 추가 함수
function append_message($username, $message, $file_link = '') {
    global $messages_file;
    $messages = json_decode(file_get_contents($messages_file), true);
    if (!$messages) {
        $messages = [];
    }
    $messages[] = [
        "username"  => $username,
        "message"   => $message,
        "file"      => $file_link,
        "timestamp" => time()
    ];
    file_put_contents($messages_file, json_encode($messages, JSON_PRETTY_PRINT));
}

// AJAX 요청 처리
if (isset($_GET['action'])) {
    $action = $_GET['action'];
    header('Content-Type: application/json');

    if ($action === 'login') {
        // 비밀번호 체크
        $password = $_POST['password'] ?? '';
        if ($password === "56387") {
            $_SESSION['logged_in'] = true;
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "error" => "비밀번호가 틀렸습니다."]);
        }
        exit();
    }
    elseif ($action === 'set_username') {
        if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
            echo json_encode(["success" => false, "error" => "로그인이 필요합니다."]);
            exit();
        }
        $username = trim($_POST['username'] ?? '');
        if ($username === "") {
            echo json_encode(["success" => false, "error" => "유효한 이름을 입력하세요."]);
            exit();
        }
        $user_id = session_id();
        $names   = json_decode(file_get_contents($names_file), true);
        if (isset($names[$user_id])) {
            // 이미 설정된 이름인 경우
            $_SESSION['username'] = $names[$user_id];
            echo json_encode([
                "success"  => true,
                "username" => $names[$user_id],
                "message"  => "이미 설정된 이름입니다."
            ]);
            exit();
        } else {
            $names[$user_id] = $username;
            file_put_contents($names_file, json_encode($names, JSON_PRETTY_PRINT));
            $_SESSION['username'] = $username;
            echo json_encode([
                "success"  => true,
                "username" => $username,
                "message"  => "이름이 설정되었습니다."
            ]);
            exit();
        }
    }
    elseif ($action === 'send_message') {
        if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
            echo json_encode(["success" => false, "error" => "로그인이 필요합니다."]);
            exit();
        }
        $username = $_SESSION['username'] ?? '익명';
        $msg      = trim($_POST['message'] ?? '');
        if ($msg === "") {
            echo json_encode(["success" => false, "error" => "메시지가 비어있습니다."]);
            exit();
        }
        append_message($username, $msg);
        echo json_encode(["success" => true]);
        exit();
    }
    elseif ($action === 'upload_file') {
        if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
            echo json_encode(["success" => false, "error" => "로그인이 필요합니다."]);
            exit();
        }
        if (!isset($_FILES['file'])) {
            echo json_encode(["success" => false, "error" => "파일이 업로드되지 않았습니다."]);
            exit();
        }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(["success" => false, "error" => "파일 업로드 에러 발생: " . $file['error']]);
            exit();
        }
        // 원본 파일명 앞에 시간정보를 추가하여 중복 방지
        $filename = basename($file['name']);
        $target   = $uploads_dir . '/' . time() . '_' . $filename;
        if (move_uploaded_file($file['tmp_name'], $target)) {
            $username  = $_SESSION['username'] ?? '익명';
            $file_link = $target; // 실제 배포 시에는 URL 경로로 변경 필요
            append_message($username, "파일이 업로드되었습니다.", $file_link);
            echo json_encode(["success" => true, "file_link" => $file_link]);
            exit();
        } else {
            echo json_encode(["success" => false, "error" => "파일 저장에 실패했습니다."]);
            exit();
        }
    }
    elseif ($action === 'get_messages') {
        // 저장된 메시지들을 읽어 JSON으로 반환
        $messages = json_decode(file_get_contents($messages_file), true);
        echo json_encode($messages);
        exit();
    }
    echo json_encode(["success" => false, "error" => "알 수 없는 action."]);
    exit();
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>PHP 채팅 및 파일 업로드</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      background: #f0f4f8;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: #fff;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      padding: 20px;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
    }
    h2, h3 {
      color: #333;
    }
    input, button {
      width: 100%;
      padding: 10px;
      font-size: 1rem;
      margin: 5px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      background: #007bff;
      color: #fff;
      border: none;
      cursor: pointer;
    }
    button:hover {
      background: #0056b3;
    }
    #messages {
      border: 1px solid #ddd;
      height: 300px;
      overflow-y: auto;
      padding: 10px;
      margin-bottom: 10px;
      background: #fafafa;
    }
    .system {
      color: #555;
      font-style: italic;
    }
    .message {
      margin-bottom: 10px;
    }
    .message img {
      max-width: 100%;
      height: auto;
      display: block;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 로그인 (비밀번호 입력) 영역 -->
    <?php if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']): ?>
      <div id="login-container">
        <h2>비밀번호 입력</h2>
        <input type="password" id="password-input" placeholder="비밀번호">
        <button id="login-btn">입장</button>
        <div id="login-error" style="color: red;"></div>
      </div>
    <?php endif; ?>

    <!-- 채팅 영역 -->
    <?php if (isset($_SESSION['logged_in']) && $_SESSION['logged_in']): ?>
      <div id="chat-container">
        <?php if (!isset($_SESSION['username'])): ?>
          <div id="username-container">
            <h3>사용자 이름 설정</h3>
            <input type="text" id="username-input" placeholder="이름 입력">
            <button id="username-btn">설정</button>
            <div id="username-msg"></div>
          </div>
        <?php endif; ?>
        <div id="chat-room" style="<?php echo isset($_SESSION['username']) ? '' : 'display:none;'; ?>">
          <div id="messages"></div>
          <input type="text" id="message-input" placeholder="메시지 입력">
          <button id="send-btn">전송</button>
          <hr>
          <h3>파일 업로드</h3>
          <form id="upload-form" enctype="multipart/form-data">
            <input type="file" name="file" id="file-input">
            <button type="submit">업로드</button>
          </form>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <script>
    // 간단한 AJAX POST 헬퍼 함수
    function ajaxPost(url, data, callback) {
      let xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          callback(JSON.parse(xhr.responseText));
        }
      };
      let formData = new FormData();
      for (let key in data) {
        formData.append(key, data[key]);
      }
      xhr.send(formData);
    }

    <?php if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']): ?>
    // 로그인 처리 (비밀번호 검증)
    document.getElementById('login-btn').addEventListener('click', function(){
      let password = document.getElementById('password-input').value;
      ajaxPost('?action=login', {password: password}, function(response) {
        if (response.success) {
          location.reload();
        } else {
          document.getElementById('login-error').innerText = response.error;
        }
      });
    });
    <?php endif; ?>

    <?php if (isset($_SESSION['logged_in']) && $_SESSION['logged_in']): ?>
    <?php if (!isset($_SESSION['username'])): ?>
    // 이름 설정
    document.getElementById('username-btn').addEventListener('click', function(){
      let username = document.getElementById('username-input').value;
      ajaxPost('?action=set_username', {username: username}, function(response) {
        if (response.success) {
          location.reload();
        } else {
          document.getElementById('username-msg').innerText = response.error;
        }
      });
    });
    <?php endif; ?>

    // 채팅 메시지 전송
    document.getElementById('send-btn').addEventListener('click', function(){
      let msg = document.getElementById('message-input').value;
      ajaxPost('?action=send_message', {message: msg}, function(response) {
        if (response.success) {
          document.getElementById('message-input').value = "";
          loadMessages();
        }
      });
    });

    // 파일 업로드 처리
    document.getElementById('upload-form').addEventListener('submit', function(e) {
      e.preventDefault();
      let fileInput = document.getElementById('file-input');
      let formData = new FormData();
      formData.append('file', fileInput.files[0]);
      let xhr = new XMLHttpRequest();
      xhr.open("POST", "?action=upload_file", true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          let response = JSON.parse(xhr.responseText);
          if (response.success) {
            loadMessages();
          } else {
            alert(response.error);
          }
        }
      };
      xhr.send(formData);
    });

    // 주기적으로 메시지 불러오기
    function loadMessages() {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", "?action=get_messages", true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          let messages = JSON.parse(xhr.responseText);
          let messagesDiv = document.getElementById('messages');
          messagesDiv.innerHTML = "";
          for (let msg of messages) {
            let div = document.createElement('div');
            div.classList.add('message');
            let time = new Date(msg.timestamp * 1000).toLocaleTimeString();
            div.innerHTML = "<strong>" + msg.username + "</strong> (" + time + "): " + msg.message;
            if (msg.file) {
              div.innerHTML += '<br><a href="' + msg.file + '" target="_blank"><img src="' + msg.file + '" alt="uploaded file"></a>';
            }
            messagesDiv.appendChild(div);
          }
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
      };
      xhr.send();
    }
    loadMessages();
    setInterval(loadMessages, 3000);
    <?php endif; ?>
  </script>
</body>
</html>
