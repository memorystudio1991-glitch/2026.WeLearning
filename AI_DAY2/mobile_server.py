"""
====================================================================
 [AI_DAY2] 스마트폰 연동 인체 스켈레톤(Pose) 모바일 HTTPS 서버
====================================================================
- 기능:
  1. PC의 로컬 네트워크 IP(Wi-Fi IP)를 자동 감지합니다.
  2. 모바일 브라우저 카메라 권한(HTTPS)을 위한 자체 SSL 인증서를 자동 생성합니다.
  3. 스마트폰으로 즉시 스캔할 수 있는 QR 코드를 콘솔 및 팝업 창에 표시합니다.
  4. 스마트폰 브라우저에서 실행되는 고성능 스켈레톤 웹앱을 호스팅합니다.
====================================================================
"""

import os
import sys
import socket
import ssl
import time
import threading
import ipaddress
import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

# 윈도우 콘솔 UTF-8 인코딩 안전 처리
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# 서드파티 라이브러리 (requirements.txt에 명시)
import qrcode
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

PORT = 8443
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOBILE_DIR = os.path.join(BASE_DIR, "mobile")
CERT_FILE = os.path.join(BASE_DIR, "cert.pem")
KEY_FILE = os.path.join(BASE_DIR, "key.pem")
QR_IMG_FILE = os.path.join(BASE_DIR, "qr_code.png")

def get_local_ip():
    """PC의 로컬 네트워크(Wi-Fi 또는 LAN) IP 주소를 감지합니다."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 실제 패킷을 전송하지 않고 로컬 인터페이스 IP를 조회
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def generate_self_signed_cert(ip_addr):
    """모바일 브라우저의 카메라(HTTPS) 접근을 위한 자체 SSL 인증서를 생성합니다."""
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return

    print("[1단계] 모바일 카메라 권한을 위한 로컬 보안 인증서(SSL) 생성 중...")
    
    # 1. 개인키(RSA 2048bit) 생성
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # 2. 인증서 정보(Subject) 설정
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "KR"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "WeLearning AI_DAY2"),
        x509.NameAttribute(NameOID.COMMON_NAME, ip_addr),
    ])

    # 3. Subject Alternative Name (SAN)에 로컬 IP 및 localhost 등록
    san_list = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]
    try:
        san_list.append(x509.IPAddress(ipaddress.IPv4Address(ip_addr)))
    except Exception:
        pass

    # 4. 1년간 유효한 자체 서명 X.509 인증서 발급
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.now(datetime.timezone.utc)
    ).not_valid_after(
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName(san_list),
        critical=False,
    ).sign(key, hashes.SHA256())

    # 5. 파일로 저장
    with open(KEY_FILE, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print("[완료] 로컬 SSL 인증서가 생성되었습니다.")

def create_qr_code(url):
    """접속 주소를 담은 QR 코드를 생성하고 이미지로 저장합니다."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(QR_IMG_FILE)
    return qr

def show_qr_popup():
    """사용자가 스마트폰으로 쉽게 스캔할 수 있도록 PC 화면에 QR 코드 창을 띄웁니다."""
    try:
        import tkinter as tk
        from PIL import ImageTk, Image

        root = tk.Tk()
        root.title("스마트폰으로 이 QR 코드를 스캔하세요 - AI_DAY2")
        root.geometry("450x520")
        root.configure(bg="#121212")

        # 상단 안내 텍스트
        title_label = tk.Label(
            root,
            text="📱 스마트폰 카메라로 QR 코드를 스캔하세요",
            font=("맑은 고딕", 12, "bold"),
            fg="#00e5ff",
            bg="#121212"
        )
        title_label.pack(pady=12)

        # QR 이미지 표시
        img = Image.open(QR_IMG_FILE).resize((320, 320))
        photo = ImageTk.PhotoImage(img)
        img_label = tk.Label(root, image=photo, bg="#121212")
        img_label.image = photo
        img_label.pack(pady=5)

        # 하단 팁 안내
        tip_label = tk.Label(
            root,
            text="※ 스마트폰과 PC가 동일한 Wi-Fi에 연결되어 있어야 합니다.\n※ 접속 시 [세부사항 보기] -> [이 웹사이트 방문]을 누르면 카메라가 켜집니다.",
            font=("맑은 고딕", 9),
            fg="#aaaaaa",
            bg="#121212",
            justify="center"
        )
        tip_label.pack(pady=10)

        root.mainloop()
    except Exception as e:
        pass

class MobileAppHandler(SimpleHTTPRequestHandler):
    """mobile 폴더 내 웹 정적 자원을 서비스하는 HTTP 요청 처리 핸들러"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=MOBILE_DIR, **kwargs)

    def log_message(self, format, *args):
        # 모바일 접속 시 간결한 접속 로그만 출력
        if "GET" in args[0]:
            print(f"[스마트폰 접속] {self.address_string()} - {args[0]}")

def run_server():
    local_ip = get_local_ip()
    target_url = f"https://{local_ip}:{PORT}"

    # 1. SSL 인증서 준비
    generate_self_signed_cert(local_ip)

    # 2. QR 코드 생성
    qr = create_qr_code(target_url)

    # 3. 콘솔 터미널 출력
    print("\n" + "=" * 62)
    print(" [AI_DAY2] 스마트폰 연동 인체 스켈레톤 웹앱 서버 실행 완료")
    print("=" * 62)
    print(f"\n  [접속 주소] 스마트폰 브라우저 URL: {target_url}\n")
    print("  [스캔용 QR 코드]")
    try:
        qr.print_ascii(invert=True)
    except Exception:
        pass

    print("\n" + "-" * 62)
    print("  [스마트폰 최초 접속 시 1회성 팁]")
    print("  1. PC 화면의 QR 코드를 스마트폰 카메라로 스캔하여 접속합니다.")
    print("  2. '보안 경고' 화면이 나타나면:")
    print("     * 아이폰(Safari) : [세부사항 보기] -> [이 웹사이트 방문] 클릭")
    print("     * 갤럭시(Chrome) : [고급] -> [해당 사이트로 이동(안전하지 않음)] 클릭")
    print("  3. '카메라 사용 권한' 창에서 [허용]을 누르면 즉시 뼈대가 표시됩니다.")
    print("  * 서버를 종료하려면 이 창에서 Ctrl + C 를 누르세요.")
    print("-" * 62 + "\n")

    # 4. QR 코드 팝업 윈도우를 백그라운드 스레드로 실행
    popup_thread = threading.Thread(target=show_qr_popup, daemon=True)
    popup_thread.start()

    # 5. HTTPS 서버 구동
    server = HTTPServer(("0.0.0.0", PORT), MobileAppHandler)
    
    # SSL 컨텍스트 구성
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[안내] 서버가 안전하게 종료되었습니다.")
    finally:
        server.server_close()

if __name__ == "__main__":
    run_server()
