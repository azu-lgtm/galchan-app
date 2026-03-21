"""
get_token.py
ガルちゃんアカウント（1）のリフレッシュトークンを取得する
"""
import http.server
import threading
import webbrowser
import urllib.parse
import requests

import os
from pathlib import Path

def _load_env():
    env_path = Path(__file__).parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()

CLIENT_ID     = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
REDIRECT_URI  = "http://localhost:8080/callback"
SCOPE         = "https://www.googleapis.com/auth/spreadsheets.readonly"

code_received = None

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global code_received
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            code_received = params["code"][0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write("<h1>OK! このタブを閉じてください。</h1>".encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"code not found")
    def log_message(self, *args):
        pass  # ログを抑制

def main():
    # ローカルサーバー起動
    server = http.server.HTTPServer(("localhost", 8080), Handler)
    t = threading.Thread(target=server.handle_request)
    t.start()

    # ブラウザでOAuth認証ページを開く
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
        "&response_type=code"
        f"&scope={urllib.parse.quote(SCOPE)}"
        "&access_type=offline"
        "&prompt=consent"
    )
    print("ブラウザが開きます。ガルちゃんアカウント（garuchanneru226@gmail.com）で認証してください...")
    webbrowser.open(auth_url)

    t.join(timeout=120)
    server.server_close()

    if not code_received:
        print("タイムアウト（120秒）。再実行してください。")
        return

    print(f"認可コード取得: {code_received[:20]}...")

    # リフレッシュトークン取得
    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code":          code_received,
        "redirect_uri":  REDIRECT_URI,
        "grant_type":    "authorization_code",
    })
    data = resp.json()

    if "refresh_token" in data:
        print("\n✅ REFRESH_TOKEN 取得成功！")
        print(f"\nGOOGLE_REFRESH_TOKEN={data['refresh_token']}")
        print("\n↑ この値を .env.local と sheets_to_obsidian.py の REFRESH_TOKEN に貼り替えてください。")
    else:
        print("❌ 失敗:", data)

if __name__ == "__main__":
    main()
